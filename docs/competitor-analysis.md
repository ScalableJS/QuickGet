# Competitive analysis — Firefox clients for QNAP/Synology Download Station

Analysis date: June 2026. Competitor sources pulled from AMO as `.xpi` and unpacked
(`scratchpad/competitors/`). Licenses — we copy **ideas**, not code.

Feature borrowing plan: see [feature-roadmap.md](./feature-roadmap.md).

## Who's in scope

| Add-on | Author | NAS | Manifest | Version / updated | Users | Reviews | AMO |
|---|---|---|---|---|---|---|---|
| **SendToQnap** | Frederic Wolff | QNAP | MV2 | 2.7 — Mar 2024 (abandoned) | 112 | 5 (5.0★) | [link](https://addons.mozilla.org/firefox/addon/sendtoqnap/) |
| **Send To QNAP++** | Proƒ. Tomørrøw | QNAP | MV2 | 2.30.15 — Apr 2026 (alive) | 15 | 1 (5.0★) | [link](https://addons.mozilla.org/firefox/addon/sendtoqnapplus/) |
| **Download Station** | Kaakati | Synology | MV3 | 1.0.0 — Feb 2026 | 41 | 2 (3.0★) | [link](https://addons.mozilla.org/firefox/addon/download-station-synology/) |
| **QuickGet Remote** (us) | — | QNAP DS5 | MV3 | 2.9.0 | — | — | in prep |

---

## 1. Technology stack

**Conclusion: none of the competitors use a JS framework, bundler, or TypeScript. Pure
hand-written vanilla JS, no minification, no build step.** We are the only ones on
Svelte 5 + TS + Vite. This is the main technical lead.

| | Language | Framework | Bundler | CSS | Other |
|---|---|---|---|---|---|
| **SendToQnap (Wolff)** | vanilla JS (ES5-style, `var`) | none | none (raw files) | hand-written CSS | own `xmlToJSON.js` (~240 lines) for parsing `authLogin.cgi` XML; DOMParser + ActiveXObject fallback (legacy IE) |
| **Send To QNAP++** | vanilla JS, global `var`s across files | none | none | hand-written CSS | ~6.7k lines hand-written; background `common.js`+`SendLink.js`; optional external auth-helper (manifest with Google Drive) |
| **Download Station (Synology)** | vanilla JS, modern (`browser.*`, Promise, modular) | none | **only for CSS** | **Tailwind CSS** (build output) + self-hosted Outfit font (woff2) | clean MV3 SW pattern; README + `web-ext` dev flow; no source maps |
| **QuickGet Remote (us)** | **TypeScript** | **Svelte 5 (runes)** | **Vite + @crxjs** | own CSS | Vitest + Playwright, Biome, icon generation, MV3 cross-browser |

Build signs: nobody has `sourceMappingURL`; longest lines are 89–200 characters
(just long URLs, not minification) → code is written and committed by hand. Synology only
runs Tailwind for CSS, doesn't bundle JS.

---

## 2. Application size

| Add-on | XPI (compressed) | Unpacked | JS (lines) | Composition |
|---|---|---|---|---|
| **SendToQnap (Wolff)** | 50 KB | ~136 KB | ~1,575 | 4 JS files, 1 popup, 4 icons |
| **Send To QNAP++** | 168 KB | ~528 KB | ~6,680 | 5 JS, popup + options (backup/restore), 6 icons — the "heaviest" by code |
| **Download Station (Synology)** | 85 KB | ~164 KB | ~900 | background+content+popup, Tailwind CSS, 2 woff2 fonts, README |
| **QuickGet Remote (us)** | **58 KB** (FF zip) | — | — | Svelte components compile → 4 JS chunks + CSS (popup bundle ~37 KB / gzip 11.6 KB) |

Bottom line: `++` leads in code volume (feature-rich, but not compressed), Synology is
compact and tidy, Wolff is minimal. Our signed FF zip (58 KB) is comparable to Wolff despite
much bigger functionality — thanks to Svelte compilation and gzip.

---

## 3. Licenses

| Add-on | License (AMO) | In package | Note |
|---|---|---|---|
| **SendToQnap (Wolff)** | MPL-2.0 | — | source open: [github.com/garoloup/SendToQNAP](https://github.com/garoloup/SendToQNAP) |
| **Send To QNAP++** | MPL-2.0 | — | no repo, only a signed XPI |
| **Download Station (Synology)** | MPL-2.0 | README says **MIT** | ⚠️ mismatch: AMO listing — MPL-2.0, README in package — MIT |
| **QuickGet Remote (us)** | — | **CC-BY-NC-SA-4.0** | we have **non-commercial** copyleft — noticeably stricter and more unusual for an extension than the competitors' permissive/MPL licenses |

All competitors are under OSS licenses (MPL-2.0 / MIT). Legally: their code can't be
borrowed without complying with the license — we only take ideas and implement ourselves.

Our `CC-BY-NC-SA-4.0` deserves a deliberate reconsideration: CC licenses aren't designed for
software (no patent grant, ambiguous terms for code), and the **NC** clause bans commercial
use — if we ever want monetization or donations, this needs to be accounted for.

---

## 4. Monetization and donations

**Conclusion: none of the three competitors have any monetization.** No donation links, no
sponsors, no premium tiers, no license keys, no paywall.

Checked via grep across all sources — matches turned out to be false positives:
- `stripE` → `stripElemPrefix` (an option in `xmlToJSON.js`);
- `premium` / "Premium account required" → this is a **QNAP DS API error string (code 16)**
  for premium file-hoster accounts, not extension monetization.

| Add-on | Donations/sponsors | Paid features | Support |
|---|---|---|---|
| **SendToQnap (Wolff)** | none | none | email `fredwolff70@gmail.com` |
| **Send To QNAP++** | none | none | email `sendtoqnapplus@gmail.com` |
| **Download Station (Synology)** | none | none | README, no repo/contact on the page |

**Strategic conclusion.** The niche is entirely free and unmonetized → authors have little
incentive to maintain it (Wolff abandoned since 2024). This is simultaneously:
- **an opportunity** — the market is underserved, whoever just does it well and regularly
  wins;
- **a signal** — the niche hasn't proven profitable; if we think about donations (Ko-fi /
  GitHub Sponsors / Buy Me a Coffee), it would be the first precedent in the category, and
  we'd need to lift the NC restriction in the license first.

---

## 5. Reviews (condensed)

Almost no substantive feedback — everyone has a handful of reviews, virtually no complaints
or feature requests:

- **Wolff** (5×5★, 2020–2022): "It just works!", "truly amazing", "easy configuration".
  A tip for newcomers in a review: "default HTTPS port is 443" → hints that **port/HTTPS
  setup confuses people**.
- **++** (1×5★, Jan 2026): "works great".
- **Synology** (3.0★): one 5★ "Simple. Flawless. Works.", one 1★ — **text hidden**, no
  specifics.

The market doesn't generate user signals → our differentiator isn't "features from reviews"
but **completeness, modernity, and stability** (MV3, torrents, DS5, tests, regular releases).

---

## 6. Link interception, icon animation, notifications (additional analysis)

### 6.1 Link interception for auto-download

Two different philosophies — and both "alive" competitors intercept something, Wolff
doesn't.

| Add-on | Intercepts? | Mechanism |
|---|---|---|
| **Wolff** | ❌ no | only context menu (right-click → "Send to QNAP") |
| **Send To QNAP++** | ✅ yes, **browser download interception** | (1) `chrome.downloads.onCreated`/`onChanged` — catches real downloads; size threshold (default **500 MB**, configurable); size preflight via `HEAD` + `GET Range: bytes=0-0` (reads `content-range`); cancels the browser download (`downloads.cancel`+`erase`) and re-sends to QNAP. Domain exclusion list (wildcards). Bypass — hold **Ctrl**. (2) `webNavigation.onCommitted` — catches navigation to a direct file URL. Requires `downloads`+`webNavigation`+`cookies` permissions. **No content script** — doesn't catch magnet clicks this way. |
| **Synology** | ✅ yes, **magnet click interception** | `content.js` on all pages, capture phase, intercepts clicks on `a[href^="magnet:"]`, `preventDefault` → sends the magnet to the NAS. `autoCaptureMagnets` toggle, live update via `storage.onChanged`. Doesn't touch large files. |

Bottom line: `++` = heavy download/navigation interception (powerful, but broad permissions,
MV2-style). Synology = lightweight magnet-click-only interception (content script). We
currently have "Chromium-only" torrent interception — worth checking which of these
approaches we implement and under MV3.

### 6.2 Icon animation during activity

| Add-on | Animation | How |
|---|---|---|
| **Wolff** | ✅ yes, the most elaborate | canvas draws a **spinning 30 fps spinner** (`setInterval(…,1000/30)` → `browserAction.setIcon({imageData})`) while downloads are in progress; + `displayProgressIndicator` overlays progress on the icon |
| **Send To QNAP++** | ❌ no | swaps static icons (`setIcon({path})`) + text badge (`+1`/`Q+`/`dup`/`Err`) |
| **Synology** | ❌ no | text badge with active count, red background `#ef4444` |

⚠️ **Important for us (MV3):** Wolff's animated icon is only possible in MV2 (background
page with DOM+canvas). In MV3 the service worker has no DOM — rendering the icon needs
`OffscreenCanvas`, noticeably more complex and battery-costly. Pragmatic path — **a badge
with the active-task count (like Synology)**, no animation; treat animation as an optional
"nice-to-have" upgrade via OffscreenCanvas.

### 6.3 Notifications — what's worth taking

| Add-on | Notifications | Useful bits |
|---|---|---|
| **Wolff** | ❌ no (no `notifications` permission) | badge text only |
| **Send To QNAP++** | ✅ yes | (1) **task completion** with dedup by hash (`qnap_done_${hash}`, FIFO cap), `notifyOnComplete` toggle; (2) **large download interception** ("file (size) → QNAP") |
| **Synology** | ✅ yes, basic | on add (success), on **API error** (with code), on exclusion; no completion notification |

Worth taking: **task completion notification with dedup** (++) — the most valuable one;
**add-error notification** (Synology) — useful for feedback; interception notification — if
we ever build download interception.

> **Open gaps from this analysis are tracked as cards** in
> [`../agent-os/product/competitive-gaps-kanban.md`](../agent-os/product/competitive-gaps-kanban.md),
> together with the user-review evidence gathered on 2026-08-31 and the list of things we
> deliberately do not copy.

## Summary: where we lead and what to take

**We're already ahead on:** MV3 (cross-browser), Svelte 5 + TS, torrent files + magnet +
URL, tests (Vitest/Playwright), Biome, validatable build, status filters, folder picker via
`Misc/Dir`.

**What to take (details and TODOs — in [feature-roadmap.md](./feature-roadmap.md)):**
1. **F1 — folder validation** (idea from `++`, but through our `Misc/Dir`, not File Station)
   + red outline on an invalid field. ← top priority.
2. **F2 — session hardening** (from Synology): keepalive alarm, SID in `storage.session`,
   single-flight auto-relogin.
3. **F3 — folder routing rules** (flagship feature from `++`).
4. **F4 — quick wins**: quick-add, undo on delete, magnet content-script capture,
   backup/restore, notification dedup.

**What NOT to repeat:** MV2/`browser_action`, plaintext password, base64 "as protection",
external auth-helper with Google Drive, global `var`s, hardcoded numeric states
(`state==="5"`).

---

## 7. How major players handle private trackers (August 2026)

Analysis of recent Chrome builds pulled from the Web Store and unpacked. Only minified
bundles were read, so what follows is only what's confirmed by a concrete code fragment;
marketing descriptions were not considered.

| Extension | ID | Version | Relevant permissions |
|---|---|---|---|
| Synology Download Station client | `ebbdkled…` | 4.2.0 | `scripting`, `tabs`, `downloads`, content scripts |
| Download Master (WestByte) | `dljdacfoj…` | 4.1.0 | `cookies`, `webRequest`, `scripting`, `nativeMessaging` |
| ASUS Download Master | `fdbepfmlo…` | 1.2.0 | only `storage`, `contextMenus`, `notifications` |

### Synology: hands the NAS a bare URL

`InterceptService.transfer` — their entire interception:

```js
DownloadService.pause(download.id).pipe(
  switchMap(() => QueryService.createTask({ url: [download.finalUrl] },
                                          { source: download.referrer })),
  ...error: resume / erase
```

The order matches ours (pause → task on NAS → erase/resume on error), but what reaches the
NAS is **`finalUrl`**, not the file. `source: download.referrer` looks like a fix for the
hotlink problem — it isn't: `source` only reaches
`NotificationService.taskCreated(...)` and the `contextMessage` in the error text. It has no
effect on the request itself.

So on a closed tracker, their NAS gets the same login page we would. Their workaround is
manual: the task-creation form has an `<input type="file">` (`torrent_file_label`) — the user
downloads the `.torrent` to disk themselves and picks the file.

### Download Master: cookies and referer are handed to the downloader

The only one that actually addresses the problem — but via a native app:

```js
EXT.settings.sendCookiesForDM
  ? EXT.promise.cookies.getAll({ url: e.referrer })
  : []
→ sendNativeMessage("com.westbyte.downloadmaster",
    { method: "downloadFile", url, referrer, cookies, filename })
```

The extension downloads nothing itself. It collects cookies for the referrer's domain and
passes `url + referrer + cookies` to a native app on the same machine, which downloads with
the headers attached. This path is closed to us: it requires an installed native host, and
the NAS is supposed to do the downloading.

Tellingly, sending cookies is an **option** for them (`sendCookiesForDM`), toggleable off:
handing session cookies to an external process is unsafe.

### ASUS: doesn't solve it at all

No `downloads`, no `scripting`, no content scripts. Only a context menu handing a URL to the
router. Doesn't work on a private tracker by design.

### Where we stand relative to them

Our approach — grab the `.torrent` in the browser in the page's context and upload it to the
NAS as a file (`AddTorrent`) — is strictly stronger:

- unlike Synology, it works on a closed tracker without a manual download;
- unlike Download Master, it doesn't require a native app and **doesn't move cookies outside
  the browser** — the request runs where the session lives, only the torrent file itself
  leaves;
- the NAS never talks to the tracker at all, so neither its cookies nor its IP need to be
  allowlisted.

The cost — the site's tab has to be open. Competitors don't have this limitation simply
because they don't support this scenario.

### What's worth taking

1. **`chrome.downloads.onDeterminingFilename`** — Synology listens to it alongside
   `onCreated` and `onChanged`. The event gives the final filename before it's written to
   disk, i.e. it recognizes a `.torrent` behind an opaque endpoint earlier than we do.
2. **`erase` as an alternative to `cancel`** — for them it's a setting (`{ erase, resume }`).
   We always leave the cancelled download in the list; the choice could be up to the user.

### Default folders — what competitors do (checked 2026-08-28)

Reason for checking: should we pre-fill the Temp Folder, since Download Station rejects any
task without one.

**QNAP Download Station Manager** (`agbfjhjpdmkibfdlbpjmlmhdkbmcgjpm`, v1.0.8) — a direct
competitor on the same NAS. Pre-fills, with two ready-made profiles at once:

```js
defaultState: { NasConnectionSettings: { url: "", username: "", password: "", folders: [
  { name: "Movies",    tempFolder: "Content/@DownloadStationTempFiles", moveFolder: "Content/Movies" },
  { name: "TV Series", tempFolder: "Content/@DownloadStationTempFiles", moveFolder: "Content/TV Series" },
]}}
```

`@DownloadStationTempFiles` — a service folder that Download Station itself creates. The
`Content/` prefix is that particular author's NAS layout, most people don't have it, so these
paths can't be copied. But the fact itself stands: **a developer who knows QNAP considered an
empty field unacceptable**.

Also visible there: they do form validation with a schema (yup) with `required` on every
field, including `tempFolder` — see UX-2, our conclusion about Valibot still stands.

**Synology DS client** — `destination: ""` across all paths. This isn't sloppiness: for
Synology, destination is optional, the NAS substitutes its own Download Station setting. For
QNAP, `temp` is required, so their approach doesn't transfer to us.

**ASUS Download Master** — `Download` appears in the code as the default folder.

**Check on a live QTS 5** (`Misc/Dir`, 2026-08-28): shared folders —
`Browser Station, Container, Docker, Download, Movies, Multimedia, Music, Public, Web, home`.
`Download` is present; QNAP creates this share when the NAS is initialized.

Separately important: **`temporary: true` is set on all ten folders**. So it means "suitable
as a temp folder", not "is a temp folder" — the temp folder can't be auto-detected via the
API, and a default really is necessary.

**Conclusion:** pre-fill `Download` for both folders. The value resolves in memory but is
**not written** to storage — otherwise today's default would freeze into a deliberate user
choice, exactly the trap `torrentInterceptMode` fell into earlier.
