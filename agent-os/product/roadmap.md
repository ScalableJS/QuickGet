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

## Phase 1 — Stabilise download interception (current)

The interception feature is shipped but defective; see `bugs-kanban.md` and
`docs/download-interception-bugs.md`.

- Make the NAS hand-off transactional so a failed send never destroys the browser download.
- Guard the locked / empty-credential state in the background, not only in the popup.
- Restore the intended default and stop persisting behavioural defaults on read.
- Close the test gap: `chrome.downloads` mock, `src/background/downloads.test.ts`, and an
  E2E spec driving a real download through the mock NAS.

## Phase 2 — Follow-ups on shipped features

Carried over from `docs/feature-roadmap.md`, none of them blocking:

- Parent-listing cache for folder validation (`folderCache.ts`).
- E2E for the blocked-save red-ring path, and for a routing rule producing the correct `move`.
- Rule reorder in the editor; gate save on an invalid rule destination.

## Phase 3 — Deliberately deferred

Recorded so they are not re-proposed. Rationale in `docs/feature-roadmap.md`:

- **Magnet content-script capture** (opt-in) — the one real remaining feature gap; needs an
  `<all_urls>` content script, so it must be explicitly opt-in.
- **Undo on remove** — removal is an immediate NAS call; needs new UI infrastructure.
- **Completion notifications** — conflicts with the deliberate idle self-disarm design.
- **SID persistence in `storage.session`** — marginal benefit, consciously skipped.
- **Keepalive alarm** — rejected on battery and privacy grounds.
- **Intercepting anything beyond `.torrent`** — out of scope for the product.

## Phase 4 — Store presentation

Final polish before a wider release (F7): refreshed screenshots and store assets, aligned
README feature list, consistent short description across `manifest*.json` and both stores,
AMO listing licence and data-disclosure checklist.
