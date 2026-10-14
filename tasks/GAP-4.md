---
type: "task"
id: "GAP-4"
status: "todo"
priority: "p2"
area: "popup/ui"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "M"
---

# No undo on remove

**Size:** M · **Area:** popup/ui
**Files:** `src/popup/components/` (status/toast infrastructure); the downloads feature

Already in the roadmap (F4), deferred for a real reason: removal is an immediate NAS call, so
a true undo means delaying the call and adding a toast that can carry an action. Our
`showStatus` banner is transient and text-only — `Settings.svelte:183` shows the shape it
supports (`showStatus(..., { autoHideMs: 2000 })`), which is a notice, not an affordance.

**This card is blocked on infrastructure, and that is the honest status.** The work is
"action-capable toast", and undo is its first consumer. Sizing it as a downloads-feature card
understates it.

**Acceptance criteria**

- [ ] A removed task shows an undo affordance for a bounded window before the NAS call fires.
- [ ] Dismissing, navigating away, or closing the popup commits the removal — it must never
      be left ambiguous.
- [ ] The popup closing mid-window does not strand the task in a half-removed state.
- [ ] Keyboard reachable and announced to assistive tech; `a11y.spec.ts` covers the popup.

**No prior art (checked 2026-08-31):** no toast-with-action or undo mechanism exists in the
comparable open-source client — its removals are immediate, like ours. Nothing to copy; the
infrastructure question below is genuinely ours to answer.

**Open question to settle first:** the popup is destroyed the moment it loses focus, which is
a hostile environment for a delay-then-commit pattern. Either the delay lives in the service
worker (durable, but "undo" then spans a context the user cannot see) or the popup commits on
unmount (simple, but the window is however long the popup happens to stay open). Decide this
before any UI work.

**Test plan**

- Vitest for the commit/cancel state machine, driven without a DOM.
- Playwright: remove, undo, assert the mock NAS never received the removal; then remove,
  close the popup, assert it did.
