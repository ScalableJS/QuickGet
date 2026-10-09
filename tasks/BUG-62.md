---
type: "task"
id: "BUG-62"
status: "done"
priority: "p2"
area: "background/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Toolbar badge number includes seeding instead of counting downloads only

**Severity:** medium · **Area:** background/UX
**Production files:** `src/lib/tasks.ts`, `src/background/actions.ts`, `src/background/alarms.ts`,
`src/background/index.ts`, `src/background/monitorMessage.ts`, `src/popup/shared/monitor.ts`,
`src/popup/features/downloads/index.ts`
**Test files:** `src/lib/tasks.test.ts`, `src/background/actions.test.ts`,
`src/background/alarms.test.ts`, `src/popup/shared/monitor.test.ts`,
`tests/e2e/download-interception.spec.ts`

The toolbar badge currently reuses the popup's broad `isInProgress()` classification. Its number
therefore includes queued/downloading/finishing/moving tasks *and* torrents that have already
finished downloading and are only seeding. A persistent `3` can consequently mean three files
still being acquired, three complete files being seeded, or a mixture.

This is a UX-semantics problem, not just a counting bug. BUG-34 deliberately keeps seeding visible
in the popup because its quota, ETA, ratio, peers, and upload rate matter there. The toolbar needs
two independent signals: the green icon means Download Station is active with either downloading
or seeding work, while the numeric badge means how many tasks are still in the download phase.

**Competitor evidence to validate, not copy blindly:** qBittorrent exposes separate `downloading`,
`seeding`, and `completed` filters rather than collapsing them into one status count; Transmission
and Synology Download Station likewise expose downloading and seeding as distinct task states.
Before implementation, inspect the current toolbar/menu-bar surfaces of qBittorrent-adjacent browser
extensions, Synology/QNAP helpers, and at least one mainstream download manager: record what their
badge number counts, whether seeding keeps an icon active, and how they make the final download's
completion visible.

**Chosen direction — two-channel toolbar semantics:**

- **Green icon + number `N`:** `N` tasks are still downloading; one or more tasks may also be
  seeding. The number never includes seeding tasks.
- **Green icon without a number:** there are no downloads, but at least one torrent is seeding.
- **Idle icon without a number:** neither downloading nor seeding is active.
- Existing red configuration errors and gray notices continue to override the ordinary activity
  presentation.

The transition from `green + 1` to `green without a number` is itself the lightweight completion
signal: the content is ready and the NAS has moved on to seeding. Do not add a temporary check mark,
Chrome/desktop notification, sound, toast, or any other completion notification in this iteration.
When a non-torrent download finishes without entering seeding, the toolbar returns directly to idle.

**Implementation task:**

1. Replace the ambiguous `ProgressSummary.active` field with two explicit toolbar facts:
   `downloading` (tasks whose requested content is not ready yet) and `seeding`. Keep `all`,
   `downRate`, and `upRate`. Update both producers of this DTO: the alarm's `Task/Query` result and
   the popup snapshot sent through `qg:badgeSnapshot`.
2. Add a narrowly named predicate for `downloading`. It includes the pre-ready pipeline currently
   represented by `queued`, `queuedChecking`, `downloading`, `downloadingMetadata`, `paused`,
   `checking`, `repairing`, `extracting`, `finishing`, `moving`, and `allocating`; it excludes
   `seeding`, `finished`, `stopped`, and `error`. This is intentionally broader than transfer rate:
   the number answers “how many requested items are not ready yet”, so it must not disappear during
   QNAP's `downloading → moving → seeding` chain. Keep `isInProgress()` unchanged for popup filtering.
3. In `applyBadgeStats()`, derive `hasActivity = downloading > 0 || seeding > 0`. `hasActivity`
   selects the existing green `ACTIVE_ICON_PATH`; badge text is `String(downloading)` when non-zero
   and `""` otherwise. Pure seeding therefore clears the old number but keeps the existing green
   icon. Zero/zero restores `IDLE_ICON_PATH`.
4. Return enough information from `applyBadgeStats()` for callers to keep polling while either
   downloading or seeding exists. `idleConfirmed` is true only for `downloading === 0 && seeding === 0`;
   the popup message handler must arm monitoring for the same condition. Do not let pure seeding
   clear the `download-monitor` alarm, otherwise completion of seeding can never return the icon to
   idle without reopening the popup.
5. Change the ordinary tooltip from ambiguous `Active: N` to separate `Downloading: N` and
   `Seeding: N` lines, retaining total and both transfer rates. Pure seeding must be understandable
   from the tooltip even though the badge is empty.
6. Preserve `chrome.storage.session` state, serialized writes, diff guards, rejected-write retry,
   and the precedence of red `!` and gray `i` badges. A failed NAS poll follows the existing
   monitoring-error contract; this task must not silently paint a guessed zero.
7. Do not call `src/background/notifier.ts`, add notification code, change notification permission,
   or emit a Chrome/desktop notification, sound, popup toast, or temporary completion glyph.
8. Keep BUG-39 compatible: `Task/Status` already exposes separate `downloading` and `seeding`
   fields, but this task may continue using `Task/Query` because it must count moving/checking and
   other normalized pre-ready states correctly. A later lightweight-poll migration must preserve
   the semantics defined here rather than reverting to aggregate `active`.

