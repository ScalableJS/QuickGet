---
type: "task"
id: "DEMO-3"
status: "done"
priority: "p2"
area: "video"
board: "demo-video"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Build the `Open Downloads` demo source page

**Size:** S · **Area:** video
**Files:** `tests/e2e/fixtures/demo-page/`, `tests/e2e/support/demoPageHost.ts`

**Built on Simple.css, vendored — no wheel reinvented.** Surveyed the classless-CSS family
(styles semantic HTML with no classes, one file, no build step), which is exactly this job:

| | Size | License | Auto dark |
|---|---|---|---|
| **Simple.css** ✅ | 9.4 KB | MIT | yes |
| water.css | 22.7 KB | MIT | yes |
| Pico | 71 KB | MIT | yes |
| sakura | 4.1 KB | MIT | no |

Simple.css wins on reading-tuned typography at a small size. **Vendored into the fixture, not
linked from a CDN** — the run must be deterministic and work offline. MIT, so committing it is
fine; keep the file byte-for-byte as fetched.

**Two things the rendered page revealed that the markup did not:**

- Simple.css lays `body` out as a **two-column grid** on wide viewports, which parked the title
  in a tinted sidebar and pinned everything left — half of a 1920px frame empty. Collapsed to a
  single centred column (`display: block !important`; the framework sets the columns inside a
  min-width media query, so plain overrides lose).
- The recording machine runs macOS **dark**, and Simple.css follows `prefers-color-scheme`. The
  palette is now pinned to light in the page's own `<style>`, so the frame looks identical
  wherever it is shot. Verified by rendering with `colorScheme: "dark"` — background stayed white.

**Verified on a 1920×1080 render:** 0 images, 0 scripts, 0 external requests; root font 19px;
card 883px wide and centred; the click target is `#download-torrent`, 245×65 px, a plain `<a>`.

**The torrent is real.** `debian-13.6.0-amd64-netinst.iso.torrent` (60,868 bytes) fetched from
the official `cdimage.debian.org` mirror. Parsed to confirm it is what the card claims:
`name = debian-13.6.0-amd64-netinst.iso`, `comment = Debian CD from cdimage.debian.org`,
length 791,674,880 bytes. The card's version text matches the file — keep them in step if it is
ever refreshed.

**`startTorrentHost()` could not serve this** — it answers *every* path with one attachment, so a
page the demo must navigate to first is impossible. Added `startDemoPageHost()` instead: page and
stylesheet render normally, the `.torrent` goes out as `content-disposition: attachment`, and it
keeps the same headers-first/body-after-a-beat trick so a 60 KB localhost file cannot complete
before the extension acts.

**Verified end to end (2026-08-31), not just by reading the code:** Chromium at 1920×1080 with the
OS in dark mode → page title `Open Downloads`, body background white (the light pin holds),
clicking `#download-torrent` fires a genuine Chrome `download` event with
`suggestedFilename = debian-13.6.0-amd64-netinst.iso.torrent`, and the host counts exactly one
torrent fetch. That download event is precisely what makes `chrome.downloads.onCreated` fire, so
the interception the demo films is real. `tsc --noEmit` clean.

**Decided 2026-08-31.** Neither a real third-party site nor a look-alike: an **own, honestly
neutral catalogue page** served by `startTorrentHost()`, linking a genuine official `.torrent`.
Reproducible, and the torrent is real — `content-disposition: attachment` fires
`chrome.downloads.onCreated` for real.

Rejected: filming ubuntu.com. Not forbidden in itself, but the CWS impersonation policy bars
implying endorsement, and Ubuntu plus its logo are Canonical trademarks. The asymmetry that
settles it: an incidentally visible third-party site is low risk, while **copying someone's logo
onto our own page is a trademark risk we have no reason to take**. Practically it also drags in
cookie banners, redesigns, geolocation and CDN latency.

**Page spec — reads as a small real catalogue, not a stub and not a clone:**

- Title `Open Downloads`, subtitle "Freely distributable downloads for testing BitTorrent clients."
- Cards, `max-width` 900–1000px, real typography, **our own favicon**, generic download icons.
- Project names **as text only — no Ubuntu/Debian/Blender logos.**
- Footer, small: "Project names and trademarks belong to their respective owners. No affiliation
  or endorsement is implied."
- Forbidden names: `Ubuntu Downloads`, `Official Linux Torrents`, `Ubuntu Mirror`, or anything
  resembling ubuntu.com / debian.org.

**Content — one Debian card for the 28-second take.** One card keeps the narrative clean for a
CWS reviewer: legal Linux download → NAS.

| Source | License to print | Note |
|---|---|---|
| Debian official installer | `Free/Open Source · multiple licenses` | **Not** "GPL" — the ISO is an aggregate of GPL/LGPL/BSD/MIT under DFSG |
| Tears of Steel / Big Buck Bunny / Sintel | `CC BY 3.0` | Blender open movies, safe spares |
| Internet Archive | per-item only | **Not safe wholesale** — IA licenses each item separately and does not warrant copyright status. Only a specific verified CC0/CC-BY item |

Never a private tracker or copyrighted content: CWS bars extensions facilitating unauthorised
downloads of copyrighted media, and the promo is evidence of intended use.

**Open sub-question:** link the live debian.org `.torrent` (zero redistribution questions, but a
network dependency mid-take) or vendor the verified `.torrent` next to the page (fully offline).
Recommendation: vendor it for the repeatable run, since DEMO-3 exists for reproducibility.
