# Engineering improvements — Kanban

Verified maintenance work that does not represent a user-visible product gap or an open defect.
Source review on 2026-09-15 combined findings from Kimi, Qwen, GLM and ChatGPT with checks against
the live repository. Suspicions without repository evidence are not promoted to implementation
tasks.

**Columns:** `Backlog` → `In Progress` → `In Review` → `Done`.
**Priority:** `P1` protects correctness/release confidence, `P2` reduces demonstrated maintenance
or CI cost, and `P3` is opportunistic cleanup. Move a card by editing its Status cell and adding a
dated line under the card.

---

## Board

| ID | Improvement | Area | Priority | Size | Status |
|----|-------------|------|----------|------|--------|
| ENG-1 | Restore the documented Svelte gate and bound the deploy job | CI/release | P1 | S | Done |
| ENG-2 | Remove the dead standalone unlock mount | popup | P2 | S | Done |
| ENG-3 | Remove unsupported Synology task normalization | core | P2 | M | Done |
| ENG-4 | Stop rebuilding the same Chrome and Firefox artifacts in one workflow run | CI/release | P2 | M | In Review |
| ENG-5 | Replace the stale API README with a short canonical map | docs/api | P2 | S | Done |
| ENG-6 | Apply the verified low-risk local cleanup batch | popup/scripts | P3 | S | Done |
| ENG-7 | Establish a report-only dead-code baseline with Knip | tooling | P3 | M | Done |
| ENG-8 | Make the private-tracker login helper parse env files and navigation failures honestly | testing/tooling | P3 | S | Done |
| ENG-9 | Remove redundant direct development dependencies | tooling | P3 | S | Backlog |
| ENG-10 | Remove Knip-confirmed dead UI and test-support code | popup/testing | P3 | S | Backlog |
| ENG-11 | Audit browser-event ownership and remove only proven duplicate listeners | background/content | P1 | M | Backlog |

---

## Cards

### ENG-1 — Restore the documented Svelte gate and bound the deploy job

**Priority:** P1 · **Size:** S · **Area:** CI/release · **Status:** Done
**Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `package.json`

`npm run check:svelte` is named by the project instructions as a required completion check, but
neither CI nor the production deploy workflow runs it. The deploy job also has no
`timeout-minutes`, so a hung publish can occupy its non-cancelling `deploy-*` concurrency group for
GitHub's much longer default window.

**Acceptance:** run `npm run check:svelte` in both workflows after TypeScript typecheck; add an
explicit deploy timeout with enough headroom for install, mock E2E, packaging and publication
(start with 30 minutes and raise it only from measured runs); keep the existing typecheck, lint,
unit, deploy-test, production-build and mock-E2E gates.

**Completed 2026-09-15** — both workflows now run `check:svelte` after typecheck and deploy is
bounded to 30 minutes. The local Svelte gate passes.

### ENG-2 — Remove the dead standalone unlock mount

**Priority:** P2 · **Size:** S · **Area:** popup · **Status:** Done
**Files:** `src/popup/features/unlock/index.ts`, `src/popup/index.html`,
`src/popup/features/settings/index.ts`

`initializeUnlock()` and `UnlockFeature` have no consumer. Settings mounts `Unlock.svelte`
directly into `#settings-panel`; the separate `#unlock-panel` and its stale HTML comment are
unreachable.

**Acceptance:** remove the unused unlock entrypoint and placeholder without moving or rewriting
the live `Unlock.svelte` component. Locked settings must still mount into `#settings-panel`, unlock
success must still replace it with Settings, and popup initialization tests must stay green.

**Completed 2026-09-15** — removed the unused entrypoint and placeholder; the live Settings-owned
unlock mount and popup build remain green.

### ENG-3 — Remove unsupported Synology task normalization

**Priority:** P2 · **Size:** M · **Area:** core · **Status:** Done
**Files:** `src/lib/tasks.ts`, `src/lib/tasks.test.ts`

Production calls `normalizeTasks()` only for QNAP. Synology is an explicit product non-goal, yet
`Vendor`, `normalizeSynology`, two mapping tables and their tests maintain a second vendor path.

**Acceptance:** make task normalization QNAP-only and remove only tests of the deleted Synology
behavior. Keep the historical Synology research document unless its own status says it is
obsolete. The change must reduce production code and preserve every QNAP task-state mapping from
`agent-os/standards/api/qnap-download-station-contract.md`.

