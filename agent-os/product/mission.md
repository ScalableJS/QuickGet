# Mission

## Problem

QNAP Download Station's own web UI is a heavy, slow page that has to be opened, logged into,
and navigated every time you want to hand it a link. The common case — "send this to the NAS
and get on with browsing" — costs a tab switch, a login, and several clicks. Existing browser
extensions for QNAP are either abandoned, stuck on Manifest V2, or built around a NAS API
contract they get subtly wrong.

## Users

People running a QNAP NAS with Download Station 5 at home, who browse on Chromium or Firefox
and want the NAS to do the downloading. Single-user, single-NAS, self-hosted: there is no
account system, no server, and no multi-tenant story.

## What it does

A browser popup that talks directly to one user-configured NAS:

- Send links, magnet URIs, and `.torrent` files to Download Station in one action —
  from the popup or the page context menu.
- Intercept `.torrent` downloads started in the browser and route them to the NAS instead
  (browser behavior and verification limits are documented in `docs/system/development-release.md`).
- Monitor tasks live — progress, speed, seeding volume and share ratio — and start, pause,
  stop or remove them.
- Route downloads to destination folders by rule, with folder paths validated against the
  NAS before they are saved.

## Principles

- **No telemetry or hosted service.** NAS credentials go to the configured NAS. User-selected
  torrent descriptors may be fetched from their source tracker in browser/page context before
  upload; ordinary file bytes are fetched by the NAS itself. No analytics or advertising.
  Broad host permissions accommodate user-configured NAS hosts and user-selected source pages.
- **State the storage boundary honestly.** The NAS password persists in browser-local extension
  storage and is mirrored in session storage; QuickGet does not encrypt it. The optional settings
  password locks the settings UI only. See `docs/system/settings.md` for the exact boundary.
- **Never destroy the user's download.** Any hand-off to the NAS must be recoverable if it
  fails. Cancelling a browser download before the NAS has accepted it is a defect, not a
  trade-off — see `agent-os/product/bugs-kanban.md`.
- **Ideas are borrowed, code is not.** Competitor extensions were studied for feature ideas
  (see `docs/competitor-analysis.md`); everything is reimplemented on this stack.

## Non-goals

- Managing more than one NAS, or NAS models other than QNAP Download Station 5.
- Any hosted backend, sync service, or user account.
- Being a general download manager. Ordinary HTTP(S) file links have a scoped, off-by-default
  NAS send option; arbitrary authenticated downloads, offline queuing, and multi-NAS management
  are not implemented. See `docs/system/page-capture.md`.
