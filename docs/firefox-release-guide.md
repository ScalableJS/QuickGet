# Firefox release guide

## Current release setup

- Chromium build: `npm run build` → `dist/`
- Firefox build: `npm run build:firefox` → `dist-firefox/`
- Firefox upload package: `npm run package:firefox` → `web-ext-artifacts/quickget-remote-<version>-firefox.zip`
- Firefox manifest: `manifest.firefox.json`
- Minimum Firefox version: 142

The Firefox manifest uses `background.scripts`, because Firefox Manifest V3 uses an event-page background context. The Chromium manifest continues to use `background.service_worker`.

## Required checks

Run before submitting a release:

```bash
npm run lint
npm run typecheck
npm run check:svelte
npm run test
npm run build
npm run test:e2e:mock
npm run package:firefox
npm run lint:firefox
```

GitHub Actions runs these checks on every push and pull request. It uploads the Firefox ZIP as a CI artifact.

`web-ext lint` currently reports one warning about `innerHTML` in the compiled Svelte runtime bundle. The application source does not use dynamic HTML insertion. Include the source package and mention this to an AMO reviewer.

## AMO submission checklist

1. Push the release commit so the privacy policy has a public URL.
2. Open the [AMO Developer Hub](https://addons.mozilla.org/developers/addons) and choose **Submit a New Add-on**.
3. Choose **On this site** for a public AMO listing, then upload the ZIP from `web-ext-artifacts/`.
4. Submit source code when asked. The production bundle is minified; provide a source archive from the same commit, including `package-lock.json` and build instructions.
5. Complete the listing: summary, full description, category, icon, screenshots, support URL, license, and privacy-policy URL.
6. Mark the add-on as requiring additional hardware or software: it needs a QNAP NAS with Download Station.
7. Provide reviewer notes using the template below.
8. Download and install the AMO-signed artifact for a final Firefox smoke test.

## Privacy and permissions

The extension sends data only to the NAS address configured by the user. It does not use analytics, advertising, or third-party services.

Firefox data-collection disclosure declares these required data types:

- `authenticationInfo` — NAS username and password
- `browsingActivity` — URLs and magnet links sent to the NAS
- `websiteContent` — selected `.torrent` file contents
- `websiteActivity` — user-initiated download and send actions

The privacy policy is in [privacy-policy.md](./privacy-policy.md). Do not declare `none`: data is transmitted to the user-configured NAS, which is outside the browser.

## Reviewer notes template

> QuickGet Remote is a browser client for a user-owned QNAP NAS running Download Station. It sends credentials, magnet links, URLs, and selected `.torrent` files only to the NAS address configured by the user. It does not use analytics, advertising, telemetry, or third-party services. Broad HTTP/HTTPS host permissions are required because each user provides their own NAS hostname or IP address. Torrent interception is experimental and Chromium-only. The Svelte production runtime contains a static `innerHTML` template helper; application source does not insert untrusted HTML. Source code and reproducible build instructions are provided with this submission.

## References

- [Firefox background manifest compatibility](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- [Firefox built-in data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
- [Submitting an add-on to AMO](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
