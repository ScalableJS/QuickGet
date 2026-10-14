---
type: "task"
id: "UX-7"
status: "done"
priority: "p2"
area: "ui"
board: "settings-ux"
updated: "2026-10-09"
legacy_status: "Done"
size: "L"
---

# Connection has no connected/disconnected state model

**Size:** L · **Area:** ui
**Decided:** 2026-08-28 · supersedes the original "Connect / Disconnect" sketch
**2026-08-28:** implemented. `src/lib/connectionHealth.ts` holds the health axis; the
Connection section shows a card with Test connection / Edit / Remove once configured, and the
form only while unconfigured or explicitly editing. Save and test are one action.

**Decision:** do not model this as Connected/Disconnected. A SID is a runtime cache detail — it
can expire in a minute while the saved configuration stays perfectly correct, so "disconnected"
would lie to the user. Split into three independent axes that were previously tangled:

```
Configuration : Not configured | Configured      ← address+login+password saved
NAS health    : Unknown | Ready | Unreachable | Auth failed
Settings UI   : Locked | Unlocked               ← UX-8
```

`SID expired ≠ disconnected`. The UI must never know whether a SID currently exists.

**Screens:**

- *Not configured* → the form, with one primary action **Save & test**: validate → log in →
  only persist on success. Credentials the NAS just rejected must never replace working ones.
- *Configured* → no inputs at all. `admin@qnap.home`, `✓ Ready`, `Last checked 2 minutes ago`,
  with **Test connection**, **Edit**, and a destructive **Remove connection**.
- *NAS unreachable* → `admin@qnap.home` / **NAS unreachable** / "Saved connection settings are
  still in use." Never a blank form.
- *Auth failed* → **Authentication failed** / "The NAS rejected the saved credentials." →
  **Review connection**.

**No `Disconnect` button.** It is ambiguous — log out the SID, delete the password, stop
intercepting, forget the NAS? — and logging out a SID is pointless because the next torrent
logs straight back in. Two distinct commands instead: **Edit connection** and **Remove
connection** (with confirmation). Temporarily stopping interception is the existing
`torrentInterceptMode` setting, not a connection action.

**Password field while editing:** show `Saved` with a **Change password** button rather than an
empty input. An empty field must never overwrite a stored password — that is exactly how the
password was lost in the field.

**Login vs Test connection:** one action, two labels by context — **Save & test** while
editing, **Test connection** on the configured card. No third `Connect`: it implies a
persistent session that does not exist.

**Health state persists as** `{ lastCheckedAt, lastSuccessAt, lastFailureAt, lastFailureKind }`.
No SID in it.
