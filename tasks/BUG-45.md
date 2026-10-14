---
type: "task"
id: "BUG-45"
status: "done"
priority: "p1"
area: "core/routing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Routing engine ReDoS vulnerability in matchGlob, sanitizer condition-invariant gap, and type: "all" draft smell

**Severity:** high · **Area:** core/routing
**Files:** `src/lib/routingRules.ts`, `src/lib/routingRules.test.ts`, `src/popup/features/settings/Settings.svelte`,
`src/popup/features/settings/RoutingRules.stories.ts`, `tests/e2e/routing-rules.spec.ts`

Following architecture review via ChatGPT Gateway on `ca198bd`, two critical production blockers and an architectural typing smell were identified and resolved:
1. **ReDoS / Catastrophic Backtracking in `matchGlob`:**
   Converting wildcard glob patterns like `*a*a*a*...b` into regular expressions (`^.*a.*a.*a...b$`) induces exponential backtracking in V8. Under Chrome MV3, an adversarial or accidental glob pattern locks up the service worker or UI thread.
   *Competitor benchmark:* Leading download routing extensions (e.g. *Downloads Butler*, *SmarTidy Downloader*, *Regexp Download Organizer*) either avoid regular expressions for glob matching or constrain pattern execution. Replaced `new RegExp()` with a deterministic, linear two-pointer wildcard matching algorithm ($\mathcal{O}(|s| \times |p|)$) supporting `*` and `?`, case-insensitive, with literal treatment of regex special characters (`[]()+${}^`).
2. **Sanitizer Invariant Mismatch (Catch-all shadow rules):**
   The UI validator strictly mandates `destination` plus at least one active condition (`type !== "all" || domain || namePattern`). However, `sanitizeRoutingRules` previously accepted rules with only `destination: "Folder"`, which `resolveDestination` evaluated as matching *all* inputs. If such a rule were positioned first, all subsequent rules were permanently shadowed. Furthermore, magnet rules erroneously retained `domain` conditions in storage despite magnets lacking HTTP hosts.
   *Resolution:* Aligned `sanitizeRoutingRules` to discard rules lacking active conditions and strip invalid domain conditions from magnet rules.
3. **`type: "all"` vs `undefined` Typing Smell:**
   `RoutingRuleDraft.type` was previously typed as `RoutingMatchType | undefined`, allowing `undefined` bindings to creep into Svelte 5 `<Select>` inputs and triggering semantic ambiguities in condition evaluation (`Boolean(draft.type)`).
   *Resolution:* Introduced concrete `type RoutingRuleDraftType = "all" | RoutingMatchType;` so `draft.type` is always a concrete string. On serialization, `"all"` is cleanly omitted from storage.
4. **Test Suite Expansion:**
   - Vitest: Added ReDoS verification test executing 16-group adversarial wildcard pattern in <5ms, regex literal characters test, sanitizer catch-all prevention tests, and draft roundtrip tests.
   - Playwright E2E: Added cold hydration reload test (`reloading popup loads stored rules without errors and maintains full draft reactivity`) and transactional validation assertion confirming `chrome.storage.local` remains untouched upon validation errors.
   - Storybook: Added `play` assertions for disabled `Move Up` / `Move Down` controls on single and multi-rule configurations.

**Resolved 2026-09-09** —
All 385 Vitest unit tests, Storybook build, and 31 Playwright E2E tests verified green.
