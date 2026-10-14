# Bugs — Kanban

Single source of truth for open defects. Full analysis and root causes for the interception
bugs live in `docs/download-interception-bugs.md`.

Task files are canonical; this document keeps board context, historical notes, and stable card links.

---

## Board

Open [the task board](../../views/tasks.base) and filter `board` by `bugs`.
The frontmatter of [task files](../../tasks/README.md) owns status.

## Cards

### BUG-70 — Deleted torrent can intermittently reappear on QNAP after a full Chrome restart

[BUG-70](../../tasks/BUG-70.md) — canonical task and status.

### BUG-71 — Send feedback appears for some torrent/link paths but not for others

[BUG-71](../../tasks/BUG-71.md) — canonical task and status.

### BUG-59 — Shift-click reports "Could not contact QuickGet" and still opens the browser save flow

[BUG-59](../../tasks/BUG-59.md) — canonical task and status.

### BUG-60 — Shift-click E2E passes without proving the real browser outcome or extension-lifecycle failure

[BUG-60](../../tasks/BUG-60.md) — canonical task and status.

### BUG-61 — Torrent interception setting uses oversized copy and promises behavior the product does not guarantee

[BUG-61](../../tasks/BUG-61.md) — canonical task and status.

### BUG-62 — Toolbar badge number includes seeding instead of counting downloads only

[BUG-62](../../tasks/BUG-62.md) — canonical task and status.

### BUG-34 — Seeding tasks vanish from "In progress" and obscure seeding progress/ETA metrics

[BUG-34](../../tasks/BUG-34.md) — canonical task and status.

### BUG-35 — Peer and seed counts provided by NAS are never displayed in the popup

[BUG-35](../../tasks/BUG-35.md) — canonical task and status.

### BUG-36 — Download payload size and progress in bytes (`done` / `size`) are hidden during download

[BUG-36](../../tasks/BUG-36.md) — canonical task and status.

### BUG-37 — Task failure codes (`error`) from QNAP are ignored instead of displaying failure reason

[BUG-37](../../tasks/BUG-37.md) — canonical task and status.

### BUG-38 — Destination NAS path (`path` / `move`) is omitted from task details

[BUG-38](../../tasks/BUG-38.md) — canonical task and status.

### BUG-39 — Toolbar badge background poll fetches full task list instead of lightweight `Task/Status`

[BUG-39](../../tasks/BUG-39.md) — canonical task and status.

### BUG-40 — Saving settings hangs on "Saving…" for >10s when NAS is unreachable or credentials invalid

[BUG-40](../../tasks/BUG-40.md) — canonical task and status.

### BUG-58 — The background task poller writes its errors into the settings screen's status pill

[BUG-58](../../tasks/BUG-58.md) — canonical task and status.

### BUG-41 — Saving routing rules with empty optional fields crashes Svelte with props_invalid_value, freezing "Add rule"

[BUG-41](../../tasks/BUG-41.md) — canonical task and status.

### BUG-42 — Routing rules parser edge cases: case-sensitive .torrent, fragile magnet dn parsing, unhandled URI errors, and domain normalization

[BUG-42](../../tasks/BUG-42.md) — canonical task and status.

### BUG-43 — Routing rules UX in popup: cramped single-line layout, missing priority reorder controls, and silent rule drop

[BUG-43](../../tasks/BUG-43.md) — canonical task and status.

### BUG-44 — Comprehensive regression coverage & post-fix test suite for Routing Rules

[BUG-44](../../tasks/BUG-44.md) — canonical task and status.

### BUG-45 — Routing engine ReDoS vulnerability in matchGlob, sanitizer condition-invariant gap, and type: "all" draft smell

[BUG-45](../../tasks/BUG-45.md) — canonical task and status.

### BUG-46 — Routing type detection disagrees with the send-path detector, so `.torrent` rules miss tracker links

[BUG-46](../../tasks/BUG-46.md) — canonical task and status.

### BUG-47 — Rules match the URL slug instead of the name the download will actually have

