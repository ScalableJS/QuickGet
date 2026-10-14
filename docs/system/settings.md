---
type: architecture
status: active
area: settings
updated: 2026-10-10
features: ["connection-settings", "settings-lock", "settings-backup"]
---

# Connection, settings, backup, and screen lock

## Connection and saving

The settings screen has Connection and Advanced tabs. A configured connection is summarized as a card; editing exposes fields. Server URL parsing resolves scheme, address, and port into stored settings. Required fields and folder checks belong to the form, while configuration health and the last connection-check result remain separate concepts.

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

Export includes only portable non-secret fields: connection endpoint/login, folders, file-link interception, routing rules, and theme. NAS password, lock password, salt/verifier, and session flags are excluded. Import accepts the wrapper or a bare settings object, validates field types, ignores unknown fields, and sanitizes rules. The exported format is version 1; importing it is a settings patch, not a restore of an authenticated session. UI confirmation precedes replacement.

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