**Completed 2026-09-15** — normalization is QNAP-only; every numeric QNAP state mapping and the API
client tests remain green.

### ENG-4 — Stop rebuilding the same Chrome and Firefox artifacts in one workflow run

**Priority:** P2 · **Size:** M · **Area:** CI/release · **Status:** In Review
**Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `package.json`

CI runs `build:firefox` and then `package:firefox`, whose script runs `build:firefox` again. Deploy
runs a production Chrome build before `test:e2e:mock` rebuilds `dist-dev`, then
`package:chrome`/`release` performs the production build again. These are measured graph
duplicates, not the deliberate validation of both production and development artifacts.

**Acceptance:** keep standalone package commands safe for local use, add explicit package-from-
existing-dist commands for workflows, and ensure each target artifact is built once per job.
Production Chrome must still build before publication; mock E2E must still build and load
`dist-dev`; Firefox lint and the uploaded Firefox archive must inspect the same `dist-firefox`
created earlier in the job. Record before/after workflow duration when the change first runs.

**Moved to In Review 2026-09-15** — workflows now package existing production/Firefox output and
standalone package commands still build first. Local packaging and all 45 mock E2E scenarios pass;
the first CI/deploy run still needs its before/after duration recorded.

### ENG-5 — Replace the stale API README with a short canonical map

**Priority:** P2 · **Size:** S · **Area:** docs/api · **Status:** Done
**Files:** `src/api/README.md`, `agent-os/standards/api/qnap-download-station-contract.md`

`src/api/README.md` contains broken Quick Start import paths, omits current tests, describes the
checked-in `schema.d.ts` as auto-generated without a generator, and duplicates a QNAP contract
that already has a canonical standard. The document is now more likely to mislead than to help.

**Acceptance:** reduce it to a short module map: public client entrypoint, DTO boundary, checked-in
schema, tests, and a link to the canonical Download Station contract. Examples must compile from
their stated location. Do not copy the `temp`/`move` contract or session-lifecycle prose into a
third source of truth.

**Completed 2026-09-15** — the README is now a short, current module/test map that points to the
canonical contract instead of copying it.

### ENG-6 — Apply the verified low-risk local cleanup batch

**Priority:** P3 · **Size:** S · **Area:** popup/scripts · **Status:** Done
**Files:** `src/popup/features/downloads/DownloadsListShowcase.svelte`,
`src/popup/features/downloads/downloadsUI.ts`, `src/popup/features/downloads/autoRefresh.ts`,
`src/popup/features/downloads/downloadFilters.ts`, `scripts/check-contrast.mjs`

These findings were checked against current consumers and can be handled without changing an
architecture:

- replace the showcase's `$effect(() => view.tasks = tasks)` state mirroring with a derived view
  or direct input;
- reuse the existing settings-panel visibility helper instead of duplicating its DOM selector in
  `downloadsUI.ts`;
- remove the uncalled `isAutoRefreshRunning()` export;
- move the filter predicate tests/imports to `@lib/tasks` and remove compatibility-only
  predicate re-exports from `downloadFilters.ts`;
- remove the second `block(":root")` spread already contained in the contrast script's `base`.

**Acceptance:** keep this a deletion-oriented patch with no new general-purpose abstraction. The
Storybook showcase, popup behavior, contrast check and existing test suite must remain green.

**Completed 2026-09-15** — all five deletion-oriented cleanups landed; Svelte, typecheck, lint,
contrast and focused popup tests pass.

### ENG-7 — Establish a report-only dead-code baseline with Knip

**Priority:** P3 · **Size:** M · **Area:** tooling · **Status:** Done
**Files:** `package.json`, optional `knip.json` or equivalent, resulting task references

The external reviews were generated from incomplete Repomix snapshots and produced both real
findings and false positives. A repository-aware module graph is a better repeatable input, but an
unconfigured scanner can mistake Storybook stories, Vite entrypoints, Playwright fixtures and
scripts for dead code.

**Acceptance:** configure all production, test, Storybook, script and build entrypoints; run normal
and production-only Knip reports without `--fix`; classify every result as confirmed, dynamic
entrypoint, public/test contract, or false positive; and create narrowly scoped follow-up cards
only for confirmed findings. Do not make CI fail on the initial baseline and do not add blanket
ignores in place of correct entrypoint configuration.

**Completed 2026-09-15** — configured normal and production-only Knip reports without a CI gate or
blanket ignores. Findings were classified; confirmed new work is ENG-9/10 and missing `tsx`
remains owned by BUG-66.

