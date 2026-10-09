---
type: "task"
id: "BUG-61"
status: "done"
priority: "p3"
area: "popup/settings UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "low"
---

# Torrent interception setting uses oversized copy and promises behavior the product does not guarantee

**Severity:** low · **Area:** popup/settings UX
**Files:** `src/popup/features/settings/Settings.svelte`

The checkbox currently occupies a heading plus two explanatory sentences:
`Send torrent links to Download Station`; `Both .torrent downloads and magnet links, instead of
your browser or a local app.`; and `Hold Shift when clicking a link to send just that one — whether
this is on or off.` The block is too large for a simple binary setting, repeats “link/clicking”, and
makes two absolute promises contradicted by BUG-59: “instead of” the browser and Shift working
regardless of state.

**Acceptance:** replace the block with one short label and at most one concise hint. Name `.torrent`
and magnet coverage once, describe Shift as a one-off send without the “whether this is on or off”
tail, and do not claim that the browser/local flow is impossible until BUG-59 has an enforced
outcome test.

**Resolved 2026-09-13** — the control now says `Automatically send torrent links`, followed by
`Includes .torrent and magnet links.` and `When off, Shift-click sends one link.` This names the
checkbox's automatic behavior directly, keeps the two supported link kinds, and removes both the
unsupported “instead of your browser” promise and the redundant “whether this is on or off” tail.
`svelte-check` and Biome lint pass.

**Contract corrected 2026-09-13** — after separating conservative click from full Shift-click,
the final compact copy is `Send torrent links to Download Station` with one hint:
`Includes .torrent and magnet links. Click also opens locally; Shift-click sends only to Download Station.`
It explains the difference without promising that QuickGet suppresses the browser for an ordinary
click.