**Existing tests to update:**

- `src/background/actions.test.ts`: replace the `stats(active)` fixture with explicit downloading
  and seeding counts; update result and tooltip assertions; retain the existing diff-guard,
  persisted-state, rejected-write, concurrency, and error-precedence regressions under the new DTO.
- `src/background/alarms.test.ts`: rename the old “in-progress tasks matching popup” expectation;
  keep the finishing/moving regression as part of the download count; update idle semantics so a
  seeding-only query keeps the alarm and green icon while clearing badge text.
- `src/popup/shared/monitor.test.ts`: update the serialized `ProgressSummary` payload and continue
  asserting that the popup only sends a message rather than writing `chrome.action` directly.
- `tests/e2e/download-interception.spec.ts`: update both hand-built `qg:badgeSnapshot` payloads in
  “returns the toolbar to idle…” and “updates the toolbar once…”; their old `{ active }` shape must
  no longer compile or be accepted as the current contract.

**New tests to add:**

- `src/lib/tasks.test.ts`: table-test the new download-count predicate for every `TaskStatus`, then
  test `summarizeProgress()` for pure download, pure seed, mixed, and idle arrays. Assert that rates
  and `all` remain unchanged and seeding never increments `downloading`.
- `src/background/actions.test.ts`: add the presentation matrix: `(2,0) → green + "2"`, `(2,3) →
  green + "2"`, `(0,3) → green + ""`, `(0,0) → idle + ""`; add the real transition
  `(1,1) → (0,2) → (0,0)` and assert no redundant icon/color writes.
- `src/background/alarms.test.ts`: add QNAP jobs `104 + 100`, `100 only`, and `100 → 5` across
  alarm ticks. Assert mixed count excludes state `100`, pure seed keeps monitoring, and completed
  seed stops monitoring and restores idle.
- `tests/e2e/download-interception.spec.ts`: extend the existing toolbar transition test (do not
  create a second toolbar harness) with `download + seed → seed only → idle`; assert real action
  badge text plus persisted `icon`, and assert meaningful-write counts still prove the diff guard.

**Acceptance criteria:**

1. With two pre-ready tasks and three seeding tasks, the toolbar uses the existing green icon and
   displays `2`, never `5`.
2. With zero pre-ready tasks and at least one seeding task, the toolbar remains green with no badge
   text; the tooltip reports the seeding count and upload rate.
3. With neither downloading nor seeding, the toolbar is idle with no badge and monitoring stops
   only after that successful zero/zero snapshot.
4. The transition from the final download to seeding clears the number without flashing idle or
   changing away from the green icon. When the final seed finishes, the icon returns to idle.
5. The popup's “In progress” behaviour and seeding cards/metrics remain unchanged.
6. Red configuration failures and gray action-needed notices retain their current precedence;
   failed action writes remain retryable and concurrent updates cannot overwrite newer state.
7. No completion notification, sound, toast, temporary check mark, or manifest permission change
   is introduced.
8. The updated unit suite, production build, and mock-extension E2E pass:
   `npm run typecheck`, `npm run check:svelte`, `npm run lint`, `npm test`, `npm run build`, and
   `npm run test:e2e:mock`.

**2026-09-13 — done.** Built as specified. `ProgressSummary.active` became `downloading` +
`seeding`; `isDownloadPhase()` is a new predicate written out in full rather than derived as
`IN_PROGRESS_STATUSES` minus `seeding`, so a status joining the popup's filter later cannot move
the badge by accident. `applyBadgeStats()` collapsed to one path — text is `downloading` or empty,
the icon follows `downloading > 0 || seeding > 0`, and badge colour is only written behind visible
text. It returns both counts, and `src/background/index.ts` re-arms the poll for either, so a seed
finishing after the popup closes still returns the icon to idle. The tooltip is `Downloading: N` /
`Seeding: N`; `Active:` is gone and a test asserts its absence.

Tests: +31 unit (483 total) and the extended E2E transition. The exhaustive status table in
`tasks.test.ts` also pins the one intended difference from the popup filter — `differ` must equal
exactly `["seeding"]`. The E2E now runs `1 download + 2 seeds → 3 seeds → idle` and asserts the
real `chrome.action` badge text alongside the persisted icon, with the icon written exactly twice
across the whole sequence: lit at the start, dimmed at the end, and deliberately **not** repainted
at the download→seeding step, which is what keeps that transition from flickering through idle.

`check:contrast` 24/24, `test:e2e:mock` 41/41, typecheck/svelte-check/lint clean.

**One step of this card was not completed:** the competitor survey ("inspect the current
toolbar/menu-bar surfaces of qBittorrent-adjacent browser extensions … record what their badge
number counts"). The extension sources from the earlier teardown are no longer on disk, a web
search turned up nothing about badge semantics in those extensions, and `docs/competitor-*.md`
records nothing about badge behaviour. The design shipped is the one this card had already chosen;
it was not validated against a fresh competitor sample, and that is worth knowing before treating
the two-channel scheme as externally confirmed rather than internally reasoned.
