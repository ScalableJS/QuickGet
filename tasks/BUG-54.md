---
type: "task"
id: "BUG-54"
status: "done"
priority: "p2"
area: "popup/upload"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Popup `.torrent` upload bypasses routing rules entirely

**Severity:** medium · **Area:** popup/upload
**Files:** `src/popup/features/upload/torrentUpload.ts:21`, `src/api/client.ts` (`addTorrent`)

`uploadTorrent` calls `client.addTorrent(file)` with no folder, so the destination is
`settings.NASdir` and nothing else. A user with "season packs → TV" configured drags a `.torrent`
into the popup and it lands in the default folder, silently — the same rule that works when the
identical file is clicked on the tracker.

The file is already a `File` in hand, so `readTorrentName` applies directly and the fix is the one
already made for the interception path: read the name, resolve the destination, pass it down.
`addTorrent` takes no folder argument today and would need one — `sendTorrentUrlToNas` fakes it by
overriding `settings.NASdir`, which is not a pattern to copy into a second place.

Worth knowing: *Send To QNAP++* has exactly this bug, from exactly the same cause — routing lives
at one choke point and the `AddTorrent` path does not go through it
(`docs/competitor-routing-teardown.md` section E).

**Acceptance criteria**

- [x] A `.torrent` uploaded through the popup lands in the folder its rule names.
- [x] `addTorrent` takes the destination as an argument rather than through a mutated settings copy.
- [ ] The matrix spec gains a row for this path (`docs/routing-coverage.md`).
- [x] Quick-add's explicit folder picker still wins over rules — that bypass is deliberate.

**2026-09-09 — fixed. **Done 2026-09-09**,** `uploadTorrent` reads the file's own `info.name` and resolves
the destination like every other send path; `addTorrent(file, { targetFolder })` takes it as an
argument, which also removed the `{...settings, NASdir: folder}` spread that `sendTorrentUrlToNas`
was using to fake the same thing. Unit-covered.

The matrix row stays unticked on purpose: the popup's hidden file input is not something the test
stand can drive, and adding a seam for it would cost more than the assertion is worth. Recorded in
the "cannot cover" table in `docs/routing-coverage.md` instead.

**Resolved 2026-09-09** — shipped in v2.3.0.
