---
type: "task"
id: "GAP-6"
status: "rejected"
priority: "p2"
area: "popup/background"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Rejected"
size: "S"
---

# Destination choice is missing from the paths that send most downloads

**Size:** S · **Area:** popup/background
**Files:** `src/popup/features/folderPicker/` (reuse `FolderSelect`);
`src/background/menus.ts`; `src/api/client.ts` (already parameterised)

**This card was originally written as "no choice of destination at send time", which is
wrong — corrected 2026-08-31 after reading the code.** Two mechanisms already exist:

- **Routing rules are shipped** (F3, not "unbuilt" as an earlier version of this card said).
  `resolveDestination` runs in the context-menu path, in `.torrent` interception
  (`downloads.ts:293`) and in the Chooser pre-fill, matching on URL, domain or task name.
- **Quick-add in the popup already has a folder picker** — `CreateUrls.svelte` renders a
  `FolderSelect` seeded with the configured target, and deliberately bypasses rules so an
  explicit choice wins.

So the real gap is narrower, and mostly about the automatic path: when a `.torrent` is
intercepted and no rule matches, it goes to `NASdir` with no opportunity to say otherwise, and
nothing after the fact can change it (RES-3/RES-4). A user whose download went to the wrong
folder has no recourse inside the extension.

**What is actually missing**

- [ ] A way to influence the destination of an *intercepted* download, which is the path with
      no UI at all today.
- [ ] Somewhere to see which folder a task was sent to, so a wrong destination is noticed
      before the download finishes rather than after.

**The unresolved design question, and it is the whole card:** interception is *automatic*.
There is no natural moment to ask, and a modal on every download would ruin the feature the
demo is built around. Given that routing rules already handle the "always send this kind of
thing there" case well, the honest options are narrow: surface the chosen folder and let the
user re-route *before* the task is created (a brief undo-style window), or accept that
interception follows rules and settings only, and put the effort into making the destination
visible instead. **Settle this before writing code** — the wrong answer here makes the product
worse, and the cheapest good answer may be "show, do not ask".

**Acceptance criteria**

- [ ] The destination an intercepted task was given is visible to the user without opening
      Settings.
- [ ] Whatever is added does not slow the common case: a user who does not care must not gain
      a step, and interception must never block on a dialog.
- [ ] Any folder offered is validated through the existing `Misc/Dir` writability check rather
      than free text.
- [ ] A per-send choice never silently rewrites the default in Settings.
- [ ] Routing rules keep priority where they match; this must not become a second, competing
      mechanism for the same decision.

**2026-09-09 — the "show, do not ask" half now has a card.** UX-20 covers surfacing the folder a
task was given *and* which rule chose it, using `move`/`path` that `Task/Query` already returns.
The re-route half is scoped by GAP-14, which splits it into the windows that actually exist. The
duplicated closing paragraph below is drift from an earlier edit — the two copies say the same
thing.

**The unresolved design question, and it is the whole card:** interception is *automatic*.
There is no natural moment to ask, and a modal on every download would ruin the feature that
the demo is built around. Options are a default-with-override (send immediately, offer to
re-route from the popup — depends on RES-3), a per-send choice only where a UI already exists
(context menu, popup), or routing rules (F3) doing this without asking at all. **Settle this
before writing code**; the wrong answer here makes the product worse.

**2026-09-09 — Rejected; both halves resolved elsewhere.** The card's own text called the design
question "the whole card": interception is automatic, so there is no natural moment to ask, and a
modal per download would ruin the feature. That question is now moot rather than answered.

- **"Ask" is unnecessary.** The reason to ask was that rules routinely got it wrong, and they did
  because they matched on the URL. They now match on the release name and the originating site, so
  the automatic answer is usually the right one.
- **"Show" is BUG-38**, which stays open and is one field: `Task/Query` already returns `move` and
  `path`.

Nothing is left that this card would carry on its own.

**2026-09-09 — and the "show" half is now Done too** (BUG-38): the destination is on every task
card, folded to its last two segments with the full path in the tooltip. Nothing is left of this
card in any form.
