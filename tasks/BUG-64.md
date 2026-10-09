---
type: "task"
id: "BUG-64"
status: "todo"
priority: "p3"
area: "popup/ui"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Backlog"
severity: "low"
---

# `--color-text-muted` is referenced but never defined

**Severity:** low · **Area:** popup/ui
**Files:** `src/popup/styles/tokens.css`, `src/popup/components/downloadItem/DownloadItem.svelte`,
`src/popup/features/toolbar/SpeedShowcase.svelte`

`tokens.css` defines `--text-muted`. It does not define `--color-text-muted` — but that name is
what several components ask for:

- `DownloadItem.svelte` — six separator bullets between the metric groups
- `SpeedShowcase.svelte` — a 10px label

An undefined `var()` with no fallback makes the whole `color` declaration invalid, so those
elements silently render at the inherited colour instead of the muted one. Nothing is broken
enough to look broken, which is why it survived.

**Proposed fix:** point the usages at `--text-muted` rather than defining a second token. The
repo already had an alias sprawl problem and UX-26 was about reducing it; a new token would add
one back. If the two genuinely need to differ, say why on the card first.

Found while measuring contrast for UX-26.
