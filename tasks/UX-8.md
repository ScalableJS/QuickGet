---
type: "task"
id: "UX-8"
status: "done"
priority: "p2"
area: "settings"
board: "settings-ux"
updated: "2026-10-09"
legacy_status: "Done"
size: "M"
---

# Master password protects settings, not downloads

**Size:** M · **Area:** settings
**Decided:** 2026-08-28 (owner) · reviewed against an external consultation
**2026-08-28:** implemented. `credentials.ts` deleted, `settingsLock.ts` added, `isLocked()`
and `unlock()` removed from `settings.ts`, and the popup no longer hides the task list behind
a lock screen.

**Decision:** the master password no longer gates downloading. It gates access to the settings
screen. The NAS password is therefore always available to the service worker, and the global
`LOCKED` state disappears from the background path entirely.

**Consequence that must be stated honestly:** if the background can always read the NAS
password, that password cannot be encrypted with a key only the user knows. The master password
becomes a UI lock, not cryptography. Naming it "Master password" or "Encrypt NAS password"
would promise more than is delivered.

**Storage model:**

```
settingsLockEnabled      bool
settingsPasswordSalt     string
settingsPasswordVerifier PBKDF2(password, salt)   // password itself never stored
settingsUnlocked         → chrome.storage.session // cleared on browser restart
```

The NAS password lives in `chrome.storage.local`. Call
`chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })` — verified present
in `@types/chrome` — so content scripts cannot read it. This is defence in depth, not a
security boundary: extension code can still read it by design.

**UI wording** (must not overstate):

- Setting: **Protect settings** — "Require a password to view or change your NAS connection
  settings."
- Always alongside it: **"Background downloads will continue to work while settings are
  locked."**
- On create: "This password protects access to your connection settings. It does not encrypt
  the NAS password."
- Lock screen: **Settings are locked** / button **Unlock settings** — never "Unlock QuickGet".

**Rejected alternatives** (each considered, each rejected with a reason):

| Option | Verdict |
| --- | --- |
| Key in `chrome.storage.session` | No — cleared on restart, reproduces the exact failure we are removing |
| Non-extractable `CryptoKey` in IndexedDB | Technically works and survives restart, but extension code can still decrypt — at-rest hardening, not a user vault. Not worth IndexedDB, key lifecycle, migration and new failure paths in the worker |
| Device-bound key | `chrome.enterprise.platformKeys` is ChromeOS + policy-installed only. Not available to a Web Store extension |
| OS keychain via native messaging | Genuinely stronger, but needs a native component per OS. Disproportionate here |

**Steps:** remove the encrypted-password branch and migrate any existing
`encryptedNASpassword` into plain storage on first run → introduce the settings verifier →
delete `isLocked()` from the interception path, where a missing password is already reported by
`findConfigProblem()` as ordinary misconfiguration.
