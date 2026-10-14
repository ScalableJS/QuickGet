---
type: "task"
id: "BUG-57"
status: "rejected"
priority: "p2"
area: "core/routing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Rejected"
severity: "medium"
---

# A wildcard-only pattern is a catch-all the sanitizer was written to prevent

**Severity:** medium · **Area:** core/routing
**Files:** `src/lib/routingRules.ts` (`sanitizeRoutingRules`, `validateRoutingRuleDraft`)

`sanitizeRoutingRules` documents an invariant — "catch-all rules without conditions are
prohibited, unmatched downloads use the global Target" — and enforces it by requiring one of
`type`, `domain`, `namePattern` to be set. A rule whose only condition is `namePattern: "*"`
satisfies that check and then matches everything. Put first, it shadows the entire list, and
because rules fail silently the user sees "all my downloads go to one folder" with no clue why.

The same is true of `*` mixed into a list (`mkv *` matches everything) now that a field holds
several values.

**Why it is easy:** the guard is one predicate next to the ones already there — a pattern whose
every token is made only of `*` and `?` carries no information, so treat it as absent. If nothing
else is set, the rule is condition-less and already gets dropped. The editor's validator says the
same thing, from the same function.

**Do not over-fit.** `*.mkv`, `*S01*` and `*` mixed with a real domain are all legitimate. This is
only about a rule that constrains nothing.

**Acceptance criteria**

- [ ] A rule whose only condition is a wildcard-only pattern is dropped by the sanitizer and
      rejected by the editor, with a message naming the reason.
- [ ] `*` alongside a domain or a type still works — it is not a catch-all then.
- [ ] Existing stored rules that are catch-alls are dropped on load rather than silently kept.
- [ ] Unit-covered both ways, including `mkv *` in one field.

**2026-09-09 — Rejected the day after it was written.** Two reasons, and the second is the one
that decides it.

**It polices intent, not data.** The sanitizer exists to reject malformed input from storage and
imported backups — a rule with *no conditions at all*, which nobody typed and which shadows
everything. A pattern of `*` is a condition the user wrote on purpose. Ordering is theirs to
choose, "first match wins" is stated in the editor, and the rule list is short and visible.

**The failure is now self-diagnosing.** Since BUG-38 every task card shows the folder it is going
to. A stray `*` at the top of the list announces itself on the next download instead of hiding.

Left in the code instead of a guard: a sentence in `sanitizeRoutingRules` saying a wildcard-only
pattern passes deliberately, so the next reader does not file this card again.
