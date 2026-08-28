# Running the extension locally

How to load a development build in Chrome and watch what it does. Written for verifying a fix
against a real site before anything is packaged or published.

## Why there is a separate dev build

`manifest.json` carries a `key`, which pins the extension ID to the one the Chrome Web Store
issued. An unpacked copy built from it claims that same ID, so Chrome refuses to load it while
the published extension is installed — and if it does load, there is no way to tell which of
the two handled a download.

`npm run build:dev` produces a build without the key, in `dist-dev/`, named
**QuickGet Remote for QNAP (dev)**. Chrome derives an ID from the directory instead, so it
installs alongside the released version and both stay distinguishable in the extensions list,
the toolbar, and the context menu.

Use `dist/` (via `npm run build`) only when you specifically need to test the exact artifact
that ships.

## Install

```bash
npm install
npm run build:dev
```

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → select the `dist-dev/` directory.

Both copies can now run at once. To avoid two extensions competing for the same download,
disable the store version with its toggle while testing — leave it installed, just off.

## Iterating

```bash
npm run dev:watch
```

Rebuilds `dist-dev/` on every save. Chrome does **not** pick changes up on its own: press the
reload arrow on the extension's card in `chrome://extensions` after each rebuild. A reload
restarts the service worker and clears `chrome.storage.session`, so anything held there
(the unlocked master password, download claim markers) is gone — expect to unlock again.

Settings live in `chrome.storage.local` and survive reloads. The dev copy has its own storage,
separate from the store version, so it starts unconfigured.

## Watching what it does

The background logic runs in the service worker, which has its own console:

`chrome://extensions` → the extension's card → **service worker** (blue link) → **Console**.

The interception path narrates every decision, so a download that is ignored says why:

| Log line | Meaning |
| --- | --- |
| `intercepting torrent download` | recognised, hand-off started |
| `skipped: interception is off in Settings` | `torrentInterceptMode` is `off` |
| `skipped: not recognised as a torrent` | prints the url, mime and filename it judged |
| `skipped: already claimed by another listener` | `onCreated` and `onChanged` both saw it; one wins |
| `context menu send` | right-click path, with the resolved folder |
| `Failed to send torrent: …` | the hand-off failed; the message is the reason |

**No output at all** means the event never reached the extension — a different problem from any
of the above. Check that the extension is enabled and that you reloaded it after the last build.

The service worker is suspended after roughly 30 seconds of inactivity and the console goes
with it; the link reappears when the next event wakes it. Losing the console is not a crash.

## Checks before committing

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e:mock   # needs: npx playwright install --with-deps chromium
```

The mock E2E suite drives a real Chrome with the extension loaded against a fake NAS, which is
the layer that catches service-worker lifecycle problems unit tests cannot see.

`npm run test:e2e:tracker` additionally exercises a live tracker, configured per-machine via
`TRACKER_E2E_TOPIC` in `.env.e2e.local`. An open tracker needs nothing else; one requiring an
account needs a one-time `npm run tracker:login`. It is opt-in and never gates CI. See the
header of `tests/e2e/private-tracker.real.spec.ts`.

`hotlink-guard.spec.ts` covers the same mechanism deterministically and does run in CI: a local
server refuses hotlinked downloads by inspecting the headers Chrome really attaches, so it fails
if the fetch is issued anywhere but a page on the site.

## Known limitation

The torrent is fetched from a tab already open on the site, because only there do referrer,
origin and cookies match what a click produces. If the site is not open in any tab, the request
falls back to the service worker — which a tracker with a hotlink guard will refuse. In normal
use the topic page is open, which is where the link was clicked.
