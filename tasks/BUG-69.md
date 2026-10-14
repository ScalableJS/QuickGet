---
type: "task"
id: "BUG-69"
status: "done"
priority: "p1"
area: "testing/release"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# No release gate touches the real NAS

**Severity:** high · **Area:** testing/release
**Files:** `.claude/skills/release/SKILL.md`, `tests/e2e/popup.real-nas.spec.ts`, `package.json`,
`tests/e2e/README.md`
**Blocked by:** BUG-67 — the real-NAS spec does not currently run at all.

Everything the release procedure checks before promoting `env/dev` to `env/prod` — typecheck,
Biome, 512 unit tests, 45 E2E, three builds, CI — runs against `mockNas.ts`. The mock answers
exactly the questions it was written to answer, which is the one thing a pre-production check must
not do. Two failures this month were invisible to all of it:

- **RES-5 file interception** passed its mock E2E and was reported working, while against the real
  NAS the first click returned `12288`. The mock accepts any URL; Download Station fetches it
  itself, from its own machine, and a loopback URL is unreachable from there.
- **BUG-67** — the real-NAS spec has been broken since `4f80131` (2026-06-21) and nobody noticed
  for two months, because an opt-in suite that is never run is indistinguishable from one that
  passes.

So the gap is not "we lack a test". It is that **nothing in the path to the Web Store ever speaks
to a QNAP**, and users are the first integration test. That is the risk this card closes.

#### What the spot check is

One named, scripted run — `npm run test:prod-spotcheck` — executed locally against the real NAS,
**after the quality gates and before the release PR is opened**. Its output is pasted into the PR
body, so a promotion carries evidence rather than an assertion.

It is deliberately **not in CI**: GitHub runners have no route to the NAS, and the credentials live
in `.env.e2e.local`, outside git and outside Actions by design. Trying to move it into CI is the
tempting wrong turn — it would mean putting NAS credentials into repository secrets and exposing
Download Station to the internet.

#### Which build it runs against

**The production build, always** — `dist`, the bundle the Web Store receives. The mock suite owns
the dev build (`dist-dev`); the real NAS owns the release artifact. The invariant is the whole
point of a spot check: *what was validated is what ships*. A green real-NAS run on a dev bundle
proves something about an artifact nobody installs.

**Established 2026-09-13**, ahead of the implementation: `tests/e2e/support/builds.ts` now holds
the two paths, all 17 specs were split between them, and each script builds its own artifact via
`pretest:e2e:*`, so no suite can pass against a stale bundle.

#### What it must cover

The base functionality a client loses if it breaks, each with what actually proves it. "The NAS
returned `error: 0`" is **not** proof for any of these — that is precisely what `12288` taught:
acceptance and downloading are different events.

| # | Flow | Proof required |
|---|------|----------------|
| 1 | Connection test from Settings | Real `Misc/Login`, "Connection successful", credentials round-trip after a reload |
| 2 | Task list renders live NAS state | At least one task from `Task/Query` rendered with name, size and progress |
| 3 | `.torrent` file upload from the popup | `AddTorrent` accepted **and** the task appears in the list under its real `info.name` |
| 4 | `.torrent` link click on a page | Intercepted, no file on disk, task created |
| 5 | Magnet click | `AddUrl` with the magnet, task created |
| 6 | Direct file link (RES-5) | Task reaches a **download phase with progress > 0**, not merely accepted |
| 7 | Pause / resume / remove | State actually changes on the NAS, verified by re-query, not by the popup's optimism |
| 8 | Toolbar badge | Count matches the NAS's own downloading count while a real transfer runs |
| 9 | Routing rule | A rule sends a task to a different destination folder, confirmed in the task's `path` |

Flow 6 needs the test stand bound to the LAN (`QNAP_STAND_LAN=1`) and the NAS on the same network;
the throttled `large-<n>mb.bin` endpoint exists so this one can be observed rather than raced.

#### Rules the run must obey

1. **It only ever touches tasks it created.** Owned prefix (`quickget-e2e-`) plus
   `cleanupTasksByPrefix` on the way in and out, as the current mutating test already does. The NAS
   is a live machine with the user's own downloads on it.
2. **It leaves the NAS as it found it** — including when it fails halfway. Cleanup belongs in
   `finally`, not at the end of the happy path.
3. **It fails loudly and specifically.** A timeout that says only "60 s exceeded" is what let
   BUG-67 hide; each flow should say which call it was waiting on.
4. **It records evidence.** The redacted HTTP bundle already written to
   `.e2e-artifacts/real-nas-*.log` is the right mechanism — extend it, do not invent a second one.

#### Open questions, to settle when implementing

- **One spec or several?** Today it is one file with a read-only test and a `@mutating` one. Nine
  flows in one file will be unreadable; splitting them means deciding what shares a browser session,
  since launching the extension and saving settings is the slow part.
- **How long may it take?** A spot check nobody runs because it takes fifteen minutes is BUG-67
  again in a new costume. The throttled file makes flow 6 as slow as we choose — pick a size that
  proves progress and no more.
- **What happens when the NAS is unreachable at release time?** Skipping silently is how this class
  of gap forms. It should be a deliberate, recorded decision to release without it.

**Resolved 2026-09-13** — implemented as `npm run test:prod-spotcheck`, and shaped down from the
nine flows above to **four** after review: connection, `AddTorrent`, magnet `AddUrl`, and the
direct-link lifecycle, which absorbed the list's task-rendering, pause/resume/remove and routing
checks. Interception, badge arithmetic and rendering stayed hermetic — rebuilding the 45 mock tests
against the owner's hardware would only produce a second suite to rot.

Runs in **13 s** against the live NAS. Determinism comes from a server-side barrier rather than
sleeps: the stand sends exactly 4 MB, announces it, and holds until released, so "partial progress"
is a fact rather than a race.

Ownership turned out to need three overlapping mechanisms, not one. The prefix and an in-memory
list were not enough: three orphaned tasks were left on the real NAS during development, all of
them dying between `AddTorrent` succeeding and the test learning the task's identifier. The ledger
now records intent *before* creation, cleanup failure fails the gate, and preflight sweeps anything
carrying the prefix that no ledger entry claims.

Not done, and recorded here rather than silently dropped: the Download Station V4 API exposes no
firmware version (`Misc/Version`, `Misc/Config`, `Misc/About` all answer `no such api`), so the run
records the target it can verify instead of a fabricated version field.
