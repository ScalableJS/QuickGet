---
type: "task"
id: "RES-4"
status: "rejected"
priority: "p2"
area: "api/research"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Rejected"
size: "M"
---

# Can File Station move a finished download, and at what cost to seeding?

**Size:** M · **Area:** api/research
**Depends on:** RES-3 (which confirms Download Station itself has no move call)

Download Station's own API has no set-destination call, but **File Station is a separate API
on the same NAS** and does move files. So "change the folder after the fact" is probably
achievable — just not through the downloader, and not without a consequence the user must be
told about.

**The consequence, which is the whole point of this card.** Moving a completed torrent's files
out from under Download Station detaches them from the task: the task still points at the old
path, so **seeding breaks**, and depending on how the task reacts, a recheck may fail or the
task may re-download. For a private tracker that is not cosmetic — broken seeding costs ratio,
and ratio loss can cost the account. Any UI we build here has to say this *before* the move,
not explain it afterwards.

**Prior art worth noting:** the mature open-source client in this category integrates File
Station but uses only its **read** endpoints (`Info`, `List`) — it browses folders and never
moves anything. That is a deliberate-looking boundary, and a reason to be careful rather than
to assume it is easy.

**Questions, in the order that decides whether we build anything:**

- [ ] Does File Station's move/copy API exist on QTS 5 in a form we can call with the same
      session, or does it need its own login? We currently authenticate only against
      `/downloadstation/V4/Misc/Login`.
- [ ] What are the **permission** implications? File Station move is a far broader capability
      than "add a download" — a user may reasonably not want a browser extension able to move
      arbitrary files on their NAS. This is the strongest argument for not doing it at all.
- [ ] What actually happens to an active or seeding task when its files move? Does Download
      Station error, silently stop, or re-download? Test with a *completed but seeding* task,
      not just a finished one.
- [ ] Is there a safe subset — for example, only offering the move for a task that is
      finished **and not seeding** — that gives most of the value with none of the ratio risk?

**Design position to hold whatever the answers are:** if this ships, it ships as an explicit,
warned, one-way action on a specific task — never as a silent "change destination" that looks
like editing a setting. The warning must name the real consequence ("this will stop seeding
and detach the task from its files"), not a generic "are you sure?".

**Do not build this to satisfy a UI symmetry.** The reason to want it is a real user with a
full disk or a misfiled download; the reason to refuse is that we would be handing a browser
extension the ability to move files anywhere on the NAS. Weigh both before writing code, and
record the decision either way.

**2026-09-09 — probably answerable without ever calling File Station.** Two cheaper windows
were identified upstream of this one (GAP-14): routing a `.torrent` on the real content name
before the task is created, and correcting a magnet's destination during the metadata stall
(RES-6). If those land, the remaining File Station case is "the user changed their mind after
bytes were written", which is rare enough that the permission cost argued for above almost
certainly wins. Do GAP-14 first and re-read this card afterwards — it may close as Rejected
rather than being built.

**2026-09-09 — Rejected.** The reason to build it was "the user changed their mind after the fact".
The reason not to is unchanged and now better supported: it means granting a browser extension the
ability to move arbitrary files on the NAS, and moving a completed torrent's files detaches the
task and breaks seeding, which on a private tracker costs ratio.

What tipped it: routing on the real content name (BUG-47) removes most of the "wrong folder"
cases this was meant to repair, and the endpoint census found that the one competitor holding File
Station credentials uses exactly one function, `func=stat`, and never moves a file
(`docs/competitor-routing-teardown.md` section E). Nobody in this category does it, the cost is a
permission the user should not have to grant, and the need shrank.

Reopen only for a concrete user report of a full disk or a misfiled download that routing could
not have prevented.
