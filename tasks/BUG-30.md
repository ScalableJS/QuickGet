---
type: "task"
id: "BUG-30"
status: "done"
priority: "p2"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Intercepted `.torrent` still reaches the disk — no filename-stage suppression

**Severity:** medium · **Area:** background
**Files:** `src/background/downloads.ts:230-247` (`handOffToNas`), `manifest.json` (permissions),
`src/lib/config.ts` (`torrentInterceptMode`), `tests/e2e/download-interception.spec.ts:113-122`

Interception is transactional but **starts too late in the download lifecycle**. `onCreated`
only fires once Chrome has already committed the transfer, so by the time `handOffToNas()`
pauses it, Chrome may have shown "Save as" and/or written the file. On a fast/small `.torrent`
the race is routinely lost: the hand-off succeeds *and* a copy lands in Downloads.

The project already knows this — `download-interception.spec.ts:113-122` asserts
`state === "interrupted" || state === "complete"` precisely because completion-before-cancel is
expected. The transaction guarantees **no data loss**, not **no local file**. That is the
correct guarantee for safety, but it is the wrong user-visible behaviour, and it makes an
honest promo recording impossible (a save dialog in frame contradicts the pitch).

**Root cause:** there is no `chrome.downloads.onDeterminingFilename` listener anywhere in the
codebase (verified: zero matches in `src/`). That event is the only hook that fires *before*
the file is committed, and it holds the download open until `suggest()` is called — which is
exactly the window a hand-off needs.

**What the API does and does not allow** (verified against `@types/chrome`):

- `onDeterminingFilename` (types `index.d.ts:4068`) — fires pre-commit, and the item "will not
  complete until all listeners have called `suggest`". Async is legal if the listener returns
  `true`. This is the real lever: hold here, hand off, then cancel before anything is written.
  Costs no new permission. **Chrome-only** — Firefox does not implement it, so the current
  behaviour must remain the fallback.
- `downloads.setUiOptions({enabled:false})` (`index.d.ts:4055`) — hides the download UI, needs
  the extra `"downloads.shelf"` permission (not currently requested; would need CWS
  justification) and is profile-global//cooperative across extensions. Cosmetic only: it hides
  the shelf/bubble, it does **not** prevent the write and does **not** suppress a "Save as"
  dialog. Not a fix on its own.
- Nothing in the API suppresses the "Ask where to save each file" dialog. If the user has that
  Chrome setting on, a dialog is unavoidable once a download exists. Only never letting the
  download reach that stage avoids it.

**Proposed fix:** add an `onDeterminingFilename` listener that, for a recognised torrent under
a new *full* mode, defers `suggest()`, performs the hand-off, and cancels on success — falling
back to the current pause/cancel path on failure or on non-Chrome. Keep the existing claim
guard (`inFlight` + `CLAIMED_PREFIX`) as the single owner across all three entry points
(`onCreated`, `onChanged`, `onDeterminingFilename`) — a third listener must not double-send.

**Risks to weigh before coding:** MV3 can suspend the worker while `suggest()` is outstanding
(the download would hang — needs the same recovery sweep as `PENDING_PREFIX`); only one
extension may register the listener; a slow NAS now delays *every* torrent download visibly.
Hence the setting below rather than a silent behaviour change.

**Research — the full MV3 option space** (checked against official docs + Chromium source,
2026-08-30). Nothing else in MV3 can stop a user-initiated download from reaching the disk:

| Option | Verdict |
|---|---|
| `downloads.onDeterminingFilename` | **The only workable lever.** Fires before a target path exists — the Chromium browser test asserts `item->GetTargetFilePath().empty()` at this stage while the item is still `IN_PROGRESS`. Holding `suggest()` (return `true`) defers Chrome's native "Save as", so cancelling here means no dialog and no final file. Needs only the `downloads` permission we already hold. **Chrome-only.** |
| `declarativeNetRequest` block/redirect | Kills the request before any byte — but only matches on URL/resource type at `onBeforeRequest`, so it cannot know it is a `.torrent` when the server declares that via `Content-Disposition`. Blunt URL-suffix rules would break normal browsing. |
| DNR `responseHeaders` conditions (Chrome 128+) | **Cannot help.** Official docs: once headers arrive "a block or redirect rule with a response headers condition will still run–but cannot actually block or redirect the request." |
| `webRequest` blocking / `onHeadersReceived` cancel | **Unavailable.** `webRequestBlocking` is policy-installed-extensions only in MV3 — not an option for a Web Store extension. |
| Content script `preventDefault()` on click | Leaky by design: misses middle-click, context-menu "Save link as", JS-initiated downloads, redirects, and any server-driven `Content-Disposition` on a normal navigation. Fine as an optimisation, never as the guarantee. |
| `setUiOptions` / `setShelfEnabled` | Cosmetic only — hides the shelf/bubble, does not prevent the write or the dialog. Needs the extra `downloads.shelf` permission. |
| `downloads.download({saveAs:false})` | Irrelevant: it governs downloads *we* start, not the user's click. |

