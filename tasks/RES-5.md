---
type: "task"
id: "RES-5"
status: "done"
priority: "p2"
area: "background/content"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Done"
size: "L"
---

# Send an ordinary file download to the NAS on click, any size, behind an off-by-default switch

**Size:** L · **Area:** background/content
**Files:** `src/background/downloads.ts`, `src/content/`, `src/lib/config.ts`,
`src/lib/sourceKind.ts`, `src/popup/features/settings/Settings.svelte`
**Related:** GAP-15 (unresolved redirects), RES-2 (`ftp://`), UX-23/UX-24 (the torrent switch and
Shift-click, the shape this copies)

Click a file link — ISO, ZIP, MKV, DMG, anything — and it goes to Download Station instead of
through the browser. **No size threshold: any size.** A checkbox turns it on, and it is **off by
default**.

**2026-09-13 — shaped.** Three decisions were taken and close earlier options on this card:

- **No size threshold.** The earlier draft listed "size-based threshold (e.g. > 500 MB)" as a
  trigger mode, copying *Send To QNAP++*'s configurable 500 MB default. Dropped. A threshold is a
  number the user has to guess at, and it makes the feature fire unpredictably — the same click
  behaves differently depending on a file size nobody checked first.
- **Off by default.** Unlike the torrent switch, this one changes what happens to *ordinary* web
  downloads, so it must be asked for.
- **Extension-based filtering as a user-facing setting is dropped too** — but see open question 3:
  something still has to decide what counts as a file, and that is a different problem from size.

**What already exists, and must not be rebuilt**

- `classifySource()` already returns `"url"`, and the context-menu path already sends a plain URL
  through `AddUrl`. Sending an ordinary file to the NAS is a solved transport — see
  `docs/qnap-download-station-capabilities.md`, which records exactly this. **What is missing is
  only the automatic trigger.**
- Routing rules run on every send path, so a routed destination comes for free.
- `interceptTorrentLinks` in `src/lib/config.ts` plus its checkbox and hint in `Settings.svelte`
  are the shape to copy, including how the hint explains Shift-click.

**The architectural decision that has to come first**

`handleDownloadCreated` **mirrors**: it hands the torrent to the NAS and deliberately keeps the
browser's local copy, because a `.torrent` is a few KB. For a 4 GB ISO that contract is exactly
wrong — mirroring transfers the file twice. So this feature cannot simply widen the
`isTorrentSource()` gate at `downloads.ts:66`; that one-line change would look right and download
everything twice.

Two candidate mechanisms:

**(a) Content script `preventDefault()` on the click** — the mechanism Shift-click already uses.
No bytes ever flow in the browser, so there is nothing to cancel and no partial file. It only sees
clicks on links: a download started by navigation, by script, or one that only reveals itself as a
download after a redirect, is invisible to it.

**(b) `chrome.downloads.onCreated` + cancel** — catches everything Chrome calls a download, but
bytes have already started before anything can act. `downloads.onDeterminingFilename`, which could
hold the download before a file is written, is **not used anywhere in this codebase today** (it
appears only in comments), and Firefox has never implemented it (Bugzilla 1245652).

(a) is the honest default given what is already built; (b) is a possible second net later, not a
starting point.

**Hazards already documented — do not rediscover them**

- *Auth and cookies:* a file behind a login hands the NAS a 401/403 or an HTML login page. The
  `.torrent` path dodges this by fetching in the page's own session and uploading the bytes; a 4 GB
  file cannot be dodged that way.
- *Ephemeral signed URLs:* S3/Cloudflare pre-signed links expire in 30–60 s and can die while the
  task sits in Download Station's queue.
- *Redirects:* **GAP-15** is currently a small `AddUrl` edge case. This feature makes it a
  mainstream one — the two are coupled and should be decided together.

**Open questions — answer before writing code**

1. Mechanism (a) or (b), or (a) now and (b) behind a later decision.
2. **What happens when the NAS refuses.** Silently fall back to an ordinary browser download, or
   say so? `markSendNotice` and `notifier.ts` are the existing precedent for "this needs you".
   Silent fallback is invisible; a notification on every failure is the thing BUG-* cards spent
   effort removing.