[BUG-47](../../tasks/BUG-47.md) — canonical task and status.

### BUG-48 — Rule condition errors are not tied to the fields they describe

[BUG-48](../../tasks/BUG-48.md) — canonical task and status.

### BUG-49 — Reordering a rule drops keyboard focus and announces nothing

[BUG-49](../../tasks/BUG-49.md) — canonical task and status.

### BUG-50 — Rule card small print fails contrast and lowercases the AND it exists to explain

[BUG-50](../../tasks/BUG-50.md) — canonical task and status.

### BUG-51 — The axe gate never reaches the routing rules UI

[BUG-51](../../tasks/BUG-51.md) — canonical task and status.

### BUG-52 — Delete sits next to the reorder arrows and looks identical to them

[BUG-52](../../tasks/BUG-52.md) — canonical task and status.

### BUG-53 — Rule editor a11y polish batch: focus, labels, dead class, literal caps

[BUG-53](../../tasks/BUG-53.md) — canonical task and status.

### BUG-54 — Popup `.torrent` upload bypasses routing rules entirely

[BUG-54](../../tasks/BUG-54.md) — canonical task and status.

### BUG-55 — Routing edge cases have no test at the level that can reach them

[BUG-55](../../tasks/BUG-55.md) — canonical task and status.

### BUG-56 — The test stand advertises cases it cannot exercise

[BUG-56](../../tasks/BUG-56.md) — canonical task and status.

### BUG-57 — A wildcard-only pattern is a catch-all the sanitizer was written to prevent

[BUG-57](../../tasks/BUG-57.md) — canonical task and status.

### BUG-33 — Torrent interception starts before a live NAS connection is established

[BUG-33](../../tasks/BUG-33.md) — canonical task and status.

### BUG-32 — Optimistic toolbar paint left dangling references after the badge refactor

[BUG-32](../../tasks/BUG-32.md) — canonical task and status.

### BUG-31 — Successful torrent hand-offs retain a Chrome DownloadItem after restart

[BUG-31](../../tasks/BUG-31.md) — canonical task and status.

### BUG-30 — Intercepted `.torrent` still reaches the disk — no filename-stage suppression

[BUG-30](../../tasks/BUG-30.md) — canonical task and status.

### BUG-29 — Tracker-auth send failure is painted as a hard extension error

[BUG-29](../../tasks/BUG-29.md) — canonical task and status.

### BUG-25 — Worker death between pause and pending-marker write strands a download

[BUG-25](../../tasks/BUG-25.md) — canonical task and status.

### BUG-24 — Duplicate listener releases another listener's in-flight ownership

[BUG-24](../../tasks/BUG-24.md) — canonical task and status.

### BUG-22 — Invalid settings leave a stale active toolbar

[BUG-22](../../tasks/BUG-22.md) — canonical task and status.

### BUG-23 — Failed attention acknowledgement discards the reason

[BUG-23](../../tasks/BUG-23.md) — canonical task and status.

### BUG-26 — Monitoring retry inherits an exhausted error streak

[BUG-26](../../tasks/BUG-26.md) — canonical task and status.

### BUG-28 — Concurrent monitoring requests duplicate QNAP task queries

[BUG-28](../../tasks/BUG-28.md) — canonical task and status.

### BUG-27 — Every monitoring poll reads settings twice

[BUG-27](../../tasks/BUG-27.md) — canonical task and status.

### BUG-20 — Monitoring give-up leaves a permanently stale active toolbar

[BUG-20](../../tasks/BUG-20.md) — canonical task and status.

### BUG-19 — Rapid zero snapshots can clear an active toolbar prematurely

[BUG-19](../../tasks/BUG-19.md) — canonical task and status.

### BUG-18 — Rejected action writes are cached as successfully painted

[BUG-18](../../tasks/BUG-18.md) — canonical task and status.

### BUG-21 — Concurrent monitoring requests can recreate and postpone the alarm

[BUG-21](../../tasks/BUG-21.md) — canonical task and status.

