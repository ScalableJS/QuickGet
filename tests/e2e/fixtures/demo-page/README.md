# `Open Downloads` — demo source page

The website the user visits in the promo recording. Clicking its link is what triggers the
interception the video is about. Served by `tests/e2e/support/demoPageHost.ts`.

Full rationale lives in `agent-os/product/demo-video-kanban.md` (DEMO-3).

## Rules — breaking one makes the page unusable

- **No logos or brand images.** Project names as plain text only. Ubuntu, Debian and Blender
  names are trademarks; reproducing a logo is a risk taken for nothing.
- **Must not resemble a real site.** Not `Ubuntu Downloads`, not a debian.org look-alike. Passing
  a fixture off as a third-party site is worse than being honestly neutral.
- **Fully offline.** No CDN, no web fonts, no external images, no JavaScript. The stylesheet is
  vendored next to the page. The recording must not depend on the network.
- **Nothing invented.** No download counts, ratings or testimonials.
- **License text stays `Free/Open Source · multiple licenses`** — a Debian image aggregates GPL,
  LGPL, BSD, MIT and others, so writing "GPL" would be wrong.

## Files

| File | Notes |
|---|---|
| `index.html` | The page. Light palette is pinned in its own `<style>` — the recording machine runs dark mode and `simple.min.css` follows `prefers-color-scheme`. |
| `simple.min.css` | Simple.css v2.3.7, MIT, vendored verbatim. Do not edit — override in the page instead. |
| `debian-13.6.0-amd64-netinst.iso.torrent` | The real file from `cdimage.debian.org` (60,868 bytes; `name = debian-13.6.0-amd64-netinst.iso`, 791,674,880 bytes). |

The card's version text and the torrent filename must stay in step with each other and with
`TORRENT_FILENAME` in `demoPageHost.ts`. If the torrent is refreshed, update all three.

`#download-torrent` is the click target of both the demo and its assertions — keep the id.
