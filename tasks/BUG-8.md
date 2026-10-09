---
type: "task"
id: "BUG-8"
status: "done"
priority: "p2"
area: "settings"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# No settings schema version or migration path

**Severity:** medium · **Area:** settings

A stored `"off"` cannot be distinguished between "the bug wrote it" and "the user chose it",
so it must not be flipped silently. Needs a `settingsSchemaVersion` key and an
`onInstalled(details.previousVersion)` hook: for profiles upgrading from an affected version,
notify once rather than rewriting the user's choice.

Prerequisite for closing BUG-1 properly.

**Done 2026-08-27** — `SETTINGS_SCHEMA_VERSION` + `migrateSettings(previousVersion)` in
`src/lib/settings.ts`, called from `onInstalled` in `src/background/index.ts`. A stored `"off"`
from **1.0.2 only** raises a one-time notification and is never rewritten — verified against the
history: 1.0.0 and 1.0.1 shipped the correct `"always"` default, so an `"off"` there is the
user's own choice. The "shown" marker is separate from the schema version and is written only
after the notification was actually created.
