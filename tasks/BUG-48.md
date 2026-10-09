---
type: "task"
id: "BUG-48"
status: "done"
priority: "p1"
area: "popup/a11y"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Rule condition errors are not tied to the fields they describe

**Severity:** high · **Area:** popup/a11y
**Files:** `src/popup/features/settings/Settings.svelte:769`, `src/popup/ui/Field.svelte`

`Field` already implements the correct behaviour — an `error` prop sets `aria-invalid`, renders
the message with a generated id and points `aria-describedby` at it. That is what UX-1 shipped
it for, and `FolderSelect` uses it for the destination side of each rule.

The IF side does not. Both condition inputs are rendered with only an `aria-label`, and the
condition error is a loose `<p role="alert">` next to them (`:769`). A screen-reader user
standing in the pattern field is told neither that it is invalid nor what is wrong with it —
the exact failure mode `tests/e2e/a11y.spec.ts` was written to prevent for the connection
fields.

**Acceptance criteria**

- [x] The condition error is passed to the fields it concerns via `Field`'s `error` prop.
- [x] The offending inputs carry `aria-invalid="true"` and an `aria-describedby` that resolves
      to the message.
- [x] One alert per card, not one per field plus a loose paragraph.
- [x] E2E asserts this on a rule field the way the existing spec asserts it on `#NASlogin`.


**2026-09-09 — fixed. **Done 2026-09-09**,** The condition error is passed to the name `Field`, which
renders it with the `aria-invalid` / `aria-describedby` / `role="alert"` wiring it already had;
the type `Select` and the domain `Field` carry `aria-invalid` and point at the same message id.
The loose `<p role="alert">` is gone, so there is one alert per card. Covered by the new axe pass
over a rejected rule (BUG-51).

**Resolved 2026-09-09** — shipped in v2.3.0.
