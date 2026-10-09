---
type: "task"
id: "BUG-5"
status: "done"
priority: "p3"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "low"
---

# `.torrent` detection gaps

**Severity:** low · **Area:** background
**Files:** `src/lib/torrentSender.ts:57-60`

- `/\.torrent(\?|$)/i` misses fragments — `foo.torrent#bar` slips through.
- `item.filename` is never consulted, though it often carries the `Content-Disposition` name.
- Only `onCreated` is observed; Chrome may reveal the real MIME type or `finalUrl` later via
  `onChanged`, so endpoints like `/download?id=1234` are never intercepted.

No data loss — misclassification simply skips interception. Harden after the above are green.

**Done 2026-08-28** — `hasTorrentExtension()` accepts `?` and `#`; `isTorrentSource()` also takes
`item.filename`; a `downloads.onChanged` listener re-evaluates a download once Chrome learns its
MIME type or final URL. Adding that listener needed the claim described in BUG-9, since two
listeners can now recognise the same download.