3. **What counts as a file.** Not a size question. A click on `<a href="page.html">` must not be
   sent to the NAS. Candidates: the `download` attribute, a known-extension list, `Content-Type`
   from a preflight, or only acting on links Chrome itself would have downloaded. Each has a
   different false-positive profile, and a false positive here sends a web page to the NAS.
4. Does Shift-click keep its current meaning while this is on, or become the escape hatch that
   forces a *local* download?
5. Copy for the checkbox and its hint, sitting next to the torrent one without the two reading as
   duplicates.

**2026-09-13 — phase 1 scoped down: plain links only, no cleverness.** Redirects, signed/expiring
URLs, authenticated downloads and HEAD preflights are all **out of scope for v1**. This removes
the one thing that was a go/no-go: whether Download Station's fetcher follows redirects (GAP-15)
no longer gates this card, it is simply a case v1 does not serve.

One consequence has to be stated rather than assumed, because it is the gap between the intent and
what the code can actually know: **"simple link" is a scope decision, not a detection capability.**
Nothing in a synchronous click handler can tell a direct URL from one that will redirect — that is
only visible after a request, which is exactly the preflight v1 rejects. So a redirecting link
*will* be intercepted and handed to the NAS, and if Download Station cannot fetch it the task fails
there, visibly, like any other bad URL. That is the accepted v1 behaviour: no silent loss, no local
fallback for it, and no attempt to be clever. Resolving redirects before `AddUrl` stays GAP-15's
job, and becomes worth doing once v1 has shown how often people hit it.

**2026-09-13 — consulted, and the open questions above are now answered.** Second opinion taken
through the ChatGPT gateway (`gpt-5.6-sol-high`) with the code facts above. Every claim it made
that this card relies on was re-checked here rather than accepted.

**Q1 — mechanism: (a), and no hybrid.** `downloads.onCreated` is defined as firing once the
download has *begun*, so `cancel()` can only stop something already started — incompatible with
"any size, no bytes in the browser". The third option worth naming and closing:
`webRequest.onBeforeRequest` in blocking mode could cancel before the request leaves, but MV3
allows blocking `webRequest` only for policy-installed extensions, so a Web Store build cannot use
it. `declarativeNetRequest` cannot do a dynamic hand-off.

Explicitly **do not** run (a) and (b) from the same switch. One setting would then mean
"zero-byte intercept" for some downloads and "cancel after start" for others — two contracts
wearing one checkbox, which is the same mistake BUG-62 was about. `onCreated` stays the torrent
path and nothing else.

The `preventDefault()` decision must be synchronous; everything after it need not be.

**Q3 — what counts as a file.** A conservative synchronous classifier:

```
http(s) AND event.isTrusted AND plain primary click on an <a href>
AND ( anchor.hasAttribute("download") OR known extension in the URL *pathname* )
```

The pathname/query distinction is the sharp edge and is directly testable:
`/page?file=movie.mkv` is **not** a file, `/movie.mkv?token=abc` is. Case-insensitive.
Exclude `blob:`, `data:`, `javascript:`, `file:`, `mailto:` — the NAS cannot fetch any of them.

A HEAD preflight for `Content-Type` is rejected for v1: it cannot run inside the click handler,
HEAD often disagrees with GET, and plenty of servers answer 405 or redirect it to a login page.

**Do not intercept `.pdf` by default** unless the anchor carries `download` — the browser
expectation for a PDF link is the viewer, not a file. ISO/ZIP/7z/RAR/DMG/MSI/EXE/APK/IMG/MKV are
the uncontroversial ones.

**Q2 — failure.** After `preventDefault()` the click is gone; "not interfering" is no longer
available, so a fallback has to be started deliberately. Use `chrome.downloads.download({ url })`,
not `location.href` — it carries the host's cookies and returns a `downloadId`. **That id must go
into an ignore set**, or the fallback download is re-intercepted by the torrent path's `onCreated`
listener and the user gets a loop. Pass the anchor's `download` filename through, sanitised.

Two failures that are not the same:

- `AddUrl` itself fails (NAS offline, auth failed, HTTP error) → fall back automatically and say
  so once: *"NAS unavailable — downloading in browser instead."*
