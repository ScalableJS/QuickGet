---
type: task
id: ENG-25
status: done
priority: p2
area: verification/feedback
board: engineering
updated: 2026-10-10
audit_order: 13
---

# Bound transient-feedback E2E assertions by the declared timer

CI run 38068161110 failed only the poll/direct-feedback browser case. Its trace records the first upload confirmation assertion at 25505.896 ms and the next at 28405.759 ms: a 2.9-second gap exceeds the ordinary success message's documented 2.5-second lifetime. The subsequent poll error is allowed after expiry. Changing product lifetime would reintroduce sticky confirmations rather than correct this fixture.

Terra owns deterministic clock/request ordering in the named E2E. Preserve real upload, failed polling, visible direct-message priority and normal expiry assertions; do not add timeout inflation, retries, skips or weaker acceptance. Codex owns source review, report refresh and pushed-revision CI acceptance. [The final audit](../docs/quality/code-quality-audit.md#final-integrated-acceptance) records current product evidence.

## Accepted fixture correction: 2026-10-10

Terra installs the page clock before fresh popup initialization and advances it explicitly. The real rejected polls cannot replace still-visible direct settings/upload confirmation. At 2500 ms the ordinary upload success expires, and a later poll can show its failure. No product timeout, retry, skip or weaker assertion was introduced.

The named case passes ten repetitions with four workers; the full feedback spec passes 13 scenarios. Codex temporarily removed the direct-over-poll owner guard and the corrected browser case failed, then restored the source and observed a pass. This proves the controlled fixture still detects the protection regression. Fresh full integration and pushed-revision CI accompany the patch; product and real-NAS-tested bundle behavior are unchanged.
