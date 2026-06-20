# Feature roadmap — competitor-informed

Derived from teardown of three Firefox competitors (June 2026):

- **Send To QNAP++** (MV2, feature-rich) — folder routing rules, offline queue with
  backoff, quick-add, undo, file-type icons, File-Station folder validation.
- **Download Station (Synology)** (MV3, clean) — session keepalive, `storage.session`
  SID cache, single-flight re-auth wrapper, magnet content-script capture, API
  version auto-discovery.
- **SendToQnap (Wolff)** (MV2, abandoned) — nothing we lack.

Competitors are licensed permissively/copyleft-lite (QNAP ones MPL-2.0; Synology's AMO
listing says MPL-2.0 but its bundled README says MIT) — we borrow **ideas**, reimplement in
our Svelte 5 / TS / MV3 stack.

> **Reviewed by codex (gpt-5.5, 2026-06-20).** Must-fixes from that pass are folded into the
> sections below — most importantly: F1's path model is not yet proven (Misc/Dir path format
> + nested listing are a hard gate), and parts of F2/F6 are already shipped.

Priority order below is value-for-effort. **F1 (folder validation) is the committed first
deliverable.**

---

## F1 — Folder path validation with inline state (committed)

### Goal

When a user types/pastes a Temp or Target folder in Settings, confirm it exists on the NAS
and is writable. Invalid → red ring on the input + message. Valid → green check. Block the
save (or warn) on an unvalidated/invalid path so `AddUrl` never fails later with a cryptic
`temp`/`move` error.

### Why our approach beats `++`'s

`++` opens a *separate* File Station session (`/cgi-bin/authLogin.cgi` →
`/cgi-bin/filemanager/utilRequest.cgi?func=stat`) and parses XML + JSON `{status, datas:[{exist,isfolder}]}`.
We already enumerate folders through Download Station's own
`POST /downloadstation/V4/Misc/Dir` (`ApiClient.listDir(path)` → `DirEntry[]` with
`path`, `dir`, `writtable`). So validation reuses the existing authenticated DS session and
the existing endpoint — no second login, no XML, no extra `cookies`/host permissions.

