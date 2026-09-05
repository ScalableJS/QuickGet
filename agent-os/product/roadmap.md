# Roadmap

High-level phases. The detailed, competitor-informed breakdown with per-item acceptance
criteria lives in `docs/feature-roadmap.md` — this file is the summary an agent reads first.
Open defects are tracked separately in `bugs-kanban.md`.

## Phase 0 — Shipped

- Svelte 5 / TS / MV3 rewrite of the legacy extension; Vite + Biome + Vitest + Playwright.
- Core task management: add URL / magnet / `.torrent`, list, start, pause, stop, remove,
  seeding view with share ratio.
- Context-menu send, toolbar badge and status-driven icon, alarm-based polling with idle
  hysteresis.
- Session hardening: single-flight login, re-login-and-replay on expiry, badge preserved
  across transient poll errors (F2).
- Folder path validation against `Misc/Dir` with inline valid/invalid state (F1).
- Folder routing rules — matcher, editor UI, wired into every send path (F3).
- Settings backup / restore, master-password encryption of the NAS credential.
- MIT license, Chrome Web Store listing and automated publish workflow (F5).
- v1.0.2 published; Firefox packaging via `web-ext`.
- Download interception stabilized and made transactional; strict no-local-file mode.
- Magnet link auto-capture (`autoCaptureMagnets`) shipped in v2.2.0 with synchronous capture cancellation and in-page toast feedback.
- Seeding quota progress and dedicated emerald theme shipped in v2.2.0.

## Phase 1 — Rich Status & Diagnostics (Quick Wins)

High-value, zero-clutter enhancements to task clarity based on live QNAP API capabilities:

- **Downloaded payload size (`done / size`):** Display actual downloaded volume (e.g. `17.8 / 24.3 GB`) rather than an opaque percentage (BUG-36).
- **Human-readable error taxonomy:** Translate QNAP integer failure codes (e.g. 20488 disk full, 4096 folder missing, 8196 duplicate) into friendly, actionable explanations (BUG-37).
- **Conditional swarm health (`seeds / peers`):** Render `S 12 · P 4` compactly for active BitTorrent tasks, clarifying stalled downloads (BUG-35).
- **Global NAS transfer rates in header:** Real-time combined `↓ 24.8 MB/s  ↑ 3.1 MB/s` in the popup header via `Task/Status` (GAP-7).

## Phase 2 — High Value Task Controls

Contextual task actions exposed through clean interactions without bloating the primary card:

- **Safe task removal dialog:** Single trash action opening a confirmation modal with an optional `☐ Also delete downloaded files from NAS` checkbox (`clean: 1 | 0`) (GAP-8).
- **Quick speed limit throttle:** Speedometer icon in header opening a discrete preset popover (`Unlimited`, `1 MB/s`, `2 MB/s`, `5 MB/s`, `Custom`) using `Config/Set` (GAP-9).
- **Task queue priority management:** Reorder downloads (`Move to top`, `Up`, `Down`) via the card's `⋮` overflow menu (`Task/Priority`) (GAP-10).
- **Export `.torrent` file:** Download original `.torrent` bencoded metadata back from the NAS to the local browser via `⋮` menu (GAP-11).

## Phase 3 — Advanced Settings & Diagnostics

Enthusiast configurations housed strictly within `Settings → Advanced`:

- **Client emulation for private trackers:** Switch `bt.peer_mode` between Transmission 2.94, Deluge, and uTorrent to bypass tracker client blacklists (GAP-12).
- **Default seeding limits:** Configure default share ratio and time limits for Download Station via `Config/Set` (GAP-13).
- **Task destination folder visibility:** Contextual display of target NAS path (BUG-38).
- **Background polling optimization:** Migrate badge monitoring from `Task/Query` to lightweight `Task/Status` (BUG-39).

## Deliberately Out of Scope

- **In-popup torrent search (`Addon/Search`):** Discovery plugins break frequently, clutter the popup, and present store policy risks.
- **RSS automation & rule management (`Rss/*`):** Best managed in the native QTS desktop console.
- **Filehost premium accounts (`Account/*`):** Third-party credentials management is outside core extension goals.
- **24x7 Schedule matrix (`schedule0..6`):** 168-hour calendar grid is unworkable in a 380px extension popup.
- **Drag-and-Drop queue sorting:** QNAP API only supports relative shifts; simulated drag-and-drop triggers API flooding and race conditions.