### ENG-8 — Make the private-tracker login helper parse env files and navigation failures honestly

**Priority:** P3 · **Size:** S · **Area:** testing/tooling · **Status:** Done
**Files:** `scripts/tracker-login.mjs`, relevant script tests

`TRACKER_E2E_TOPIC="https://…"` is currently returned with its quotes, and the following
`page.goto(...).catch(() => {})` hides the resulting navigation error. The headed window can then
open blank with no explanation during an already-manual setup flow.

**Acceptance:** strip one matching pair of single or double quotes when reading the local env
file, reject an invalid or non-HTTP(S) URL before launching Chromium, and report a failed initial
navigation with the target origin and actionable guidance while keeping credentials/query values
out of logs. Cover quoted, unquoted, blank and malformed values with a small script-level test.

**Completed 2026-09-15** — env quoting and URL validation happen before Chromium starts; navigation
errors disclose only the origin, and the script-level cases run with deployment tooling tests.

### ENG-9 — Remove redundant direct development dependencies

**Priority:** P3 · **Size:** S · **Area:** tooling · **Status:** Backlog
**Files:** `package.json`, `package-lock.json`

The Knip baseline confirmed no source/config import of `chrome-webstore-upload`; the deployment
script implements the Store API directly. `@storybook/svelte` is already a normal dependency of
`@storybook/svelte-vite`, and `@unocss/preset-wind4` is already provided by `unocss`, which is
the package imported by `uno.config.ts`. They are redundant direct dev dependencies.

**Acceptance:** remove only those three direct dev dependencies, regenerate the lockfile, and
verify `npm run build-storybook`, `npm run build`, and `npm run test:deploy` still pass. Do not
replace the hand-written Store uploader with the removed package.

### ENG-10 — Remove Knip-confirmed dead UI and test-support code

**Priority:** P3 · **Size:** S · **Area:** popup/testing · **Status:** Backlog
**Files:** `src/popup/ui/index.ts`, `src/popup/ui/Card.svelte`,
`tests/e2e/support/actionPopup.ts`, `tests/e2e/support/httpCapture.ts`

No module imports the `Card` barrel export or its component. `isPinnedToToolbar()` and
`persistHttpCapture()` have no callers; their neighbouring `POPUP_SIZE` and
`persistHttpCaptureBundle()` remain live through internal use and the production spot check.

**Acceptance:** remove only the unused Card component/barrel export and the two uncalled helpers;
keep the live neighbouring helpers intact. Run typecheck, unit tests, and mock E2E after removal.

### ENG-11 — Audit browser-event ownership and remove only proven duplicate listeners

**Priority:** P1 · **Size:** M · **Area:** background/content · **Status:** Backlog
**Files:** `src/background/index.ts`, `src/background/downloads.ts`, `src/content/magnet.ts`,
background/content registration helpers and interception tests

The intermittent torrent symptom is no longer reproducible after reinstalling the extension and
the current maintenance changes. That is evidence to inspect ownership, not evidence for a new
deduplication layer. Before GAP-16 changes interception, inventory every browser listener and
initialization path that can observe a click/download or issue a NAS request.

Compare the resulting event graph with the smallest competitor patterns already inspected:
Wolff/garoloup is context-menu-only; the Synology client uses download lifecycle events for its
transaction; Send To QNAP++ combines download and navigation events. More listeners are not a bug
by themselves — each must be tied to a distinct browser/user intent and tested by request count.

**Acceptance:**

- list every relevant `chrome.*.addListener`, content-script registration/reinjection, storage
  change listener, alarm and startup initializer, with its owner and whether it can reach
  `AddTorrent`/`AddUrl`;
- prove with tests which paths can observe the same action (`downloads.onCreated`,
  `downloads.onChanged`, content click, context menu, reinjection and worker restart);
- record the single component responsible for cancellation/resume and for each user-visible
  notification;
- remove or consolidate a listener only when a failing request-count/browser-outcome test proves
  duplication, then keep that test as the regression contract;
- create separate follow-up cards for confirmed complexity that is unsafe to remove in this
  audit; do not turn suspicions into production changes.

**Forbidden shortcut:** no persistent browser-download/task-ID history, startup sweep, or broader
retry state may be introduced to “make duplicates impossible” without a captured duplicate and a
trace showing its source. A clean audit with no deletion is a valid result.

---

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
