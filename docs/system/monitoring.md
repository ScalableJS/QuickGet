---
type: architecture
status: active
area: background
updated: 2026-10-10
features: ["background-monitoring"]
---

# Monitoring and browser action state

The background is the sole writer of the browser action icon, badge, title, and attention state. `qg:toolbarState` lives in session storage; action updates are serialized. The popup sends its freshly rendered counts by message, avoiding disagreement with its in-progress tab.

Background `download-monitor` alarms are armed idempotently at a 30-second period. Installation, update, browser startup, popup opening, and successful sends can request an immediate query and arm the next alarm. Alarm presence persists across worker wakes; an in-memory client cache and short concurrency queues are optimizations, not durable monitoring ownership.

The current poll calls `Task/Query` and derives counts; it does not use the lighter `Task/Status` API. The badge number counts downloads only; seeding keeps monitoring active without inflating the number. Each successful NAS snapshot is authoritative, including the first zero; an idle alarm tick stops polling immediately. The current implementation has no consecutive-idle hysteresis. A popup snapshot uses the same writer. Clearing the popup list during connection replacement does not publish an empty NAS snapshot; only the replacement query can confirm its counts. Background results and failures must own both the current connection signature and the latest poll revision. Confirmed popup snapshots invalidate older background polls. The serialized toolbar writer checks ownership after loading persisted state, immediately before applying the update; a queued stale success or failure cannot commit attention for another connection. The revision check follows the awaited settings read, so another poll cannot invalidate an earlier check unnoticed.

Alarm creation and removal share one queue. Removal rechecks poll ownership and the monitoring revision; a newer monitoring request either prevents removal or re-arms after an already-running removal finishes. Failure to remove an alarm is logged as a browser bookkeeping failure and does not turn a successful NAS snapshot into connection attention.

Missing configuration stops the alarm and surfaces actionable attention. A monitoring failure calls `markMonitoringUnavailable()` and clears the alarm; the next explicit monitoring request can retry. Documentation does not promise continuous automatic retries after that failure. Gray tracker/send notices and red configuration attention survive successful task polls until popup acknowledgement; red has priority. Acknowledging gray clears it without reporting a NAS connection failure. Icons still reflect current activity, and failed acknowledgement writes retain state for retry. Attention acknowledgement is distinct from successful task data and must not pretend the NAS was checked.

## Sources and evidence

- [alarms.ts](../../src/background/alarms.ts), [actions.ts](../../src/background/actions.ts), [worker](../../src/background/index.ts), [popup bridge](../../src/popup/shared/monitor.ts).
- Alarm/action/monitor unit tests cover serialization, failed writes, authoritative zero handling, and request ownership.
- [Toolbar behavior](../toolbar-actions.md) provides the deeper state rationale.
- [BUG-39](../../tasks/BUG-39.md) records the lighter polling opportunity. [BUG-58](../../tasks/BUG-58.md) scopes popup polling feedback and recovery; the worker remains the only toolbar writer and actionable attention still requires popup acknowledgement.
