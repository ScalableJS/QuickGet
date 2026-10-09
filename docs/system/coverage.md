---
type: reference
status: active
area: documentation
updated: 2026-10-09
---

# Documentation coverage

Inventory: 2026-10-09. Generated from docs/features.json and current file contents.

**Linked: 20/20 (100.00%). Reviewed and unchanged: 20/20 (100.00%).**

The denominator is registered implemented features, including implemented portions of partial features. Planned features do not count. A reviewed snapshot confirms documentation was compared with the implementation; it does not prove runtime behavior, field reliability, or that no feature was overlooked.

Discovered source files: 149. Unclassified files: 0.

Initial inventory covers extension runtime, configuration, operational scripts and test infrastructure. Descriptions were reviewed against current owning paths and existing evidence; no fresh real-NAS run, Firefox runtime parity or universal feature discovery is implied. Source-file coverage is independent of the feature denominator. Confirmed cleanup candidates and scope differences are recorded in docs/system/feature-review.md.

| Area | Features | Linked | Reviewed |
|---|---:|---:|---:|
| api | 1 | 1 | 1 |
| background | 3 | 3 | 3 |
| content | 1 | 1 | 1 |
| documentation | 1 | 1 | 1 |
| engineering | 2 | 2 | 2 |
| interface | 3 | 3 | 3 |
| popup | 3 | 3 | 3 |
| routing | 2 | 2 | 2 |
| settings | 3 | 3 | 3 |
| testing | 1 | 1 | 1 |

## Features

| ID | Capability | Implementation | Documentation | Review |
|---|---|---|---|---|
| qnap-api | QNAP transport, login, sessions and API errors | implemented | [page](../../src/api/README.md) | verified |
| connection-settings | Connection form and persistent settings | implemented | [page](../../docs/system/settings.md#connection-and-saving), [page](../../docs/privacy-policy.md) | verified |
| settings-lock | Optional Settings-screen password | implemented | [page](../../docs/system/settings.md#storage-and-security) | verified |
| settings-backup | Non-secret settings export and import | implemented | [page](../../docs/system/settings.md#backup-and-import) | verified |
| routing-rules | First-match routing and rule editor | implemented | [page](../../docs/system/routing-folders.md#destination-selection) | verified |
| nas-folders | NAS folder selection and validation | implemented | [page](../../docs/system/routing-folders.md#folder-paths-and-validation) | verified |
| torrent-handoff | Transactional browser torrent hand-off | implemented | [page](../../docs/system/torrent-handoff.md) | verified |
| page-capture | Page magnet and scoped ordinary-file sends | implemented | [page](../../docs/system/page-capture.md) | verified |
| context-menu | Explicit context-menu link sends | implemented | [page](../../docs/system/context-menu.md) | verified |
| popup-upload | Local torrent and batch URL submission | implemented | [page](../../docs/system/popup-upload.md) | verified |
| task-list | Live task list, filtering and task details | implemented | [page](../../docs/system/task-management.md#live-task-list) | verified |
| task-operations | Task actions, queue order and torrent file priority | implemented | [page](../../docs/system/task-management.md#task-operations) | verified |
| background-monitoring | Alarm polling, badge and attention state | implemented | [page](../../docs/system/monitoring.md) | verified |
| feedback | Page, popup and system feedback | implemented | [page](../../docs/system/feedback.md) | verified |
| popup-interface | Svelte popup composition and UI primitives | implemented | [page](../../docs/system/interface.md#composition) | verified |
| themes | Saved Auto, Light and Dark preference | implemented | [page](../../docs/system/interface.md#composition) | verified |
| build-release | Browser builds, quality gates and release ownership | implemented | [page](../../docs/system/development-release.md) | verified |
| development-harness | Storybook, store assets, demo and manual stand | implemented | [page](../../docs/system/interface.md#harnesses-and-assets) | verified |
| verification-infrastructure | Mocks, fixture servers and real-NAS ownership | implemented | [page](../../docs/system/verification.md) | verified |
| documentation-workflow | Feature registry, reviews, language and drift guards | implemented | [page](../../docs/system/documentation.md) | verified |

## Needs attention

All registered implemented features have current reviews. New behavior inside an existing file still requires human review.

## Unclassified sources

None.

## Registry errors

None.

## Unresolved canonical-page links

None.

## Exclusions from independent features


## Boundaries

Discovery scans extension TypeScript, Svelte, HTML and CSS; operational scripts; fixture/mock support; Storybook configuration; manifests; build configuration; and GitHub workflows. Unit tests, E2E, declarations and stories do not create independent features; they can provide evidence. A new capability within an existing file cannot be discovered automatically. Product use and duplicate behavior require call-site and test review; a coverage percentage is not evidence that a feature is useful.

See [the documentation workflow](documentation.md), [the feature review](feature-review.md), and [the knowledge-base entrypoint](README.md).