**Caveat worth stating plainly:** even here, Chrome streams bytes into a temporary
`.crdownload` before the filename is settled (Mozilla bug 1245652 discusses exactly this
Chrome behaviour). So the honest claim is "no save dialog and no file left in Downloads",
**not** "nothing ever touched the disk".

**Firefox:** `onDeterminingFilename` does not exist — Bugzilla 1245652 has been open since
2016 and is still `NEW`, for architectural reasons (downloads are not created until after the
file picker). The current pause/cancel path must remain the Firefox fallback.

**Blocks:** DEMO-1 (a save dialog must not appear on camera). **Blocked by:** nothing.

**Correction found while implementing (2026-08-30).** The first design held `suggest()` across
the whole NAS round-trip. That is wrong: Chromium's filename determiner has its own **15-second
timeout**, after which it finishes the download into the default folder regardless — crbug
40359474 reports exactly that ("file gets downloaded into default download folder after 15
seconds leaving the save as dialog open"). A slow NAS would therefore have produced the stray
file the option exists to prevent. The shipped design instead cancels as soon as the download
is recognised as ours and calls `suggest()` immediately, so the hold spans a local decision
only. Also corrected: `suggest()` does **not** override the "Always ask where to save"
preference (`NeedsConfirmation()` checks `PromptForDownload()` independently) — it is the
*cancel while the stage is held* that keeps the prompt from appearing, not the suggestion.

**Implemented 2026-08-30 (unverified in CI — see below).** `src/background/downloads.ts`:
`handleDeterminingFilename()` holds a reserved id; `handleDownloadCreated()` cancels
immediately in strict mode, before `markInterceptionStarted()`, then releases the hold;
`handOffToNas()` takes `strict` and skips the pause/cancel transaction. `onCreated` now takes a
synchronous reservation before its first `await`, because the filename event can otherwise
arrive while settings are still loading. Every terminal path releases the hold, with a
`finally` as the backstop.

**Testing gap, stated plainly:** `onDeterminingFilename` **never fires under Playwright's
persistent context** — the automation harness assigns each download a target path itself, so
the filename stage is skipped (verified by probing the running worker: the listener registers,
the event never arrives). The e2e case is therefore `test.skip` with manual steps in its
docstring, and the logic is covered by unit tests instead (`downloads.test.ts` →
`suppressLocalTorrentFile`). **Strict mode has not been exercised against a real Chrome
profile yet** — that check is still outstanding and keeps this card In Review.
**2026-09-09 — automated, and the ten-day manual gap is closed.** The blocker was never the
feature; it was that `onDeterminingFilename` does not fire under Playwright, so strict mode could
not be exercised at all. The cause turned out to be one CDP call: `launchPersistentContext` sends
`Browser.setDownloadBehavior` with `allowAndName` at context init (playwright-core
`coreBundle.js:37972`), which names every download a GUID and skips the filename-determination
stage entirely.

Undoing it restores native handling. `launchExtensionPopup` gained a `nativeDownloads` option
that writes `download.default_directory` into the profile's `Preferences` before launch — with
`behavior: "default"` Chrome ignores `downloadPath`, so the profile is the only thing that decides
where a file lands — and then sends `Browser.setDownloadBehavior { behavior: "default" }` over a
CDP session after launch.

`download-interception.spec.ts` now runs **both arms**: strict off leaves `sample.torrent` in the
directory under its real `Content-Disposition` name, strict on leaves the directory empty. The
control is not decoration — an earlier version of this probe measured a directory Chrome was not
writing to and reported success for *both* settings.

**What is still not covered, stated plainly:** the "no Save-as dialog" half. With
`prompt_for_download: true` a headless browser cannot show a dialog, and nothing lands whether
strict is on or off, so that arm proves nothing and was dropped rather than kept as decoration.
The mechanism is the same one the file-absence assertion exercises — cancel while the filename
stage is held — but the dialog itself has still only been reasoned about, not observed.

Two things worth keeping: `acceptDownloads: "internal-browser-default"` would be the clean flag
and is unreachable from the public API, because the client coerces any truthy value to `"accept"`
(`coreBundle.js:60511`); and `onDeterminingFilename` allows exactly **one listener per
extension**, so a test cannot add a probe listener alongside ours — it must assert on outcomes.
Playwright consider CDP calls like this out of scope (issue #23776), so an upgrade may break it —
it will break loudly.

**Resolved 2026-09-09** — shipped in v2.3.0.
