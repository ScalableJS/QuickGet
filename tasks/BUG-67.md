---
type: "task"
id: "BUG-67"
status: "done"
priority: "p1"
area: "testing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# The real-NAS E2E spec targets a settings form that no longer exists

**Severity:** high · **Area:** testing
**Files:** `tests/e2e/popup.real-nas.spec.ts`

`npm run test:e2e:real` fails on a 60 s timeout. It is not flaky and it is not the NAS: the spec
drives a settings form that was replaced.

It fills `#NASaddress`, `#NASport` and clicks `#test-btn`, then asserts on `#downloads-list`.
**None of those four selectors exist any more.** The address and port became a single
`#serverUrl` field, the connection check became a "Test connection" button inside the connection
card, and the list has a different id. `grep` finds no `NASaddress`, `NASport`, `test-btn` or
`downloads-list` anywhere in `Settings.svelte` or `index.html`.

The last commit to touch `#test-btn` in the settings UI is `4f80131` (2026-06-21); the spec was
last edited `8dead6b` (2026-08-28) without being run. So **this has been broken for months** and
nobody saw it, because the real-NAS suite is opt-in (`QNAP_E2E_REAL=1`), is not in CI, and its
absence looks exactly like its silence.

Why this is severity high despite being test-only: it is the **only** thing standing between a
green mock suite and a claim about real hardware, and while it is broken every "it works" is a
statement about the mock. Found when a hand-test against the real NAS failed on a feature whose
mock E2E was fully green.

**Proposed fix:** rewrite the spec against the current form — `#serverUrl`, the connection card,
the current list id — and decide whether a subset belongs in CI. It cannot be in the default
gate (it needs hardware and credentials), but a spec that only runs when someone remembers is a
spec that rots; a scheduled run or a pre-release checklist item would at least surface the rot.

**Resolved 2026-09-13** — replaced rather than repaired. `popup.real-nas.spec.ts` is gone; the
real-NAS run is now `tests/e2e/prod-spotcheck.spec.ts` (BUG-69), which drives the settings form
that actually exists and fails with a message naming the contract it was waiting on.
