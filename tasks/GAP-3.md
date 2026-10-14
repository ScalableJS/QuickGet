---
type: "task"
id: "GAP-3"
status: "todo"
priority: "p2"
area: "background"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "M"
---

# Offline queue: links are lost when the NAS is asleep

**Size:** M · **Area:** background
**Files:** `src/background/downloads.ts` (`handleDownloadCreated`); `src/lib/config.ts`;
`src/popup/features/downloads/`

*Send To QNAP++* advertises: "Offline Queuing — If your NAS is asleep or unreachable, links
are safely queued and sent automatically when it reconnects." A spun-down NAS is the normal
state for a home user, so this is a real scenario rather than an edge case.

**What we already do, and must not break.** `handleDownloadCreated` is deliberately
transactional (see its comment): pause the browser download, try the hand-off, and cancel
**only** once the NAS has accepted it — otherwise resume and let the browser finish. So an
unreachable NAS today does not lose the file; the browser downloads it locally. BUG-33 made
interception wait for a live connection for the same reason.

That makes this card narrower than the competitor's framing: the file is not lost, but the
user's *intent* — "this belongs on the NAS" — is. With `suppressLocalTorrentFile` on, the
fallback is also least useful, because the point of that setting is not keeping the file here.

**Acceptance criteria**

- [ ] With the NAS unreachable, the user can choose to queue the link instead of taking the
      local download; the choice is explicit, never automatic.
- [ ] A queued item is visible in the popup with a distinct pending state and can be removed.
- [ ] The queue survives a service-worker restart and a browser restart.
- [ ] A queued item is sent when the NAS next answers, and the user is told it happened.
- [ ] Nothing is ever sent silently long after the fact without the user being able to see it
      in the popup first.
- [ ] The existing transactional guarantee is untouched: a failed hand-off still resumes the
      browser download.

**Implementation sketch**

Persist the queue in `chrome.storage.local` (not `session` — it must outlive the worker and
the browser). Drain on the existing `alarms.ts` poll when a poll succeeds; there is already a
self-arming alarm, so no new timer and no keepalive — this must not become the ping we
rejected in F2.

**No prior art to lean on (checked 2026-08-31).** The mature open-source client in this
category implements neither a queue nor any deferred-send mechanism, and the extension that
advertises offline queuing is closed-source. So there is no established shape to follow here:
the design below is ours, and the risks in it are unproven rather than known-solved. Budget
accordingly — this is the card most likely to need a second pass after real use.

**Failure modes**

- **A surprise download hours later** is the failure that makes this feature hated. Pending
  state must be visible and dismissible before anything is sent.
- Single-use / token-signed URLs are dead by the time the NAS wakes; queueing them produces a
  confident failure later. Consider marking hand-offs whose URL carries a query signature.
- Unbounded growth if the NAS stays down for weeks — cap it, and say what the cap is.
- Duplicate sends if a drain overlaps the next poll.

**Test plan**

- Vitest: queue persistence, dedup, cap, and drain ordering as pure logic over a fake storage.
- Playwright: mock NAS starts unreachable, the item queues, the NAS comes up, the drain fires
  on the next poll, and the popup reflects each transition. `mockNas.ts` can already be
  started and stopped mid-test.
