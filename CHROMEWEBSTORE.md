# Chrome Web Store submission

## Identity

- **Listing name:** QuickGet Remote for QNAP
- **Short description:** Send links and torrents to QNAP Download Station from Chrome.
- **Category:** Productivity
- **Language:** English
- **Support URL:** https://github.com/ScalableJS/QuickGet/issues
- **Privacy policy:** https://github.com/ScalableJS/QuickGet/blob/master/docs/privacy-policy.md
- **License:** MIT

QuickGet Remote for QNAP is an independent companion for QNAP Download Station. It is not affiliated with, endorsed by, or sponsored by QNAP Systems, Inc.

## Full description

Control your QNAP Download Station without leaving Chrome.

QuickGet Remote for QNAP connects directly to the NAS you configure and gives you a focused view of its download tasks. Send a link, magnet URI, or `.torrent` file to Download Station; monitor active transfers; pause, resume, or remove tasks; and choose destination folders for new downloads.

### Features

- Add HTTP/HTTPS links, magnet URIs, and `.torrent` files to QNAP Download Station.
- Use the context menu to send a page link directly to the NAS.
- View active, completed, and seeding tasks with live speed and progress information.
- Start, pause, stop, and remove Download Station tasks.
- Configure a default destination folder and routing rules for matching downloads.
- Send `.torrent` downloads to the NAS automatically; this behavior is enabled by default and can be turned off in Settings.
- Keep credentials and settings in the local browser profile; no analytics, advertising, or third-party service is used.

### Requirements

- A QNAP NAS with Download Station 5 enabled and reachable from this browser.
- Chrome 120 or newer.

The extension communicates only with the NAS address you enter. It is an independent application and is not affiliated with QNAP Systems, Inc.

Support: quickget.remote@gmail.com

## Privacy practices

### Single purpose

Provide a browser companion for a user-owned QNAP NAS running Download Station: submit downloads and torrents, and display or manage the user's Download Station tasks.

### Data use declaration

The extension handles personally identifiable information (the NAS username and password), website content (submitted URLs, magnet links, and `.torrent` files), and authentication information. This data is used only to connect to the NAS address configured by the user and operate Download Station. It is not sold, shared with third parties, used for advertising, or used for creditworthiness or lending decisions.

### Permission justifications

| Permission | Justification |
| --- | --- |
| `contextMenus` | Adds explicit right-click actions that send a selected link or page URL to the user's configured Download Station. |
| `storage` | Stores the NAS address, user settings, routing rules, and (only when the user opts in) local password storage in the browser profile. |
| `alarms` | Periodically refreshes active Download Station tasks while monitoring is enabled, without relying on a persistent MV3 service worker. |
| `notifications` | Shows the user a notification when an intercepted torrent needs action or a background send operation fails. |
| `downloads` | Detects `.torrent` downloads only when the user enables the optional torrent-interception feature; it can then offer or send that torrent to the configured NAS. |
| `http://*/`, `https://*/` | The extension must connect directly to a NAS hostname or IP address chosen by each user. The host is not known at install time and may use HTTP or HTTPS. |

### Remote code

No remote code is used. JavaScript, CSS, icons, and all other executable resources are packaged with the extension.

## Upload assets

Generate and review the current assets with:

```bash
npm run capture:store-assets
```

Use the generated files in `store-assets/`:

- `screenshots/downloads-1280x800.png`
- `screenshots/settings-1280x800.png`
- `promo/small-440x280.png`
- `promo/marquee-1400x560.png`
- `demo/promo-1920x1080.mp4` — upload to YouTube, then paste the watch URL into both the
  localized and the global promo-video fields (CWS wants the full `watch?v=` form, not `youtu.be`)
- `demo/promo.en.srt` — the video's subtitles; YouTube ignores the track muxed into the mp4, so
  add this file to the upload by hand

The screenshots use the mock NAS from the E2E suite and contain no real credentials or user data.
