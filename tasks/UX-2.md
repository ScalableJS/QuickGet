---
type: "task"
id: "UX-2"
status: "done"
priority: "p2"
area: "ui"
board: "settings-ux"
updated: "2026-10-09"
legacy_status: "Decided: no library"
size: "M"
---

# Form validation approach: hand-rolled vs schema library

**Size:** M · **Area:** ui

Where validation lives today, all hand-written and all tested:

| Concern | Module |
| --- | --- |
| Server address parsing | `src/lib/serverUrl.ts` |
| NAS folder paths | `src/lib/folderPath.ts` |
| Routing rules | `src/lib/routingRules.ts` |
| Required-settings check | `src/lib/configHealth.ts` |
| Imported backup JSON | `src/popup/features/settings/settingsBackup.ts` |
| Stored settings shape | `src/lib/settings.ts` |

**The question:** introduce a schema library (Zod, Valibot) or keep hand-rolled rules.

**Against, for the form itself:**

- The rules are not shape checks. "Is this a reachable NAS folder" is answered by the NAS, not
  by a schema; `serverUrl` normalises as much as it validates. A schema would sit on top of the
  existing functions, not replace them.
- It changes nothing about the actual complaint. Zod produces messages; it does not produce
  `aria-invalid`, `aria-describedby`, focus management, or grouping. UX-1 and UX-4 are needed
  either way.
- Weight matters here in a way it does not on a server. Zod is the heaviest option; Valibot is
  modular and tree-shakes to a fraction of it. Current runtime dependencies: **one**
  (`openapi-fetch`).

**For, at two specific boundaries** — where data is not ours and the current code is weakest:

- `parseImportedSettings()` — arbitrary JSON from a user-chosen file.
- `loadSettings()` — storage written by an older version, or by a different machine's sync.

Both are trust boundaries where a declarative schema is genuinely better than
`typeof x === "string"` chains, and both are the places a malformed value silently becomes a
broken configuration.

**Recommendation:** no schema library for the form. If one is wanted for the two boundaries
above, pick **Valibot** over Zod on size, and scope it to those two functions only. Decide
before UX-4 starts, since UX-4 touches the same call sites.
