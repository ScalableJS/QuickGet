---
type: task
id: ENG-14
status: todo
priority: p2
area: engineering
board: engineering
updated: 2026-10-09
---

# Establish Firefox runtime verification and document supported interception guarantees

The Firefox manifest and bundle exist, but CI's mock E2E launches Chromium. The browser download
listener uses optional Chromium-specific filename deferral. Building and linting Firefox cannot
prove the same download outcome or every page-capture behavior.

## Acceptance criteria

- [ ] Verify actual background setup, magnet handling, ordinary file sends, torrent browser fallback,
      and download outcome in Firefox using its own supported automation/manual evidence.
- [ ] State the supported browser/version matrix and any no-local-file limitation from observations.
- [ ] Keep packaging/lint distinct from runtime evidence and avoid claims inferred from Chromium tests.

## Evidence

[Build and browser boundaries](../docs/system/development-release.md) records the inspected manifest
and conditional listener setup. No new Firefox hardware/runtime observation is claimed.
