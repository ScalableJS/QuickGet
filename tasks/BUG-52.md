---
type: "task"
id: "BUG-52"
status: "done"
priority: "p3"
area: "popup/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "low"
---

# Delete sits next to the reorder arrows and looks identical to them

**Severity:** low · **Area:** popup/UX
**Files:** `src/popup/features/settings/Settings.svelte` (rule header, `:715-745`)

**Rescoped twice; this is the version that treats the actual cause.** It began as "choosing Magnet
erases the typed domain" (fixed), became "no way to discard unsaved rule edits", and is now the
thing that makes discarding necessary in the first place.

Each rule's header ends with three 28×28 icon buttons, 4px apart: `↑`, `↓`, `✕`. The only
destructive control on the screen is the same size and shape as the two harmless ones, and it sits
immediately after the one you press repeatedly. Reordering a rule and deleting it are 32 pixels
apart.

Recovery afterwards is poor and that is the point — it is why prevention is the right fix. The
toast says "Rule 3 removed" and carries no Undo; `showStatus` cannot hold a control (the same
infrastructure gap that defers GAP-4). Closing the settings *panel* does not help: `togglePanel`
toggles a CSS class, the component stays mounted and the drafts survive. Only closing the whole
popup discards them — along with every other unsaved change in the form.

**Fix:** separate the destructive control from the navigational ones. `✕` at the other end of the
header, or the arrows grouped and `✕` set apart by a real gap. Minutes, no new state.

**Heavier alternatives, deliberately not chosen now**

- *Undo on the toast* — the precise fix for "I deleted it by mistake", and it needs a toast that
  can carry an action. If that infrastructure ever lands for GAP-4, this closes with it.
- *A Discard button in the footer* — treats the wrong illness. The problem is one lost rule; this
  throws away deliberate edits too.

**Acceptance criteria**

- [x] The delete control is not adjacent to the reorder controls, and reads as destructive.
- [x] Keyboard order still puts the rule's own controls together, and the Storybook stories cover
      the new layout.
- [x] No confirmation dialog — a per-delete prompt on a five-item list is worse than the mis-click.

**2026-09-09 — fixed, In Review.** The two reorder arrows are their own group; the delete control
sits apart from them by `--space-3` at the end of the header. No confirmation dialog, no new state,
no Discard button. The heavier alternatives above stay recorded for whenever a toast can carry an
action.

**Resolved 2026-09-09** — shipped in v2.3.0.
