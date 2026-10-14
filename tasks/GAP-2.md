---
type: "task"
id: "GAP-2"
status: "todo"
priority: "p2"
area: "api"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "M"
---

# A NAS firmware change reads as "no downloads", not as a fault

**Size:** M · **Area:** api
**Files:** `src/lib/tasks.ts` (`normalizeTasks`, `asRecord`); `src/background/alarms.ts`
(`pollStatus`); `src/popup/features/downloads/`

The most damaging failure in this category is not a bug in the extension — it is a NAS
firmware update changing the API underneath it. It has killed competitors outright:

- `seansfkelley/nas-download-manager` #166: DSM 7 broke right-click sending; the maintainer's
  own note — "Synology confirmed they are changing how this extension will have to talk to
  Download Station in DSM 7, but they have declined to specify how or when". The extension
  stayed incompatible for months.
- #147: "unable to connect to DSM after the latest Update … everything was working fine until
  Synology DSM update."
- Reddit /r/qnap on Download Station 5: "Search is completely broken again … I think it broke
  a few months back after a QTS firmware upgrade."

**The specific hole, located (2026-08-31).** Session expiry is already handled correctly
(single-flight re-login and replay, `api/index.ts`). The unhandled case is a response that
authenticates fine but no longer has the shape we expect. Today:

- `asRecord` (`tasks.ts:180`) returns `{}` for anything that is not an object;
- `normalizeTasks` (`tasks.ts:325`) tries `payload`, `.tasks`, `.data`, `.result` in turn and
  falls back to `?? []` when none match;
- `pollStatus` keeps the last-known badge on failure — correct for a transient error.

So a renamed envelope key produces **an empty task list and no error at all**. The user sees
"no downloads" while their NAS is downloading, and we never hear about it. That is precisely
the silent breakage that cost the competitors months.

**Acceptance criteria**

- [ ] `normalizeTasks` distinguishes "the NAS reported zero tasks" from "no recognised
      envelope key was present" and the two are not both `[]`.
- [ ] The second case surfaces in the popup as a specific message naming the likely cause —
      a Download Station update — not a generic failure.
- [ ] The message includes the QTS/DS version we already read, and a link to the issue
      tracker, so a user report arrives with the one fact we need.
- [ ] A well-formed empty list still renders the ordinary empty state, with no warning.
- [ ] No telemetry, no automatic reporting: the user chooses to open the link.

**Implementation sketch**

Change `normalizeTasks` to return a discriminated result (`{ kind: "tasks" } | { kind:
"unrecognised", sawKeys }`) rather than a bare array, and let the caller decide. Keep the
envelope-key tolerance we already have — it is what makes us work across QTS versions — but
stop conflating "not found" with "empty".

**Do not build a retry.** We cannot pre-empt an unknown API change; the deliverable is
diagnosis. Turning a silent breakage into an actionable report is the whole value.

**Prior art — two hard-won lessons from clients that survived a firmware break**

- **Namespace the error codes, don't flatten them.** Established clients key vendor errors by
  API group (`common`, `Auth`, `DownloadStation.Task`, …) rather than one flat table, because
  the same numeric code means different things per endpoint. Directly relevant here: a
  `common` code meaning *"the requested API does not exist"* is exactly the signal a firmware
  update produces, and it is only distinguishable once codes are namespaced. That is a
  cheaper, earlier detector than shape-sniffing the payload, and the two complement each
  other — catch the explicit code where the NAS sends one, fall back to envelope detection
  where it does not.
- **Do not trust the NAS's own capability declaration.** A client that tried to negotiate by
  asking the device which API versions it supports found the new firmware *misreporting* its
  support, and had to fall back to attempting a version and reacting to the
  unsupported-version error instead. So: probe and react, never believe a declaration. This
  is the difference between a card that works after the next QTS release and one that repeats
  a known failure.

**Failure modes**

- A genuinely empty NAS must never warn. This is the regression that would make the feature
  worse than nothing.
- A partially-changed response where the envelope is fine but per-task fields moved:
  `normalizeQnap` would yield tasks with undefined fields. Worth deciding whether a task that
  normalises to no id/name counts as unrecognised.

**Test plan**

- Vitest against `normalizeTasks`: a real QTS 5 payload, an empty-but-valid payload, a
  renamed-envelope payload, and a payload whose task records lost their id field. This is a
  pure function — the whole card is cheap to test.
- Playwright: mock NAS variant returning a renamed envelope; assert the popup shows the
  update-specific message rather than the empty state.
