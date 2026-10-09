---
type: "task"
id: "ENG-11"
status: "done"
priority: "p1"
area: "background/content"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Done"
size: "M"
---

# Audit browser-event ownership and remove only proven duplicate listeners

**Priority:** P1 · **Size:** M · **Area:** background/content
**Files:** `src/background/index.ts`, `src/background/downloads.ts`, `src/content/magnet.ts`,
background/content registration helpers and interception tests

The intermittent torrent symptom is no longer reproducible after reinstalling the extension and
the current maintenance changes. That is evidence to inspect ownership, not evidence for a new
deduplication layer. Before GAP-16 changes interception, inventory every browser listener and
initialization path that can observe a click/download or issue a NAS request.

Compare the resulting event graph with the smallest competitor patterns already inspected:
Wolff/garoloup is context-menu-only; the Synology client uses download lifecycle events for its
transaction; Send To QNAP++ combines download and navigation events. More listeners are not a bug
by themselves — each must be tied to a distinct browser/user intent and tested by request count.

**Acceptance:**

- list every relevant `chrome.*.addListener`, content-script registration/reinjection, storage
  change listener, alarm and startup initializer, with its owner and whether it can reach
  `AddTorrent`/`AddUrl`;
- prove with tests which paths can observe the same action (`downloads.onCreated`,
  `downloads.onChanged`, content click, context menu, reinjection and worker restart);
- record the single component responsible for cancellation/resume and for each user-visible
  notification;
- remove or consolidate a listener only when a failing request-count/browser-outcome test proves
  duplication, then keep that test as the regression contract;
- create separate follow-up cards for confirmed complexity that is unsafe to remove in this
  audit; do not turn suspicions into production changes.

**Forbidden shortcut:** no persistent browser-download/task-ID history, startup sweep, or broader
retry state may be introduced to “make duplicates impossible” without a captured duplicate and a
trace showing its source. A clean audit with no deletion is a valid result.

**Completed 2026-09-15 — shipped in v2.6.0.** The event inventory found no duplicate browser listener that could be
removed safely:

| Owner | Trigger | NAS reachability | Distinct responsibility |
|---|---|---|---|
| `downloads.ts` | `downloads.onCreated`, `downloads.onChanged`, Chromium `onDeterminingFilename` | `AddTorrent` | one download lifecycle; the synchronous in-memory claim elects one request owner |
| `magnet.ts` → runtime message | captured magnet click | `AddUrl` | navigation intent; the content-script in-flight guard owns the click until a response |
| `magnet.ts` → runtime message | opted-in or Shift ordinary-file click | `AddUrl` | page-session hand-off for a link the downloads listener must not pre-empt |
| `menus.ts` | context-menu click | `AddUrl`/`AddTorrent` | explicit user command |
| `alarms.ts`, startup | alarm/startup | none (`Task/Query` only) | monitoring, not task creation |

The only shared observation is `downloads.onCreated` plus `downloads.onChanged` (and, on Chromium,
the filename decision for the same item). An exact-count unit contract proves that concurrent
callbacks issue one `AddTorrent`; persistent-profile E2E proves reinjection still produces one
request for both torrent and magnet clicks. Content reinjection calls the previous document and
storage-listener cleanup before registering replacements, and context-menu initialization removes
old items before recreating them.

No production listener was deleted because no duplicate request was reproduced. The separate
five-second `recentMagnets` request cache was removed: it had no browser-event source behind it and
duplicated the live click ownership already enforced in the content script. No persistent
download/task IDs, startup sweep, or retry state were added. Cancellation and browser fallback are
owned only by `downloads.ts`; click feedback and native-navigation fallback are owned only by the
content script.
