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
npx playwright install chromium
npm run test:e2e:mock
```

This is the **safe, mock-only** run. It never touches a real NAS.

## Which build each suite loads

| Suite | Build | Why |
|---|---|---|
| Mock (`test:e2e:mock`) | `dist-dev` | The artifact developers run unpacked, checked against a mock written to answer these questions |
| Spot check (`test:prod-spotcheck`) | `dist` | The bytes validated against a live Download Station must be the bytes the Web Store receives |
| Store assets, demo | `dist` | They photograph the shipping build; the dev manifest renames the extension |

Each script builds its own artifact first (`pretest:e2e:*`), so a suite can never pass against a
stale bundle — a failure mode that has cost real debugging time here, because a stale build looks
exactly like a broken feature.

## The production spot check (real NAS)

```bash
npm run test:prod-spotcheck
```

The gate run before promoting `env/dev` to `env/prod`. Everything else in this repository asks
questions of a mock we wrote, which is the one thing a pre-production check must not do, so this
suite runs **only what a mock cannot answer**:

| # | Scenario | What only reality can settle |
|---|---|---|
| 0 | Preflight | The NAS answers, orphaned tasks from earlier runs are cleared, and there is task headroom |
| 1 | Connection check | `Misc/Login` through the extension's own client, against real firmware |
| 2 | `AddTorrent` | A real multipart upload parsed by the appliance, and the name taken from `info.name` |
| 3 | `AddUrl` with a magnet | A different appliance contract, not another route to the same one |
| 4 | Direct link lifecycle | The NAS fetches from this machine, reports partial progress, pauses, resumes and removes |

It takes about fifteen seconds. That is deliberate: a gate that takes fifteen *minutes* stops being
run, which is exactly how the suite it replaces came to sit broken for two months.

**Interception, badge arithmetic, form validation and rendering are not here.** Rebuilding the 45
mock tests against somebody's hardware would produce a slow second suite that rots the same way.

### Safety on a live machine

Everything the run creates is named `qgr-spotcheck-<date>-<random>`, and removal happens three
ways, deliberately overlapping:

1. A **ledger** (`.e2e-artifacts/spotcheck-ledger.json`) records each name *before* the task is
   created, so a crash between creation and the next assertion still leaves a trace.
2. `afterAll` removes what the ledger holds, and **a failed cleanup fails the gate** — a run that
   leaves tasks behind has not passed, whatever its assertions said.
3. Preflight sweeps any task whose name carries the prefix and which no ledger entry claims. This
   is the net under the other two: the three orphans that appeared while this suite was being
   written all died in the window a ledger alone cannot cover.

Nothing without that prefix is ever touched.

### It cannot run in CI

GitHub runners have no route to the NAS, and the credentials live in `.env.e2e.local` — outside
git and outside Actions by design. Moving this into CI would mean putting NAS credentials in
repository secrets and exposing Download Station to the internet.

Scenario 4 additionally needs the NAS to reach *this* machine: the stand binds every interface and
advertises a LAN address, because Download Station performs the fetch itself and a loopback URL
makes it answer `12288`.

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

The spot check writes `.e2e-artifacts/spotcheck-ledger.json`, which is operational state rather
than a diagnostic: it is what lets a later run clean up after one that died. An empty `runs` array
means nothing is outstanding.

Its failures are written to be read without a trace viewer. Each wait names the contract it was
waiting on, how long it waited, and what the NAS was reporting meanwhile — because
`Test timeout of 60000ms exceeded` is precisely the message that let the previous real-NAS suite
rot unnoticed.


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
