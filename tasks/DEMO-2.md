---
type: "task"
id: "DEMO-2"
status: "done"
priority: "p2"
area: "testing"
board: "demo-video"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Deterministic progress fixture in the mock NAS

**Size:** S · **Area:** testing
**Files:** `tests/e2e/support/mockNas.ts`

Implemented as an opt-in `progressFixture` option on `startMockNas()`. Every `Task/Query` advances
each still-downloading task one step, so successive polls return a rising series instead of the
frozen 0% row a real `AddTorrent` leaves behind.

It keeps the row **coherent**, which a naive percentage bump would not: byte counters track the
percentage, ETA falls as the remainder shrinks, and a task reaching 100% flips to seeding with the
download rate dropped to zero — the same shape a real task has.

```ts
const nas = await startMockNas({ progressFixture: { stepPercent: 12 } });
```

**Verified 2026-08-31** with `stepPercent: 25`:

```
poll 1:  25%  state=104  4.2MB/s  0.20GB  eta=141s
poll 2:  50%  state=104  4.2MB/s  0.40GB  eta=94s
poll 3:  75%  state=104  4.2MB/s  0.59GB  eta=47s
poll 4: 100%  state=100  0.0MB/s  0.79GB  eta=0s      <- seeding, rate cleared
```

**A bug caught while writing it:** the first draft keyed off `state === 2`, guessing at the QNAP
codes. `mapUnifiedStatusToQnapState` says downloading is **104** and seeding **100**, while 2 is
*stopped* — the fixture would have advanced stopped tasks and ignored running ones. The codes are
now named constants referencing that mapper.

Defaults match the demo's Debian card (791,674,880 bytes ≈ the real ISO, 4.2 MB/s). Off unless
requested, so ordinary runs are untouched: the full mock suite passes (20 passed, 1 skipped).

**Honesty limit, restated because it is easy to lose:** this scripts the *backend*. The popup still
renders it with production code over the same API, so a spec may assert that the UI displays NAS
state correctly — never that a real transfer is happening.