- `AddUrl` returns success and the task fails later on the NAS → **no** automatic fallback. The
  task may still recover, and a silent second transfer is a duplicate. This is the existing
  `markSendNotice` / notifier case.

**Q4 — auth and cookies: declared unsupported in v1.** There is no cheap reliable detection. An
unauthenticated HEAD returning 401/403 or a login redirect is a useful *negative* signal, but a
200 proves nothing — GET can behave differently, signed URLs may refuse HEAD, and servers check
`Referer`/UA/IP. Forwarding browser cookies into `AddUrl` is not on the table: QNAP DS V4 `AddUrl`
takes `url`/`temp`/`move`/`sid` and exposes no documented header or cookie channel, and adding the
`cookies` permission plus broad host permissions for an edge case is a real widening of the
security surface for a Web Store extension. The `.torrent` path dodges this only because it can
fetch a few KB in the page's own session and upload the bytes — a 4 GB file cannot be dodged that
way. Write the limitation into the hint text rather than half-solving it.

**Q4 addendum — measured on hardware 2026-09-13.** The failure was assumed to be silent corruption;
it is not. A server was pointed at the NAS returning the classic tracker response to an
unauthenticated client — HTTP 200 with an HTML login page — for a URL ending `.iso`:

```
AddUrl  -> {"error": 0}
Task/Query -> name='ubuntu-24.04.iso.html'  state=5 (finished)  size=87
```

**Download Station renames by content type.** The user gets `ubuntu-24.04.iso.html`, 87 bytes,
marked complete — not a broken 87-byte "ISO". So the limitation is visible rather than deceptive,
which lowers the cost of leaving it unsolved in v1 and makes the hint text the right remedy.
Worth knowing before anyone reopens the cookie-forwarding argument.

**Q5 — copy.** The checkbox sits under the existing torrent one; the hint has to carry both the
"any size" promise and the auth limitation without restating the torrent switch.

**GAP-15 becomes a prerequisite-adjacent card, not a neighbour.** Resolving redirects before
`AddUrl` stops being an edge case the moment this ships — see the measured redirect table in the
test plan below.

**Test plan**

Testability is genuinely good here, and specifically because the fixtures already exist:
`tests/e2e/fixtures/test-stand/index.html` already has a **Direct downloads** tab with
`stand-direct-iso` / `-mkv` / `-zip` / `-pdf`, all carrying a `download` attribute, and
`testStandHost.ts` already serves `/files/*` with a real body, a correct `Content-Type`
(`application/x-iso9660-image`, `video/x-matroska`, else `application/octet-stream`) and a
`Content-Disposition`. The mock NAS already logs every request.

What the stand still needs:

1. A file link **without** a `download` attribute (the extension-only path).
2. An extensionless link **with** `download`, and one **without** (must not intercept).
3. `/page.html?next=file.zip` and `/movie.mkv?token=abc` — the pathname-vs-query pair.
4. An ordinary page link, as the plain negative.
5. A `302` file URL, to pin the GAP-15 phenotype.
6. A guarded/`401` file endpoint — `guardedTrackerHost.ts` already refuses hotlinks and is the
   closest existing thing to reuse.
7. A slow or large body (`bodyDelayMs` already exists on the host), so "no bytes flowed" is
   provable rather than merely fast.

E2E scenarios, at minimum: default-off is inert; on + `.iso` sends and downloads nothing locally;
uppercase `.ZIP`; query-string cases both ways; page link not sent; `download`-attribute
extensionless yes / bare extensionless no; PDF not intercepted without `download`; nested
`<a><span>` click; `target="_blank"` produces a task and no new tab; Ctrl/Cmd/middle click left to
the browser; synthetic `el.click()` not intercepted (`isTrusted`); NAS failure produces exactly one
fallback download and one message; the fallback is not re-intercepted; routing rule match and
default destination; `blob:`/`data:` ignored; double-click behaviour decided and pinned; and the
existing torrent click and Shift-click unchanged.

