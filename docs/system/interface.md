---
type: architecture
status: active
area: interface
updated: 2026-10-10
features: ["popup-interface", "themes", "development-harness"]
---

# Popup UI, theme, and development harnesses

## Composition

The popup entrypoint applies the saved theme, acknowledges browser attention, mounts Settings and upload panels, initializes the task list, and mounts toolbar actions. Opening Settings hides the task list; returning refreshes it. A settings screen lock does not prevent popup startup or background work.

Svelte 5 components use runes. UnoCSS with presetWind4 supplies static utilities; `tokens.css` owns semantic theme colors and `base.css` owns shared base styles. Icons are supplied through unplugin-icons/Lucide. Auto theme follows the OS and replaces the existing media-query listener on changes; page feedback independently follows the saved preference. FormSection, fields, segmented controls and button primitives provide common markup and accessible states.

Persistent popup status messages include a themed native `Dismiss message` button with keyboard focus. Transient confirmations use the existing status timer; the component is not an activity history.

## Harnesses and assets

Storybook mounts components and showcase/gallery wrappers with a Chrome mock. Galleries are development consumers, not independent product features. Store screenshots and promotional demo recording use Playwright and supporting capture tooling. Generated images/video are artifacts; the scripts and scenarios are maintained inputs. These harnesses do not prove the live NAS is reachable.

The unused `Card.svelte` component and its barrel export were removed through [ENG-10](../../tasks/ENG-10.md) after a fresh consumer search. An unused export alone does not prove its implementation is dead: several task constants are used internally even if their exported names have no external caller.

## Sources and evidence

- [Popup entrypoint](../../src/popup/index.ts), [popup HTML](../../src/popup/index.html), [tokens](../../src/popup/styles/tokens.css), [theme helper](../../src/lib/applyTheme.ts), [UnoCSS configuration](../../uno.config.ts).
- [Theme E2E](../../tests/e2e/theme.spec.ts), [accessibility E2E](../../tests/e2e/a11y.spec.ts), and theme/formatter unit tests.
- [Store capture scripts](../../scripts/generate-store-assets.js), [demo scenario](../../tests/e2e/demo.spec.ts), and the [historical demo board](../../agent-os/product/demo-video-kanban.md) explain recording context.

The axe gate covers the scenarios it opens; it does not certify every interaction. Storybook compilation and recorded-video quality require their own runs and are not inferred from mock E2E.


## Control boundary polish: 2026-10-10

Field, SearchField and Select use a visible resting control border. The light token reuses the existing checkbox-border color, measured at 3.45:1 against the page surface; dark remains 5.57:1. Focus and invalid states retain their own borders/rings. Muted download metrics and toolbar labels use the existing text-muted token rather than an undefined alias. The contrast guard now includes the control boundary pair.
