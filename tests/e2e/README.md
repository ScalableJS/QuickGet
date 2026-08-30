# E2E tests

The full test map, run commands, and update runbook live in [`../README.md`](../README.md).

This suite exercises the full popup happy path in a real Chromium browser with the MV3
extension loaded:

1. open the popup
2. fill in settings
3. test connection
4. save to `chrome.storage.local`
5. load the task list
6. start / stop / pause
7. upload `.torrent`
8. remove task

## Running

```bash
npm run build
npx playwright install chromium
npm run test:e2e:mock
```

This is the **safe, mock-only** run. It never touches a real NAS.

## Real NAS smoke (read-only)

If a local `.env.e2e.local` exists, you can run just the safe smoke scenario:

```bash
npm run build
npm run test:e2e:real
```

It only checks:
- filling in and saving settings
- test connection
- loading the task list

It **never** adds, starts, pauses, or removes real tasks.

## Real NAS mutating flow

There is a separate opt-in scenario that creates only its own test task, prefixed
`quickget-e2e-`, then deletes it:

```bash
npm run build
npm run test:e2e:real:mutating
```

Before running this scenario, it's best to use:
- a dedicated test NAS account
- dedicated folders for `QNAP_E2E_TEMP_DIR` and `QNAP_E2E_DEST_DIR`
- a Download Station that is not carrying production load

## Why no real NAS credentials are needed here

The current e2e suite uses a local mock NAS and never touches your real QNAP.

## If you later want to test against a real NAS

Use only local environment variables, or a local `.env.e2e.local` (already covered by
`.gitignore`).

Recommended minimum:

```dotenv
QNAP_E2E_HOST=...
QNAP_E2E_PORT=...
QNAP_E2E_LOGIN=...
QNAP_E2E_PASSWORD=...
QNAP_E2E_TEMP_DIR=...
QNAP_E2E_DEST_DIR=...
```

Never commit:
- NAS address
- login/password
- SID
- raw, unredacted request/response dumps

## Diagnostics

On a test failure, Playwright saves a trace/screenshot/video, and the test additionally
attaches a local redacted HTTP log that masks:
- `sid`
- `pass`
- `password`

When the real NAS flow is enabled, the redacted HTTP log can also be saved locally to
`.e2e-artifacts/` for later use when updating mock responses.

Real NAS scenarios currently auto-save two artifacts:

- `.e2e-artifacts/real-nas-smoke.log`
- `.e2e-artifacts/real-nas-smoke.json`

and for the mutating flow:

- `.e2e-artifacts/real-nas-mutating.log`
- `.e2e-artifacts/real-nas-mutating.json`

`*.log` is easy to read by eye; `*.json` is easier to diff and use as a source for updating
mock fixtures.


## Private tracker (opt-in, live site)

`tests/e2e/private-tracker.real.spec.ts` verifies something the mock cannot: whether the
site's session actually reaches `fetch` inside the service worker. Chrome treats this request
as same-site as long as the extension holds a host permission on the target domain, so the
cookie should attach — the test proves that rather than assuming it. If the cookie did not go
along, the site would return a login page, and that HTML would end up on the NAS instead of
the torrent.

The session cannot be obtained by script: the anti-bot answers the Playwright browser with a
challenge page in both headless and headed mode. Bypassing it is deliberately out of scope.
So login is one-time and manual:

```bash
npm run tracker:login      # a window opens; log in and close it
npm run test:e2e:tracker
```

The target page is set locally in `.env.e2e.local` (`TRACKER_E2E_TOPIC`) and is never
committed to the repo. The profile is saved to `.e2e-artifacts/tracker-profile/` (gitignored)
along with cookies and the anti-bot clearance. When there is no profile, or the session has
expired, the test is skipped with a hint rather than failing.
