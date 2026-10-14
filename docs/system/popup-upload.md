---
type: architecture
status: active
area: popup
updated: 2026-10-10
features: ["popup-upload"]
---

# Popup torrent and URL upload

The popup has a local torrent file picker and a URL/magnet text panel. Local uploads require a `.torrent` filename, read the descriptor's release name for routing, and call `AddTorrent`. The picker is reset after the operation. Success and duplicate outcomes have visible status messages; failures stay visible as errors. A successful current upload invokes its list/UI follow-up and requests background monitoring. A superseded upload still preserves its NAS outcome and monitoring request, but cannot navigate/reset a newer popup context or replace its feedback.

The URL panel splits trimmed nonempty lines and limits a submission to 50. `ApiClient.addUrls()` submits each URL independently with `Promise.allSettled`, preserving per-line success/failure rather than failing the whole batch. The UI reports full or partial success and refreshes when anything was added. An explicit target folder applies to the batch; this path currently does not evaluate routing rules per URL.

Local descriptor upload and URL send are different payloads. A local torrent's browser file is uploaded to the NAS; an ordinary URL tells the NAS where to download. This feature does not provide an offline queue, browser-session transport for ordinary protected links, or a record of past submissions.

## Acceptance and follow-up failures

NAS acceptance, duplicate detection and partial batch outcomes are recorded before invoking a
follow-up callback. Synchronous or asynchronous callback rejection is classified as a follow-up
refresh issue while retaining the accepted outcome. The shared helper uses the existing renderer's
direct-status receipt: a later direct confirmation or invalid submission suppresses an older
result or callback failure. Polling does not invalidate that receipt. Actual NAS rejection retains
its error outcome. No offline queue or durable upload ledger is introduced.

## Sources and evidence

- [Upload initializer](../../src/popup/features/upload/index.ts), [torrentUpload.ts](../../src/popup/features/upload/torrentUpload.ts), [batchUpload.ts](../../src/popup/features/upload/batchUpload.ts), [CreateUrls.svelte](../../src/popup/features/upload/CreateUrls.svelte).
- [Accepted-feedback renderer tests](../../src/popup/features/upload/acceptedFeedback.test.ts) and [shared follow-up helper](../../src/popup/features/upload/uploadFeedback.ts) cover accepted, duplicate, partial and superseded results.
- Torrent/batch unit tests and [popup E2E](../../tests/e2e/popup.full-cycle.spec.ts).
- Success messages already exist in current code. [BUG-71](../../tasks/BUG-71.md) is accepted with the bounded feedback matrix; its original popup-success diagnosis is historical.
