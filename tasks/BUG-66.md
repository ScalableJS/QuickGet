---
type: "task"
id: "BUG-66"
status: done
priority: "p2"
area: "tooling"
board: "bugs"
updated: 2026-10-10
legacy_status: "Backlog"
severity: "medium"
---

# `npm run stand` cannot run — `tsx` is not a dependency

**Severity:** medium · **Area:** tooling
**Files:** `package.json`

```
> quickget-remote@2.4.3 stand
> tsx scripts/start-stand.ts
sh: tsx: command not found
```

`"stand": "tsx scripts/start-stand.ts"` is the documented way to bring up the manual test stand
and the mock NAS, and `tsx` appears in **neither `dependencies` nor `devDependencies`**. So the
script cannot work on a clean checkout — it only ever worked for someone with `tsx` installed
globally. `node scripts/start-stand.ts` is not a substitute: Node's type stripping does not
rewrite the repo's `.js` import specifiers back to `.ts`, so it fails with `ERR_MODULE_NOT_FOUND`
on `tests/e2e/support/mockNas.js`.

Workaround while it is open: `npx -y tsx scripts/start-stand.ts`.

**Proposed fix:** add `tsx` to `devDependencies`. It is the only thing the script needs and the
only script that needs it.

**Worth deciding at the same time:** the mock NAS binds to a random port on every start, so the
port has to be re-entered into extension settings for each manual session. A fixed default with an
override would make the stand usable without that ritual.

Found while bringing the stand up to hand over for manual testing.


## Polish execution: 2026-10-10

Terra owns the bounded implementation/reproduction work; Codex owns review, Mimic consultation, integrated verification and acceptance. This starts the current polish pass without closing historical evidence gaps.


## Implementation reviewed: 2026-10-10

tsx is a declared development dependency with lockfile entries. The actual npm run stand command started its services and stopped with Ctrl+C. A fixed default stand port is an optional future UX choice, not needed to fix the missing executable. Integrated verification is recorded below.


## Accepted polish: 2026-10-10

Codex accepted the bounded source/test delta after Terra implementation and substantive Mimic consultation. Fresh integration passed 595 unit/fixture tests, 61 Chromium mock E2E, ten consecutive classifier repetitions, typecheck, Svelte (zero errors/warnings), lint, production build and six real-NAS spot checks; the owned-task ledger is empty. [The final audit](../docs/quality/code-quality-audit.md#final-integrated-acceptance) and [verification](../docs/system/verification.md#final-polish-integrated-acceptance-2026-10-10) retain exact scope and coverage limits. No release or store publication is performed.
