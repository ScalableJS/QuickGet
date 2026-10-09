---
type: "task"
id: "BUG-17"
status: "done"
priority: "p2"
area: "background/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Context-menu actions are unclear and appear in irrelevant places

**Severity:** medium · **Area:** background/UX
**Files:** `src/background/menus.ts`, `src/background/menus.test.ts`

Chrome currently registers `Send with QuickGet` for both links and arbitrary selected text, and
`Send current page with QuickGet` for every page context. The labels do not explain what object
will be sent, where it will go, or the difference between the two actions. The page action also
appears away from download links and can be visible on QuickGet's own extension UI, where its
purpose is especially unclear.

**Required investigation:** enumerate the useful user journeys (torrent link, magnet, direct file
URL, selected URL and current-page URL); decide whether current-page sending is a real supported
feature or accidental surface area; test Chrome `documentUrlPatterns`/`targetUrlPatterns` limits;
exclude extension and unsupported schemes where possible; and replace the labels with explicit
object/action wording. The menu must not imply that arbitrary page content is sent when the
implementation only passes `tab.url`, and invalid selected text should not be presented as a
working action if Chrome cannot conditionally validate it.

**Reported 2026-08-29** — users cannot infer the distinction between `Send with QuickGet` and
`Send current page with QuickGet`; both appear in unexpectedly broad contexts, including the
extension itself.

**Resolved 2026-08-29** — retained one link-only action named `Send link to Download Station`.
Removed the page and selected-text actions, restricted the menu to web documents, and reject
non-HTTP(S)/magnet targets before contacting the NAS.
