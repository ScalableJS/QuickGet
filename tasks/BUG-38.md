---
type: "task"
id: "BUG-38"
status: "done"
priority: "p2"
area: "popup/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Destination NAS path (`path` / `move`) is omitted from task details

**Severity:** medium · **Area:** popup/UX
**Files:** `src/lib/tasks.ts`, `src/popup/components/downloadItem/format.ts`,
`src/popup/components/downloadItem/DownloadItem.svelte`,
`src/popup/components/downloadItem/downloadItem.stories.ts`

QNAP returns destination directories `move` (final destination folder) and `temp` (temporary staging).
Users managing multi-folder setups or custom routing rules cannot see where a download was placed
directly from the popup.

**Severity raised from low on 2026-09-09.** It stopped being a details-panel nicety once routing
rules became a real feature: the destination is the *only* feedback a rule ever gives, so without
it a rule sending everything to the wrong folder looks exactly like a rule that works. That is
also why it is worth more than the notification it replaces — a toast says it once and is gone,
the card says it for as long as the task exists.

**Resolved 2026-09-09.** `Task.destination` carries `move` through normalisation, and the card
renders it as the last item of the meta row, after the ETA, with a folder icon and a `Saving to …`
tooltip carrying the full path.

Three decisions worth keeping:

- **`move`, never `path`.** `path` is where the bytes physically are and includes the task's own
  name, so it is not a folder anybody chose. When the NAS reports no `move`, the card says nothing
  rather than guessing at the default.
- **Two trailing segments, folded from the front** (`…/Documentaries/2024`). The end identifies the
  folder; the head is the same for every task. One segment loses what tells `Movies` apart from
  `Music/Movies`. Nothing is hidden — the tooltip has the whole path.
- **It is the only shrinking item in the row**, so a long path folds instead of pushing the size
  and speed off the card.

Covered by `formatDestination` unit tests, a normalisation test asserting `path` is *not* a
fallback, six Storybook stories (short, two-segment, deep, overlong, unknown, finished), and an
assertion in the full-cycle E2E.

**Prior art: none.** Not one of the three competitors shows a destination on a task card. *Send To
QNAP++* has the data and spends it on a click-to-copy absolute path and an `openfolder:\\…`
custom-protocol link that needs a helper installed; its own meta row is `ETA • ↓ • ↑ • size`. The
Synology client treats `destination` purely as a request field. See
`docs/competitor-routing-teardown.md`.

**2026-09-09, later — two corrections after looking at it in Storybook.**

- **The staging folder is shown too.** Download Station stages a task in `temp` and moves it to
  `move` on completion, so while a task runs the data is *not* where the rule sent it. The card
  reads `Download → Multimedia/Movies` until the move happens and just `Multimedia/Movies`
  afterwards — the difference between "look in Movies" and "look in Movies later". Suppressed when
  the two folders are the same.
- **It has its own line.** Inline in the meta row it was the first thing truncated away — the
  screenshot showed a folder icon and nothing after it, which is precisely the information the
  card exists to carry. One 11px row under the status line, both folders truncating
  independently.

**2026-09-09, third pass — the line only appears when it is news.** Looking at a list of cards in
Storybook, the folder row was on every one of them, and on most it said "this went where
everything goes". Two cuts, both on the product owner's call:

- **Shown only when the destination differs from the configured Target folder.** The user chose
  that folder; repeating it back on every task is noise. The card is exactly its pre-routing shape
  for the ordinary case and grows by one line precisely when a rule did something.
- **The staging folder left the card for the tooltip.** `temp` is one global setting, so on the
  card it was the same string repeated down the whole list. In the tooltip it still answers
  "where is it right now" — until the task finishes, after which naming it would point at an
  empty directory.

`defaultFolder` reaches the card as a prop from `DownloadsList`, which loads settings on mount.
Undefined means "not known yet" and shows the destination rather than guessing it away; settings
resolve long before the first NAS poll, so it is not seen in practice.

**Competitor context for the density question** (`docs/competitor-routing-teardown.md`): *Send To
QNAP++* solves it with an explicit compact/expanded toggle persisted in storage — compact hides
the whole meta row and swaps the bar for a 28px ring. It also measures that row and shrinks its
font to as low as 9px when it overflows, which is an admission that one dense row does not fit.
Hover is used there for exactly one thing, a delayed tooltip on the title. Neither of the other
two has any density control. A density toggle stays out of scope; showing less by default is the
cheaper half of the same idea.

**2026-09-09, closing the loop — and a mock that was lying about magnets.** Everything up to here
asserted what was *sent* to the NAS. Nothing asserted that the folder comes back and reaches the
user. Adding that check surfaced the reason it mattered: the mock's `AddUrl` read the `move` it
was given, validated it, and then created the task with a hardcoded `Movies` — `AddTorrent` had
always persisted both folders, `AddUrl` never had. So the one path where routing has neither a
filename nor a host of its own to work from was also the one path the harness could not tell the
truth about. Fixed, and `routing-matrix.spec.ts` now reloads the popup and asserts the magnet's
card displays the routed folder, and that a task which went to the Target shows no line at all.

**Resolved 2026-09-09** — shipped in v2.3.0.
