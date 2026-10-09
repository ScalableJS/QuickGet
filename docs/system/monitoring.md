---
type: architecture
status: active
area: background
updated: 2026-10-09
features: ["background-monitoring"]
---

# Monitoring and browser action state

The background is the sole writer of the browser action icon, badge, title, and attention state. `qg:toolbarState` lives in session storage; action updates are serialized. The popup sends its freshly rendered counts by message, avoiding disagreement with its in-progress tab.

Background `download-monitor` alarms are armed idempotently at a 30-second period. Installation, update, browser startup, popup opening, and successful sends can request an immediate query and arm the next alarm. Alarm presence persists across worker wakes; an in-memory client cache and short concurrency queues are optimizations, not durable monitoring ownership.

The current poll calls `Task/Query` and derives counts; it does not use the lighter `Task/Status` API. The badge number counts downloads only; seeding keeps monitoring active without inflating the number. Each successful NAS snapshot is authoritative, including the first zero; an idle alarm tick stops polling immediately. The current implementation has no consecutive-idle hysteresis. A popup snapshot uses the same writer.

Missing configuration stops the alarm and surfaces actionable attention. A monitoring failure calls `markMonitoringUnavailable()` and clears the alarm; the next explicit monitoring request can retry. Documentation does not promise continuous automatic retries after that failure. Attention acknowledgement is distinct from successful task data and must not pretend the NAS was checked.

## Sources and evidence

- [alarms.ts](../../src/background/alarms.ts), [actions.ts](../../src/background/actions.ts), [worker](../../src/background/index.ts), [popup bridge](../../src/popup/shared/monitor.ts).
- Alarm/action/monitor unit tests cover serialization, failed writes, authoritative zero handling, and request ownership.
- [Toolbar behavior](../toolbar-actions.md) provides the deeper state rationale.
- [BUG-39](../../tasks/BUG-39.md) records the lighter polling opportunity. [BUG-58](../../tasks/BUG-58.md) remains a feedback follow-up, not permission to change ownership during this audit.
