# QNAP Download Station Contract

QNAP DS V4 API has an undocumented-feeling requirement this codebase must honor.

- `AddUrl` and `AddTorrent` both require **both** `temp` and `move` parameters — omitting either breaks the request. See `src/api/client.ts`.
- Parse untyped QNAP API responses only at the DTO boundary; don't let raw response shapes leak past `src/api/client.ts`.
# Task states

Download Station 5.10.2 defines the authoritative numeric display mapping in the installed
`opt/www/libs/ds-all.js` as `DS.TASK_STATUS`; its English labels come from `opt/www/lang/ENG.js`:

| State | Download Station label |
|---:|---|
| 0 | Waiting |
| 1 | Paused |
| 2 | Stopped |
| 3 | Moving |
| 4 | Failed |
| 5 | Finished |
| 100 | Seeding |
| 101 | Queued for checking |
| 102 | Checking files |
| 103 | Downloading metadata |
| 104 | Downloading |
| 105 | Allocating |

Map these codes directly. Do not reinterpret them from progress, rates, peers, or activity time;
those fields describe telemetry and can legitimately be zero during the named state.