> ✅ **HARD GATE RESOLVED — verified on live NAS `192.168.88.185:8080` (2026-06-20):**
> 1. **Nested listing works.** `Misc/Dir` with `path="Multimedia"` returns its children
>    (`{dir:"Books", path:"Multimedia/Books", writtable:true}`, …) at any depth.
> 2. **Paths are RELATIVE, no leading slash.** Top-level entries are `Download`, `Movies`, …
>    (`base_path:""`); nested entries carry the full relative path `Multimedia/Books`.
>    An absolute path `/share/Download` is **rejected** with `error 4096, reason:"path"`.
> 3. **A missing folder returns `error 4096, reason:"path"`** — not an empty list. So existence
>    is unambiguous: success ⇒ exists, `4096`/`path` ⇒ does not exist.
>
> This makes validation simpler and removes the false-red-ring risk entirely (we get a definite
> not-found signal, and writability comes from the parent listing's `writtable`).

**Validation algorithm** (finalized against the live API)

1. **Normalize to relative**: strip leading and trailing `/`. If the user typed an absolute
   `/share/...`, drop the leading slash (and, if needed, a `share/` prefix) — absolute is
   rejected by the API. `""` ⇒ root ⇒ `valid`.
2. Split into `{ parent, name }` on the last `/`.
3. `listDir(parent)` (parent `""` for a top-level folder):
   - **success** → find the entry whose `path === normalized` (or `dir === name`):
     - found and `writtable` → `valid`
     - found and `!writtable` → `invalid: "Folder is read-only"`
     - absent → `invalid: "Folder not found"` (parent listed fine, target genuinely missing)
   - **`error 4096` / `reason:"path"`** (parent itself doesn't exist) → `invalid: "Folder not found"`
   - **login / network / timeout / other error** → `error` (unverifiable; amber note,
     **no red ring** — don't punish offline users).
4. Reading the target's own `writtable` requires the parent listing (the folder's own
   `listDir` response only carries its children), so always validate via the parent.

### Component design — `FolderSelect.svelte`

State machine (one `$state`): `"idle" | "validating" | "valid" | "invalid" | "error"`.
Add `reason` string for the message.

- Add a `bind:valid` (or `bind:status`) prop so `Settings.svelte` can gate save.
- Triggers:
  - `choose(entry)` from the dropdown → status `valid` immediately (it came from the
    writable list; `disabled` already blocks read-only ones). Store the entry's canonical
    `DirEntry.path` as the value, and invalidate validity if settings/the value change later.
  - `onblur` of the input → run `validate()` (skip if value unchanged since last check).
  - debounced (~500 ms) after typing stops → `validate()` for live feedback.
  - on Settings "Test connection" / before save → `validate()` and await.
- Cancellation: guard against races — stamp each validate call with an incrementing id;
  ignore results from stale calls (user kept typing).
- Reuse the folder cache: `getTopLevelFolders` caches top-level only; add a small
  parent-listing cache keyed by `signature|parent` so repeated blurs don't re-hit the NAS.

### UX — the red ring

- `invalid` → input gets `.is-invalid` (1px `#d32f2f` border + `box-shadow: 0 0 0 2px rgba(211,47,47,.25)` ring) and a trailing ✕ glyph; message under the field in `.ds-error`.
- `valid` → trailing ✓ in green (`#2e7d32`); no ring.
- `validating` → trailing spinner; no ring.
- `error` → neutral amber note "Couldn't verify (NAS unreachable)"; no red ring.
- Honour dark theme + reduced-motion (no spinner animation when `prefers-reduced-motion`).
- a11y: `aria-invalid={status === "invalid"}` on the input; message in an
  `aria-live="polite"` region.

### Settings integration — `Settings.svelte`

- Track validity of both `NAStempdir` and `NASdir` (`let tempValid`, `let dirValid` via
  `bind:`).
- On Save: if either is `invalid`, block + focus the offending field. If `error`
  (unverifiable), allow save but surface a one-line warning toast ("saved, but folders
  couldn't be checked").
- `NASdir` (move/target) policy: ⚠️ do **not** assume empty Target = "leave in temp".
  `src/api/client.ts` (AddUrl) notes QNAP DS V4 requires **both** `temp` and `move`
  (confirmed in `qnap-ds-api-verified`). Verify what an empty `move` does for both `AddUrl`
  **and** `AddTorrent` before allowing it; until then treat Target as required and validated,
  same as Temp.

### Tests

- Unit: `validateFolder()` against a mocked `listDir` — found-writable, found-readonly,
  not-found, listDir-throws. Path normalization table (trailing slash, missing leading
  slash, root, nested).
- Component (if we add Svelte testing) or extend the popup E2E
  (`tests/e2e/popup.full-cycle.spec.ts`) with a mock-NAS folder that fails validation →
  assert red ring + blocked save.
- Keep the gate green: `typecheck → check:svelte → lint → test → build → e2e:mock`.

### TODO

- [x] Confirm `Misc/Dir` returns children for a nested `path` on the live NAS. ✅ done
      2026-06-20 (relative paths, nested OK, missing ⇒ `error 4096/path`).
- [x] `validateFolder(raw, listDir)` + `normalizeFolderPath` —
      `src/popup/features/folderPicker/validateFolder.ts` (parent-listing strategy; `4096`
      ⇒ invalid; other throws ⇒ unverifiable `error`).
- [x] `FolderSelect.svelte`: status state machine, validate on blur + on dropdown-choose,
      race-guard token, trailing indicator (✓/✕/⚠/spinner), red-ring + reduced-motion styles,
      `aria-invalid` + `aria-live` message, `bind:status`.
- [x] `Settings.svelte`: bind both fields' status, block save on `invalid`, placeholders
      switched to relative (`Download`, `Multimedia/Movies`).
- [x] Unit tests for `validateFolder` + normalization (20 cases, all green).
- [x] Extend mock-NAS with `Misc/Dir` (nested tree + `4096` for unknown paths).
- [ ] *(follow-up)* Parent-listing cache in `folderCache.ts` keyed by `signature|parent`
      (validation currently hits the NAS on each blur — fine for now).
- [ ] *(follow-up)* Dedicated E2E spec asserting the red ring + blocked save (mock already
      supports it).
- [ ] *(follow-up)* Focus the offending field on blocked save; decide empty-Target policy
      once empty `move` behavior is confirmed for `AddUrl`/`AddTorrent`.

---

## F2 — Session hardening (re-scoped after codex review)

⚠️ **Much of this is already shipped** — do not rebuild: `src/api/index.ts` already does
single-flight login (`:71`) and already retries a URL-encoded request once on session expiry
(`:149`). So the original "withSession wrapper" and "re-auth on code 5" items are **done**.

**Audited 2026-06-20 — F2 is effectively complete; remaining items are intentionally not done:**

### TODO

- [x] Single-flight login + re-login-and-replay on session expiry — already in
      `src/api/index.ts` (`createSidMiddleware`).
- [x] Badge preserved on transient poll errors — `alarms.ts:96-99` catches and continues
      without clearing the badge. Verified, no change needed.
- [x] `AddTorrent` retry — N/A: `addTorrent` calls `performLogin` for a **fresh** sid on
      every upload, so it never carries a stale sid; no retry path required.
- [ ] ~~SID persistence in `storage.session`~~ — **consciously skipped.** Benefit is marginal
      (saves one ~100-300ms login after a service-worker wake; the existing expiry-retry
      already covers correctness) and it adds an async storage read to every request. Not
      worth the complexity.
- [ ] **Keepalive alarm — deliberately NOT added** (battery/privacy; we self-disarm at idle).

---

## F3 — Folder routing rules (from `++`, flagship feature)

Auto-route a download to a destination by rule instead of always using the single Target.
This is the biggest functional differentiator among QNAP FF clients.

### Design

- Rule shape: `{ when: { type?: "magnet"|"torrent"|"url", namePattern?: string, domain?: string }, destination: string }`.
- Evaluation: top-to-bottom, first match wins; fall back to `NASdir`.
- Matchers: `namePattern` glob (`*.mkv`, `*2024*`) → anchored regex; `domain` with optional
  `*.` subdomain prefix; `type` from the link kind we already detect when sending.
- Each rule's `destination` reuses F1 validation (a rule pointing at a missing folder is
  flagged in the editor).
- Storage: new `routingRules` array in settings; surface in Settings under the folders
  section.

### TODO

- [x] Settings type + storage load/sanitize for `routingRules` (`config.ts`, `settings.ts`
      `sanitizeRoutingRules`). Save persists via the existing `{...settings}` spread.
- [x] Matcher module + unit tests — `src/lib/routingRules.ts` (`classifyUrl`,
      `resolveDestination`, glob→regex, `*.` domain, AND of conditions, first-match, fallback,
      empty-destination skip). 19 tests, all green.
- [x] Wired into the **context-menu** send path (`menus.ts` → `resolveDestination` → `addUrl`
      `{ targetFolder }`). Primary case (no per-send folder UI).
- [x] Rules editor UI in `Settings.svelte` (add/remove, type select, name/domain inputs,
      per-rule `FolderSelect` — which shows its own F1 red-ring validation; incomplete rules
      dropped on save).
- [x] Wired the auto/no-UI send paths: `.torrent` interception auto-send (`downloads.ts`
      `sendAndNotify`) and the Chooser pre-fill (`Chooser.svelte`) now resolve the destination
      from rules via `sendTorrentUrlToNas`'s `folder` arg. Popup quick-add (`CreateUrls.svelte`)
      keeps its explicit folder picker, so rules are intentionally not forced there.
- [ ] *(follow-up)* Rule reorder (drag/up-down) and gate save on an invalid rule destination.
- [ ] *(follow-up)* E2E: rule matches → correct `move` sent (matcher is unit-covered).

---

## Already shipped — do NOT re-build (verified in our code, 2026-06-20)

A teardown comparison confirmed we already have several things competitors are praised for.
Do not duplicate these:

- **Animated activity icon** — `src/background/actions.ts` `startIconAnimation()` already
  renders frames via `OffscreenCanvas` + `action.setIcon({imageData})` (the MV3-correct way;
  Wolff's spinner is MV2-only). Verify it stops on idle (`stopIconAnimation`) — that's all.
- **Badge with active count + rich tooltip** — `updateStatsBadge()` (count, green, ↓/↑ rates).
  Better than Synology's. Keep.
- **Alarm-based status polling** — `src/background/alarms.ts` (30s, self-disarms when idle).
- **Quick-add (multi-line URL/magnet)** — `src/popup/features/upload/CreateUrls.svelte`.
- **`.torrent` download interception** — `src/background/downloads.ts`
  (`torrentInterceptMode` off/ask/always) + intercept/resume notifications.

---

## F4 — UX quick wins (scoped to real gaps)

Small, independent, high-delight. Quick-add already exists (see above) — dropped.

### TODO

- [ ] **Magnet content-script capture** (opt-in) — *real gap*. We intercept `.torrent`
      *files* via the downloads API, but `magnet:` clicks never hit that API (the browser
      hands them to an external app). A content script at `document_start`, capture-phase on
      `a[href^="magnet:"]` → `preventDefault` → send to NAS closes this. Gate behind an
      `autoCaptureMagnets` setting with live `storage.onChanged` update. Complements — does
      not duplicate — the existing torrent interception. Review the `<all_urls>` content-script
      permission + AMO data-disclosure impact vs. the current manifest.
- [ ] **Undo on remove** — *deferred (needs new UI infra).* Removal is an immediate NAS API
      call (`removeDownload` → `client.removeTask`); a true undo means delaying the call + a
      toast-with-action affordance, which our transient `showStatus` banner doesn't support.
      More than a small change — revisit when we add an action-capable toast.
- [x] **Settings backup/restore** — `settingsBackup.ts` (`exportSettings`/`parseImportedSettings`,
      7 tests) + Export/Import buttons in `Settings.svelte`. Credentials are never exported;
      import validates + drops bad keys and loads into the form for review before Save.

---

## F5 — License & store metadata

### License — DECISION: permissive (MIT or Apache-2.0)

We will **not** publish our TS source. MPL-2.0 is therefore unsuitable — it isn't "wrong for a
compiled bundle" per se, but it's **incompatible with keeping covered source unpublished**:
MPL is file-level copyleft, and Mozilla's MPL FAQ is explicit that minified/compiled JS is
"executable form" whose recipients must be told how to obtain the corresponding source. The
current `CC-BY-NC-SA-4.0` is a **bad fit for software** (Creative Commons itself says CC
licenses lack software-specific source-code and patent terms and aren't compatible with major
software licenses) — and the **NC** clause also blocks any future donations/monetization. We
adopt a **permissive license: MIT or Apache-2.0**, which carry no source-publication duty.

- **MIT** — shortest, most recognised, zero ceremony. Recommended default.
- **Apache-2.0** — same permissions plus an explicit patent grant and a `NOTICE` mechanism;
  pick this only if patent protection matters to us.

Permissive licenses do **not** force publishing our TS source — only that the license/notice
travels with whatever we distribute (the built JS). This matches "we don't give sources" while
keeping clean OSS optics like the competitors.

### Repo changes — DONE (MIT, 2026-06-20)

- [x] Chose **MIT**.
- [x] `package.json` + `package-lock.json` → `"license": "MIT"`.
- [x] `LICENSE.md` rewritten to MIT (2026, QuickGet Remote Contributors); un-ignored in
      `.gitignore`.
- [x] `README.md` License section updated.
- [ ] *(at submit time)* AMO listing license dropdown → MIT; check `privacy-policy.md` /
      `firefox-release-guide.md` mentions.
- [ ] AMO submission: select the matching license; compiled bundle still needs the
      **reviewer source package** (already covered in `firefox-release-guide.md`).

---

## F6 — Notifications (scoped to real gaps)

Badge + animated icon already exist (see "Already shipped"). Only these are gaps:

### TODO

- [x] **Add-failure notification** — already covered. The popup add paths
      (`batchUpload.ts`, `torrentUpload.ts`) already catch errors and surface the reason via
      `showStatus` (`Error: <message>`, `Added X, failed Y`, duplicate handling); menu +
      interception paths notify too. No gap.
- [ ] **Completion notification with dedup** — *deferred (conflicts with a deliberate design).*
      The poll deliberately uses the **cheap aggregate** `Task/Status` (`alarms.ts` doc comment).
      Detecting a per-hash downloading→completed transition would force a per-task `Task/Query`
      on every 30s tick plus a persisted "announced" set — heavier polling against an explicit
      perf choice. Revisit only if we decide the notification is worth that cost.

### Deferred — large-download hijack (`++`)

**Decision: NOT now.** This is not a feature but a *scope expansion* of our existing
`.torrent` interception to every large file. It needs broad `downloads`+`webNavigation`+
`cookies` permissions, is intrusive (cancels the user's own downloads), and risks two divergent
intercept mechanisms. Revisit only as a separate, explicitly opt-in feature, after reconciling
with `src/background/downloads.ts`.

---

## F7 — Product description & store presentation (final polish)

Do this **last**, once the feature set above is settled, so copy and screenshots match
reality. Goal: a listing that converts as well as competitors' but leads with our edge
(modern, cross-browser MV3, torrent + magnet + URL, no telemetry).

### TODO

- [ ] **Store summary (one-liner)** — crisp, benefit-first. Borrow competitor framing
      ("send downloads & magnets to your QNAP, watch progress"), keep our hook (privacy / no
      tracking / open-source).
- [ ] **Full description** — structured bullets: right-click send · magnet + URL + `.torrent`
      · live progress with status filter · folder picker/validation · DS5/QTS5 compatibility
      line · explicit "no analytics, data only goes to your NAS".
- [ ] **Screenshots / store assets** — refreshed popup (downloads list + filter), settings
      with folder validation, send-flow; consistent theme; correct sizes for AMO + Chrome Web
      Store.
- [ ] **README** — align the feature list, screenshots, and the new license badge.
- [ ] **`manifest*.json` description** — keep the short description consistent with the store
      one-liner across Chrome + Firefox manifests.
- [ ] Re-read `docs/firefox-release-guide.md` AMO checklist so listing copy + data-disclosure
      stay in sync.

---

### Skip / avoid (anti-patterns seen in competitors)

- MV2 / `browser_action` (we're MV3 `action`).
- Plaintext password as a "feature"; base64 ≠ encryption.
- External-CDN auth-helper manifest (Google Drive) for cookie/referer injection — dubious
  trust model; only consider a fully-local equivalent with explicit consent.
- Hardcoded numeric state strings (`state === "5"`) and global `var` soup.
