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
  (Chromium only, experimental).
- Monitor tasks live — progress, speed, seeding volume and share ratio — and start, pause,
  stop or remove them.
- Route downloads to destination folders by rule, with folder paths validated against the
  NAS before they are saved.

## Principles

- **The NAS is the only network peer.** Credentials, URLs and torrent files go to the address
  the user configured and nowhere else. No analytics, telemetry, advertising, or third-party
  services. Broad host permissions exist solely because every user's NAS has a different
  hostname.
- **Credentials never rest in plaintext.** The NAS password lives in `chrome.storage.session`,
  and at rest only as a blob encrypted with the user's master password.
- **Never destroy the user's download.** Any hand-off to the NAS must be recoverable if it
  fails. Cancelling a browser download before the NAS has accepted it is a defect, not a
  trade-off — see `agent-os/product/bugs-kanban.md`.
- **Ideas are borrowed, code is not.** Competitor extensions were studied for feature ideas
  (see `docs/competitor-analysis.md`); everything is reimplemented on this stack.

## Non-goals

- Managing more than one NAS, or NAS models other than QNAP Download Station 5.
- Any hosted backend, sync service, or user account.
- Being a general download manager — intercepting anything beyond `.torrent` is explicitly
  out of scope (`docs/feature-roadmap.md`).
