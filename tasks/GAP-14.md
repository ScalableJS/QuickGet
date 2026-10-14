---
type: "task"
id: "GAP-14"
status: "rejected"
priority: "p2"
area: "api/background"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Rejected"
size: "L"
---

# Re-route a download after it has started — which windows actually exist

**Size:** L · **Area:** api/background
**Umbrella for:** BUG-47 (name source), RES-6 (magnet metadata window), RES-3 and RES-4 (the
post-hoc move), GAP-6 (making the destination visible at all)

"Change the folder after the download started" is one sentence describing three different
problems with three different answers. This card exists so the product decides which of them
it is promising, before any UI implies all three.

**Window 1 — before the task is created. Free, and we are not using it.**
For a `.torrent` the browser already holds the file: `sendTorrentUrlToNas` fetches the blob and
sniffs its first two bytes. The info dictionary's `name` is the real content name, so the rule
that decides the destination can be evaluated against the actual release rather than the URL
slug. No NAS call, no new permission, no risk. This is the single biggest improvement available
and it is tracked as BUG-47.

**Window 2 — the metadata stall, magnets only. Plausible, unproven.**
A magnet enters Download Station in state 103 with `files: 0` and no payload while metadata is
fetched. If the resolved name surfaces in `Task/Query.source_name` during that window, the
destination can be corrected by `Remove` + `AddUrl` with the right `move` — nothing has been
downloaded, so nothing is lost. Needs hardware confirmation: RES-6.

**Window 3 — after bytes have landed. Expensive, and probably never.**
Download Station has no set-destination call (RES-3). Only File Station can move the files, and
that detaches the task, breaks seeding, and costs ratio on a private tracker — plus it means
granting a browser extension the ability to move arbitrary files on the NAS (RES-4).

**Design position to hold.** Windows 1 and 2 are *routing decided before any bytes land*, not
moving. Never present them as "move the folder" — that phrasing promises window 3, and a user
who believes it exists will go looking for it after the download completes, which is the one
moment we cannot help them. If window 3 stays closed, say so in the UI with a reason, the way
RES-3 already argues.

**Acceptance criteria**

- [ ] The product states explicitly which windows exist, and the UI copy matches.
- [ ] No control or wording implies a capability the API does not have.
- [ ] Whatever ships is verifiable by the user before it matters — see UX-19.

**2026-09-09 — window 1 shipped; window 3 is now closed on evidence.** The `.torrent` half of
window 1 is implemented (BUG-47): `readTorrentName` reads `info.name` out of the file we already
fetch, and the destination is resolved against it. An endpoint census of all three competing
Firefox clients found no post-add destination call anywhere — *Send To QNAP++* holds File Station
credentials and uses exactly one function, `func=stat`, to check a folder exists. Nobody moves a
file. Treat window 3 as closed unless RES-3 turns up something on hardware, and say so in the UI
rather than leaving a hole where a control looks like it should be. Full census:
`docs/competitor-routing-teardown.md` section E.

**2026-09-09 — Rejected, with one window shipped and one deferred.** The product owner excluded
post-hoc moves outright ("send to one folder then move it when it finishes — leave that out").
That was the right call and the card can close, but only because the useful part of it was not
that window:

- **Window 1 shipped.** A `.torrent` is routed on its own `info.name`, read from the bytes the
  browser already fetched (BUG-47), and a magnet on the page it was clicked on. No moving
  required; the destination is simply correct the first time.
- **Window 2 deferred** to RES-6 — hardware-blocked, and adjacent enough to the excluded idea that
  it does not get revived without a reason.
- **Window 3 rejected** — RES-4.

The design position stands and is why this closes cleanly rather than lingering: windows 1 and 2
are *routing decided before any bytes land*, not moving. Nothing in the UI should suggest
otherwise.
