---
type: "task"
id: "BUG-64"
status: done
priority: "p3"
area: "popup/ui"
board: "bugs"
updated: 2026-10-10
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


## Polish execution: 2026-10-10

Terra owns the bounded implementation/reproduction work; Codex owns review, Mimic consultation, integrated verification and acceptance. This starts the current polish pass without closing historical evidence gaps.


## Implementation reviewed: 2026-10-10

Download metric separators and SpeedShowcase labels now reference the existing --text-muted token. No duplicate token was introduced. Codex reviewed the source-only color change; integrated verification is recorded below.


## Accepted polish: 2026-10-10

Codex accepted the bounded source/test delta after Terra implementation and substantive Mimic consultation. Fresh integration passed 595 unit/fixture tests, 61 Chromium mock E2E, ten consecutive classifier repetitions, typecheck, Svelte (zero errors/warnings), lint, production build and six real-NAS spot checks; the owned-task ledger is empty. [The final audit](../docs/quality/code-quality-audit.md#final-integrated-acceptance) and [verification](../docs/system/verification.md#final-polish-integrated-acceptance-2026-10-10) retain exact scope and coverage limits. No release or store publication is performed.
