# QNAP Download Station Contract

QNAP DS V4 API has an undocumented-feeling requirement this codebase must honor.

- `AddUrl` and `AddTorrent` both require **both** `temp` and `move` parameters — omitting either breaks the request. See `src/api/client.ts`.
- Parse untyped QNAP API responses only at the DTO boundary; don't let raw response shapes leak past `src/api/client.ts`.
