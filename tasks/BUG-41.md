---
type: "task"
id: "BUG-41"
status: "done"
priority: "p1"
area: "popup/settings"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Saving routing rules with empty optional fields crashes Svelte with props_invalid_value, freezing "Add rule"

**Severity:** high · **Area:** popup/settings
**Files:** `src/popup/features/settings/Settings.svelte`, `src/popup/ui/Field.svelte`, `src/lib/routingRules.ts`

When creating or saving routing rules where optional fields (such as `domain` or `namePattern`) are left empty:
1. If `destination` is empty, `normalizeRoutingRules()` silently discards the rule without warning the user.
2. If `domain` or `namePattern` is left empty, `normalizeRoutingRules()` normalizes them to `undefined` on the reactive `form.routingRules` state.
3. Because `<Field>` defines `value = $bindable("")` with a default string fallback, binding `bind:value={rule.domain}` where `rule.domain === undefined` triggers a fatal Svelte 5 runtime exception:
   `Error: https://svelte.dev/e/props_invalid_value` (`Cannot do bind:value={undefined} when value has a fallback value`).
4. The uncaught Svelte runtime exception leaves the Routing Rules UI in a broken state; subsequent Add rule interactions no longer update the reactive state or UI.
5. Keying rules in `{#each form.routingRules as rule, i (rule)}` by object reference causes avoidable child-component remounting whenever normalization recreates rule objects. Stable draft IDs eliminate this churn.

**Resolved 2026-09-08** —
1. `src/lib/routingRules.ts`: Implemented `RoutingRuleDraft`, `toRoutingRuleDraft`, `validateRoutingRuleDraft`, and `serializeRoutingRuleDraft`. Ensured all UI draft string fields default to concrete strings (`""`), strictly preventing `undefined` values from ever reaching `<Field>` `$bindable` inputs.
2. `src/popup/features/settings/Settings.svelte`: Converted editor state to `routingRuleDrafts` with stable IDs `draft.id` (keyed in `{#each routingRuleDrafts as draft, i (draft.id)}`).
3. Replaced destructive pre-save normalization with non-destructive validation that presents inline errors and retains user drafts.
4. Added `routingRuleDrafts` to `settingsSignature` to track form dirty status reactively.
5. Playwright E2E test in `tests/e2e/routing-rules.spec.ts` verified with `expect(pageErrors).toEqual([])` and active interactivity.