### BUG-17 — Context-menu actions are unclear and appear in irrelevant places

[BUG-17](../../tasks/BUG-17.md) — canonical task and status.

### BUG-15 — Captured torrent status is slow to become visible

[BUG-15](../../tasks/BUG-15.md) — canonical task and status.

### BUG-16 — Interception error badge has no defined lifetime

[BUG-16](../../tasks/BUG-16.md) — canonical task and status.

### BUG-14 — Context-menu sends omit working and failure toolbar states

[BUG-14](../../tasks/BUG-14.md) — canonical task and status.

### BUG-13 — Toolbar repaint failure aborts the NAS hand-off

[BUG-13](../../tasks/BUG-13.md) — canonical task and status.

### BUG-12 — Parallel toolbar transitions lose the newer failure state

[BUG-12](../../tasks/BUG-12.md) — canonical task and status.

### BUG-11 — Toolbar icon updates only after a later poll or popup click

[BUG-11](../../tasks/BUG-11.md) — canonical task and status.

### BUG-2 — Browser download cancelled before the NAS hand-off succeeds

[BUG-2](../../tasks/BUG-2.md) — canonical task and status.

### BUG-3 — Locked / empty-credential state unguarded in background

[BUG-3](../../tasks/BUG-3.md) — canonical task and status.

### BUG-4 — Hand-off failure swallowed by `sendAndNotify`

[BUG-4](../../tasks/BUG-4.md) — canonical task and status.

### BUG-1 — Interception default flipped to `off` and persisted on read

[BUG-1](../../tasks/BUG-1.md) — canonical task and status.

### BUG-7 — No test coverage for `handleDownloadCreated`

[BUG-7](../../tasks/BUG-7.md) — canonical task and status.

### BUG-5 — `.torrent` detection gaps

[BUG-5](../../tasks/BUG-5.md) — canonical task and status.

### BUG-6 — Documentation drift

[BUG-6](../../tasks/BUG-6.md) — canonical task and status.

### BUG-8 — No settings schema version or migration path

[BUG-8](../../tasks/BUG-8.md) — canonical task and status.

### BUG-9 — Service worker death between pause and cancel/resume

[BUG-9](../../tasks/BUG-9.md) — canonical task and status.

### BUG-10 — Right-click send hands login-protected links to the NAS as bare URLs

[BUG-10](../../tasks/BUG-10.md) — canonical task and status.

## Measured behaviour worth remembering

E2E (`tests/e2e/download-interception.spec.ts`) established something the design assumed
otherwise: **a small `.torrent` from a fast host reaches `complete` before the cancel can take
effect**, so Chrome keeps a local copy even on a fully successful hand-off. The pause/cancel
transaction therefore protects against *loss*, not against a stray file. The spec asserts the
contract that actually holds — the download is never left in progress — rather than a
`interrupted` state that only occurs when the transfer is slow enough. The torrent host in the
test delays its body specifically so the transaction under test can happen at all.

---

### BUG-63 — Shift-click E2E captures its baseline before the first download reaches disk

[BUG-63](../../tasks/BUG-63.md) — canonical task and status.

### BUG-64 — `--color-text-muted` is referenced but never defined

[BUG-64](../../tasks/BUG-64.md) — canonical task and status.

### BUG-65 — A light-theme text input has no visible boundary (WCAG 1.4.11)

[BUG-65](../../tasks/BUG-65.md) — canonical task and status.

### BUG-66 — `npm run stand` cannot run — `tsx` is not a dependency

[BUG-66](../../tasks/BUG-66.md) — canonical task and status.

### BUG-67 — The real-NAS E2E spec targets a settings form that no longer exists

[BUG-67](../../tasks/BUG-67.md) — canonical task and status.

### BUG-68 — The test stand is a hand-rolled `node:http` switch; it should be a small Hono server

[BUG-68](../../tasks/BUG-68.md) — canonical task and status.

### BUG-69 — No release gate touches the real NAS

[BUG-69](../../tasks/BUG-69.md) — canonical task and status.
