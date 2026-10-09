---
type: "task"
id: "BUG-24"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Duplicate listener releases another listener's in-flight ownership

**Severity:** high · **Area:** background

A concurrent `onCreated`/`onChanged` invocation that fails `claimDownload()` still executes the
outer `finally` and deletes the shared `inFlight` id. A third event can enter before the owner
writes its session claim. Acceptance: only the invocation that acquired ownership may release
the in-memory guard; a gated three-listener test must produce one NAS hand-off.

**Resolved 2026-08-29** — ownership is tracked per invocation; rejected listeners cannot delete
the owner's guard. As of 2026-08-30 the guard is in memory only; no durable claim exists.
