---
type: "task"
id: "BUG-16"
status: "done"
priority: "p2"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Interception error badge has no defined lifetime

**Severity:** medium · **Area:** background
**Files:** `src/background/actions.ts`, `src/background/notifier.ts`, `src/background/alarms.ts`

The red `!` after a failed torrent interception has no documented product lifetime. It is unclear
whether it should persist until explicit acknowledgement, disappear after a timeout, clear after
the next successful hand-off, or remain until the underlying failure is demonstrably resolved.

**Required investigation:** compare error-state lifecycles in Chrome/Edge downloads, QNAP,
Synology and established torrent clients; distinguish transient interception failures from
persistent NAS connectivity/configuration failures; define acknowledgement, timeout and recovery
rules that do not hide a failure before the user can notice it. Cover MV3 restarts, concurrent
success/failure ordering and stale persisted toolbar state with tests before changing behaviour.

**Reported 2026-08-29** — the user expected the interception error to remain visible only for a
bounded time, but the intended behaviour and competing conventions have not been established.

**Resolved 2026-08-29** — product rule: the error has no timer. Its reason is persisted for the
browser session and the red `!` remains until the popup is opened. Opening the popup atomically
returns the reason for the top error pill and acknowledges the toolbar alarm; later successful
handoffs and background polls cannot erase an unread failure.