**The strongest success assertion is a triple, not a single one:** NAS `AddUrl` seen once, the
origin file server's GET count for that path **zero**, and `chrome.downloads.search()` from the
service worker showing no new item. That proves no bytes flowed. Asserting only that Playwright
saw no `download` event is weaker than it looks — an extension-initiated
`chrome.downloads.download()` may not belong to that `Page` at all. For the browser-fallback path,
arm `page.waitForEvent("download")` **before** the click.

**2026-09-13 — phase 1 shipped.** `interceptFileLinks`, off in `DEFAULTS`, and a second checkbox
under the torrent one. A plain trusted click on `<a href>` is claimed when the anchor carries
`download` or the URL's **pathname** ends in one of `DOWNLOADABLE_FILE_EXTENSIONS`, and the URL
goes through the same `link:send` path the Shift gesture already used — so routing rules, the
`temp`/`move` fields and the failure toast came for free.

Decisions worth keeping, because each closes a way this could have gone wrong:

- **`.torrent` is excluded twice** — absent from the extension list *and* rejected outright by
  `isDownloadableFileUrl`, including when the anchor says `download`. Without that, ticking this
  checkbox would silently convert torrents from "mirror, keep the local copy" to NAS-only.
- **The extension is read from the pathname, never the query.** `/movie.mkv?token=abc` is a file;
  `/page?file=movie.mkv` is a page, and sending it would put an HTML document into Download
  Station.
- **`.pdf` is not in the list**, because a PDF link is expected to open in the viewer — but
  `download` overrides that, so the two PDF cards on the stand are a matched pair.
- The file branch runs **last** in the click handler, after Shift and magnet, so neither can be
  reached by it.

**One deviation from the design above, made deliberately.** The brief chose automatic fallback to
`chrome.downloads.download()` when `AddUrl` fails. Shipped instead: the existing failure toast,
with *Retry* and *Open locally*. Reasons — silently starting a multi-gigabyte browser download
because the NAS was briefly unreachable is a worse default than asking, the feature's whole
premise is that these files are too big to want locally, and the toast already exists and is
tested. The ignore-set trap the brief identified turns out not to arise either: the fallback path
is a `.iso`, `handleDownloadCreated` only claims torrents, so no loop is possible. If the toast
proves annoying in use, auto-fallback is still available — but it should be chosen from evidence,
not assumed.

**Also shipped:** `interceptFileLinks` added to the backup's `PORTABLE_KEYS` with an import that
only honours the key when it is actually present, so a backup written before this setting existed
leaves it off.

**Tests:** +19 unit (502 total) — the classifier table in `sourceKind.test.ts` and
`getFileSendUrl` in `magnet.test.ts`, covering synthetic clicks, modifiers, Shift, and the
query/path pair — plus a new `tests/e2e/file-interception.spec.ts` (45 E2E total) added to the
`test:e2e:mock` list. Its success assertion is the triple the brief asked for: `AddUrl` seen once,
**zero GETs at the origin for that path**, and no new `chrome.downloads` item. The stand grew six
cards for the cases that had no fixture, including the two that must *not* be sent.

**Still out of scope, as scoped:** redirects, signed/expiring URLs, authenticated downloads. A
redirecting link is still intercepted and still handed to the NAS — nothing in a click handler can
tell it apart — and fails visibly there if Download Station cannot fetch it. GAP-15 is the card
for that.

**Updated by GAP-16 on 2026-09-15.** The ordinary-file rules remain: the checkbox is off by
default, Shift sends one file while it is off, and a claimed link falls back to normal browser
navigation automatically when the NAS hand-off fails. Torrent files and magnets no longer share
this switch or Shift rule; they are automatic and have their own browser/native-handler fallback.
The historical design discussion above describes the phase-1 implementation, not the current
torrent contract.

**Acceptance criteria (draft, to be confirmed once the questions above are answered)**

1. With the switch off, nothing about ordinary downloads changes — this is the default, so it is
   the case that must be provably inert.
2. With the switch on, a click on a direct file link creates a Download Station task and no local
   file, at any size, with no threshold anywhere in the code or the settings.
3. Routing rules apply to it exactly as they do to every other send path.
4. A NAS that refuses or is unreachable leaves the user with the file, not with nothing.
5. A click on an ordinary page is never sent to the NAS.
6. The switch is off in `DEFAULTS`, and a settings import that does not mention it leaves it off.
