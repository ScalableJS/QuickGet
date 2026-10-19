---
type: architecture
status: active
area: settings
updated: 2026-10-19
features: ["connection-settings", "settings-lock", "settings-backup"]
---

# Connection, settings, backup, and screen lock

## Connection and saving

The settings screen has Connection and Advanced tabs. A configured connection is summarized as a card; editing exposes fields. Server URL parsing resolves scheme, address, and port into stored settings. Required fields and folder checks belong to the form, while configuration health and the last connection-check result remain separate concepts. Enter uses the same native form submission as Save. An open folder picker consumes Enter to confirm or close its own choice before settings submission. Missing fields are marked together on submit before URL parsing, and the first problem is focused. Malformed nonempty addresses receive an error on the address field. Required-field errors clear as that field is edited; error borders remain visible in focus.

`pingNas()` performs only a login with a five-second budget. Ready, authentication failure, and unreachable are outcomes, not a claim that all Download Station operations work. Saving persists valid settings before following up with connection verification; a quiet NAS must not hold the Save button indefinitely. A plain `Settings saved` confirmation expires after 2.5 seconds; pending verification remains visible until its outcome. Saving or removing the connection invalidates pending downloads queries and commands, clears former rows/selection, and refreshes from the current configuration. Delayed former-NAS work cannot restore its rows or command feedback. The default Temp and Target folder is `Download`; missing configuration does not authorize interception.

## Storage and security

| Data | Storage | Meaning |
|---|---|---|
| NAS address, login, password, folders, rules, theme | `chrome.storage.local` | Persists across browser restarts; NAS password is not encrypted |
| Session NAS password | `chrome.storage.session` | Preferred by loading; supplements local storage |
| Settings lock salt and PBKDF2 verifier | Local storage | The settings-lock password itself is not stored |
| Settings unlocked flag | Session storage | Clears across browser restarts; background downloads remain available |
| Schema version | Local storage | Version 2 migration removes obsolete activity/interception keys |

The screen lock uses PBKDF2/SHA-256, 250,000 iterations, a random 16-byte salt, and a 256-bit verifier. It protects casual viewing/editing of the Settings screen. It does not encrypt NAS credentials, prevent background task operations, or protect against someone reading the browser profile. The form requires an eight-character settings password and confirmation when enabling/changing the lock.

Partial settings saves that omit `NASpassword` preserve the existing credential. Saving removes obsolete encrypted-password and cached-master-password keys; migration does not introduce a new encryption scheme. Removing a connection clears its address, login, and password. The settings UI mounts the unlock panel when locked; the component is active even though the old standalone unlock initializer was removed.

## Backup and import

Export uses the current settings draft and includes only portable non-secret fields: connection endpoint/login, folders, file-link interception, routing rules, and theme. NAS password, lock password, salt/verifier, and session flags are excluded. Import accepts the wrapper or a bare settings object, validates field types, ignores unknown fields, and sanitizes rules. The exported format is version 1; importing it is a settings patch, not a restore of an authenticated session. Choosing a valid file immediately fills the form and clears previous field/folder verdicts; a connection import opens the editable Connection tab. There is no intermediate replacement confirmation. An invalid file leaves the draft unchanged. A persistent status reminds the user to review and Save; only Save or Enter persists the imported draft. An excluded NAS password must still be supplied when the receiving profile has none.

## Theme

Auto, Light, and Dark are applied and saved immediately, without waiting for Save. Popup and page feedback resolve their own rendering context from the same saved preference. [[interface]] owns the visual implementation.

## Sources and evidence

- [Settings.svelte](../../src/popup/features/settings/Settings.svelte), [settings.ts](../../src/lib/settings.ts), [config.ts](../../src/lib/config.ts), [connectionHealth.ts](../../src/lib/connectionHealth.ts).
- [settingsLock.ts](../../src/lib/settingsLock.ts), [settings initializer](../../src/popup/features/settings/index.ts), [Unlock.svelte](../../src/popup/features/unlock/Unlock.svelte).
- [settingsBackup.ts](../../src/popup/features/settings/settingsBackup.ts).
- Unit tests cover settings, lock, URL parsing, connection health, and backup parsing. [Connection E2E](../../tests/e2e/settings-connection.spec.ts) covers the visible form and time budget; [popup cycle](../../tests/e2e/popup.full-cycle.spec.ts) covers the lock and import/export journey.

Source inspection and existing tests do not certify encrypted storage: there is none. Field behavior on every NAS firmware is outside these checks.


## Interception default ownership

Settings reads resolve defaults and legacy values in memory without writing inferred defaults back. A controlled older-snapshot interleaving reproduced overwriting newer file interception, HTTPS, port and theme choices. Explicit save and migration own persistence; stored boolean/string choices still follow the existing normalization contract. The absent file-interception choice remains false.


## Authentication evidence and current scope

Download Station access belongs to NAS user accounts with application privileges, as described in
[QNAP's manual](https://docs.qnap.com/operating-system/qts/4.2.x/cat2/en-us/download_station.htm).
The vendor login view fetched read-only from the NAS on 2026-10-19 accepts an empty password for
submission and tries an existing QTS session on startup. Neither observation proves successful
anonymous or blank-password task management. The extension continues to require an explicit
username and password; no additional authentication mode was introduced in this form correction.
[BUG-81](../../tasks/BUG-81.md) records the source evidence, browser regressions and consultation.
