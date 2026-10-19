---
type: "task"
id: "DEMO-7"
status: "todo"
priority: "p2"
area: "video"
board: "demo-video"
updated: "2026-10-19"
size: "S"
depends_on: ["BUG-81"]
---

# Refresh store screenshots and review the promo video against the settled UI

## Outcome

The Chrome Web Store screenshots show the current popup and settings experience. The promo video
is either confirmed accurate or replaced when its setup flow or product claims no longer match.

## Problem

The four screenshots in `store-assets/screenshots/` and `store-assets/screenshots-dark/` have filesystem
modification dates of 2026-08-30. These dates are retention evidence, not a verified capture log. Since then, the popup and settings UI changed, including routing and
destination details, interception controls, connection feedback, and subsequent October polish.
Refresh and visually review them against the settled interface rather than treating the old captures as current evidence. The promo master and its
subtitle track date to 2026-08-31; their visible setup flow may also have changed, but staleness
has not been established from the asset date alone.

## Scope and sequencing

Do this after the pending settings work settles, including the settings backup, Enter-to-save, and
field-error behavior changes. Then inspect the current production build and all existing assets.
Regenerate the light and dark store screenshots with `npm run capture:store-assets` and review the
resulting images for current content, legibility, and truthful fictional data. Review the video
and subtitle against the current setup flow and claims; record a fresh take with `npm run
demo:record` only if that review finds a visible mismatch. Keep the existing capture workflows and
update `store-assets/README.md` only if their documented operation changes.

## Acceptance criteria

- [ ] Light and dark screenshots show current downloads and settings UI, including the settled
      settings behavior, with no stale controls or misleading states.
- [ ] The screenshots are visually reviewed at their generated 1280×800 dimensions and contain
      only fictional download data.
- [ ] The promo video and English subtitle are checked against the settled setup flow and current
      product claims; either a specific no-refresh rationale is recorded or both artifacts are
      regenerated and reviewed together.
- [ ] The retained files under `store-assets/` are the reviewed outputs from the capture workflow.

## Evidence

- `store-assets/README.md` identifies `npm run capture:store-assets` and `npm run demo:record` as
  the asset workflows.
- Filesystem modification dates: light/dark screenshots 2026-08-30; promo MP4 and subtitle
  2026-08-31.
- `git log -- src/popup src/lib/settings.ts` shows popup/settings changes
  after those retained asset dates, including 2026-09-12/13 settings and interception changes and
  2026-10-10 popup polish.
- No video refresh is asserted solely from its age; its need remains conditional on reviewing its
  visible flow and claims after the settings work.
