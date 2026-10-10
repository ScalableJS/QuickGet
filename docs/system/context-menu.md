---
type: architecture
status: active
area: background
updated: 2026-10-10
features: ["context-menu"]
---

# Context-menu sends

The extension creates one link-context send action. Reinitialization removes old items before recreating them; it is not another click listener per update.

The link handler accepts HTTP(S) or magnet sources. `classifySource()` chooses whether to fetch/upload a torrent descriptor or call `AddUrl`. Routing sees the same classification and the originating tab URL. This is an explicit user send; it does not cancel an unrelated browser download. Successful sends re-arm monitoring and remain silent at the system-notification level; failures are surfaced as a direct notification and toolbar attention.

The shared `sendDownloadToStation()` function is also used by ordinary-file page messages. Reuse here is intentional; consolidating torrent download events into it would discard their filename/cancellation transaction.

## Sources and evidence

- [menus.ts](../../src/background/menus.ts), [worker dispatcher](../../src/background/index.ts), [menus unit tests](../../src/background/menus.test.ts).
- [Routing E2E](../../tests/e2e/routing-rules.spec.ts) exercises context-menu send destinations.
- [[feedback]] describes the difference between page feedback and menu notification behavior.

## Duplicate acceptance

A supported duplicate API error is an accepted existing task, not a configuration failure. The shared page-link transport returns duplicate metadata for page feedback; the context-menu caller keeps its quiet success policy and current task-list/toolbar confirmation. Torrent transport supplies its existing structured duplicate result. Unsupported failures still propagate and request attention.
