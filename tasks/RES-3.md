---
type: "task"
id: "RES-3"
status: "rejected"
priority: "p2"
area: "api/research"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Rejected"
size: "M"
---

# Establish what the NAS allows for per-task destination folders

**Size:** M · **Area:** api/research
**Blocks:** GAP-6 (and decides whether the "change it later" half exists at all)

A user wants to choose where a download lands: **when sending**, **while it runs**, and
**after it finishes**. Those are three different questions, and the API answers them very
differently — this card establishes which are possible before anything is designed.

**What the code already tells us (read 2026-08-31, no NAS needed):**

- **At send time — already supported by our own client, just not exposed.**
  `client.addUrl(url, { tempFolder, targetFolder })` (`client.ts:127`) takes a per-call
  target and defaults to `settings.NASdir` only when the caller omits it. `addTorrent`
  likewise sends `move` and `dest_path`. So the plumbing for "choose per download" exists;
  what is missing is UI. That is GAP-6, and it does not depend on this research.
- **After the fact — no endpoint for it.** The full V4 surface we have typed is
  `Add*`, `Query`, `Start`, `Stop`, `Pause`, `Remove`, `Status`, `GetFile`, `SetFile`,
  `Misc/Dir`, `Misc/Login`. There is **no "set destination" call**, and `SetFileRequest` is
  not one: its fields are `hash`, `index`, `priority` — it selects *which files within a
  torrent to fetch*, not where they go.
- **`savepath` does not exist and is silently ignored** (`client.ts:129-130`) — a documented
  trap we already hit once.

**So the honest shape of the feature is probably: choose freely at send time, and after that
the destination is fixed.** Confirm that on hardware before promising anything:

- [ ] Does any undocumented V4 call change a task's destination after creation? Check what
      the Download Station web UI itself sends when a user edits a task — if the UI cannot do
      it either, that settles it.
- [ ] Can `temp` and `move` differ per task without side effects, or does Download Station
      expect one temp folder globally?
- [ ] What happens when `move` names a folder that does not exist or is not writable? Is it a
      clear error, or an accepted task that fails later? `Misc/Dir` reports `writtable` per
      entry, so we may be able to prevent this in the picker rather than discover it after.
- [ ] Does changing the destination of a **completed** task have any meaning, or is moving
      files then purely a File Station operation and out of scope for us?

**If the answer is "no post-hoc move":** say so in the UI rather than hiding the limit. A
disabled control with a one-line reason ("Download Station sets the destination when the task
is created") is better than users hunting for a feature that cannot exist. Record the finding
in `docs/qnap-download-station-capabilities.md` either way — that document exists precisely so
this is not re-investigated.

**2026-09-09 — the question was too narrow.** A routing review asked the same thing from the
other end and found a window this card does not consider: a magnet sits in state 103 with
`files: 0` and nothing downloaded while Download Station fetches its metadata, and `Task/Query`
carries a `source_name`. If the real name becomes readable there, the destination can be
corrected by removing and re-adding at zero cost — no move, no File Station, no seeding risk,
because no payload exists yet. That is RES-6. This card keeps its original scope: whether
Download Station can change `move` on an existing task. GAP-14 is the umbrella that says which
of the three windows we actually intend to use.

**2026-09-09 — corroborated from the outside.** No competitor calls anything resembling a
destination change; the census is in `docs/competitor-routing-teardown.md` section E. That is not
proof the call does not exist, but it removes "surely someone does it" as a reason to keep
looking. What is left worth checking on hardware is the `move`-points-at-a-missing-folder question
in the list above, which is a validation concern rather than a re-routing one.

**2026-09-09 — narrowed to one question.** The re-routing part is settled: GAP-14 is rejected,
RES-4 is rejected, and no competitor has a destination-change call either. What is still worth a
minute on hardware is the *validation* question from the list above, which has nothing to do with
moving anything:

- What does Download Station do when `move` names a folder that does not exist or is not writable
  — a clear error, or an accepted task that fails silently later? `Misc/Dir` reports `writtable`
  per entry, so a bad destination could be caught in the picker instead of discovered afterwards.

Everything else on this card is answered. Retitle it if it is picked up.

**2026-09-09 — Rejected; the last open question is answerable without hardware.** It had been
narrowed to "what does Download Station do with a `move` that does not exist or is not writable".
Three things already answer it well enough to not spend a NAS session:

- The editor validates the folder through `Misc/Dir` when the rule is written (F1), so the path
  existed at least once.
- The residual case is a folder deleted on the NAS afterwards — rare, and not preventable by us.
- Download Station reports it: `++`'s error table carries `6: "Destination folder not found"`, and
  we have displayed task error codes since BUG-37.

So the failure is already surfaced to the user in words. Confirming the mechanism on hardware would
change nothing we would build.
