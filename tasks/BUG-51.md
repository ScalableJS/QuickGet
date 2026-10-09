---
type: "task"
id: "BUG-51"
status: "done"
priority: "p2"
area: "testing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# The axe gate never reaches the routing rules UI

**Severity:** medium · **Area:** testing
**Files:** `tests/e2e/a11y.spec.ts`, `src/popup/ui/Tabs.svelte:58`

The spec seeds two `routingRules` into storage, which looks like coverage, but it only ever
opens the Connection tab. `Tabs` renders inactive panels with the `hidden` attribute (`:58`),
and axe skips hidden subtrees entirely — so the rule cards have never been scanned by the gate
that UX-9 marked Done. That is how BUG-48 and BUG-50 shipped.

**Acceptance criteria**

- [x] The axe pass switches to Advanced and scans with at least one rule rendered.
- [x] It scans a rule in an error state as well as a valid one.
- [x] `RoutingRules.stories.ts` states are covered by the Storybook a11y run.
- [x] Adding a tab in future does not silently drop it from the sweep — the spec iterates the
      tabs rather than naming one.


**2026-09-09 — fixed. **Done 2026-09-09**,** `tests/e2e/a11y.spec.ts` gained a pass that switches to the
Advanced tab and scans the rule cards twice — once valid, once after a rejected save, which is
the markup BUG-48 was about. The Storybook magnet story now also asserts the domain field's
`aria-describedby`, so the explanation stays connected to the field it explains.

**Resolved 2026-09-09** — shipped in v2.3.0.
