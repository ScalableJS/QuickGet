---
type: "task"
id: "BUG-10"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Right-click send hands login-protected links to the NAS as bare URLs

**Severity:** high · **Area:** background
**Files:** `src/background/menus.ts`, `src/lib/torrentSender.ts`

Reported for a login-protected tracker: right-clicking a `dl.php`-style link and sending it
with the extension produced an HTML file on the NAS instead of a torrent.

`sendDownloadToStation()` always called `client.addUrl(url)`, handing the NAS a bare link. The
NAS has no session on the tracker, so it received the login page — HTTP 200, so nothing looked
wrong — and Download Station stored that HTML as the task.

The interception path had solved this from the start: fetch the `.torrent` in the browser with
`credentials: "include"` so the user's tracker cookies apply, then upload the file itself. The
context menu simply never used it.

**Worked before the fix:** anything needing no session — magnets, public direct `.torrent`
links, ordinary files. **Failed:** every login-protected tracker and any tokenised URL.

**Done 2026-08-28** — the context menu routes torrent sources through `sendTorrentUrlToNas()`,
with routing rules still applied to the destination. Magnets and plain URLs stay on `AddUrl`,
which is correct for them. `assertLooksLikeTorrent()` now rejects a payload that is not
bencoded (`d` + digit) and not `application/x-bittorrent`, so a login page becomes a clear
error — "the tracker returned a web page … you may need to log in" — instead of a broken NAS
task. Six tests in `menus.test.ts`, five of which fail on the old code, plus an opt-in live spec
(`tests/e2e/private-tracker.real.spec.ts`) that proves an extension-origin fetch really carries
the site session — the target site is configured locally and not recorded here.
