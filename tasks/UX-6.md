---
type: "task"
id: "UX-6"
status: "done"
priority: "p2"
area: "ui"
board: "settings-ux"
updated: "2026-10-09"
legacy_status: "Done"
size: "M"
---

# Routing rules are unnamed field soup for screen readers

**Size:** M · **Area:** ui

Each rule is three controls plus a delete button, with no group and no name. Three rules read
as six unlabelled fields in a row. Deleting one announces nothing.

**Proposal:** each rule is a `<fieldset>` with a visually hidden `<legend>Rule 1</legend>`;
the delete button gets `aria-label="Remove rule 1"`; removal posts a message to the live region
from UX-5.

**Depends on:** UX-3, UX-5.

**2026-09-09 — card body brought in line with the board, and partly re-opened.** The body still
read `Discussion` while the board had said `Done` since the fieldset/legend work landed; the
proposal above did ship. What did *not* survive the BUG-43 card redesign is everything around
it: condition errors are no longer associated with their fields (BUG-48), reordering is silent
and loses focus (BUG-49), and adding a rule announces nothing (BUG-53). The gate that should
have caught this never scanned the panel (BUG-51). Treat this card as "named groups, done" and
the rest as those bugs.
