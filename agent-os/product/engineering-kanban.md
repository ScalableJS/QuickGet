# Engineering improvements — Kanban

Verified maintenance work that does not represent a user-visible product gap or an open defect.
Source review on 2026-09-15 combined findings from Kimi, Qwen, GLM and ChatGPT with checks against
the live repository. Suspicions without repository evidence are not promoted to implementation
tasks.

Task files are canonical; this document keeps board context, historical notes, and stable card links.

---

## Board

Open [the task board](../../views/tasks.base) and filter `board` by `engineering`.
The frontmatter of [task files](../../tasks/README.md) owns status.

## Cards

### ENG-1 — Restore the documented Svelte gate and bound the deploy job

[ENG-1](../../tasks/ENG-1.md) — canonical task and status.

### ENG-2 — Remove the dead standalone unlock mount

[ENG-2](../../tasks/ENG-2.md) — canonical task and status.

### ENG-3 — Remove unsupported Synology task normalization

[ENG-3](../../tasks/ENG-3.md) — canonical task and status.

### ENG-4 — Stop rebuilding the same Chrome and Firefox artifacts in one workflow run

[ENG-4](../../tasks/ENG-4.md) — canonical task and status.

### ENG-5 — Replace the stale API README with a short canonical map

[ENG-5](../../tasks/ENG-5.md) — canonical task and status.

### ENG-6 — Apply the verified low-risk local cleanup batch

[ENG-6](../../tasks/ENG-6.md) — canonical task and status.

### ENG-7 — Establish a report-only dead-code baseline with Knip

[ENG-7](../../tasks/ENG-7.md) — canonical task and status.

### ENG-8 — Make the private-tracker login helper parse env files and navigation failures honestly

[ENG-8](../../tasks/ENG-8.md) — canonical task and status.

### ENG-9 — Remove redundant direct development dependencies

[ENG-9](../../tasks/ENG-9.md) — canonical task and status.

### ENG-10 — Remove Knip-confirmed dead UI and test-support code

[ENG-10](../../tasks/ENG-10.md) — canonical task and status.

### ENG-11 — Audit browser-event ownership and remove only proven duplicate listeners

[ENG-11](../../tasks/ENG-11.md) — canonical task and status.

## Reviewed but not promoted

- `--text-primary` and `--text-secondary` are defined aliases in both themes; the reported missing
  unlock tokens are a false positive.
- `src/api/type.ts` is imported by the API client, mock NAS and contract tests. Removing it is not
  a dead-code deletion; renaming its schema alias saves no meaningful complexity.
- The two `getErrorMessage` functions are not duplicates: `src/api/utils.ts` extracts QNAP response
  fields, while `src/lib/errors.ts` normalizes thrown values.
- The background and popup client caches have different ownership and popup draft-settings
  behavior. A shared cache factory would add a layer without proving fewer branches.
- `classifyFailure` and `classifyConnectionFailure` intentionally distinguish tracker hand-off
  failures from NAS preflight failures; merging them risks losing that domain distinction.
- The explicit redaction patterns are security-sensitive test code. Generating regular
  expressions from strings is not automatically clearer or safer.
- Splitting `attentionMessage.ts` and `monitorMessage.ts` keeps unrelated runtime protocols local;
  merging them would move the same code without reducing it.
- Rewriting the imperative status pill or the cross-module downloads state into Svelte may be a
  valid feature refactor, but neither review demonstrated a smaller or safer implementation.
- The icon generator's per-file catch logs the `Error` object (including its stack) and adds the
  failing size; removing it does not clearly improve diagnostics.
- The `injectSid()` `/Task/Add` fallback and logger feature set need behavioral/history evidence
  before deletion. They can be revisited from ENG-7 rather than changed from snapshot inference.
