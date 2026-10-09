---
type: "task"
id: "GAP-15"
status: "todo"
priority: "p2"
area: "background/api"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "S"
---

# A redirecting download URL is handed to the NAS unresolved

**Size:** S · **Area:** background/api
**Files:** `src/api/client.ts` (`addUrl`), `src/background/menus.ts`, `src/background/magnetHandler.ts`

*Send To QNAP++* fetches a link itself and forwards `response.url` — the address after redirects —
rather than what the user clicked, with a comment naming a real case (`itorrents.org` redirecting
to `itorrents.net`) where Download Station's own fetcher does not follow and the task lands dead
(`plus/SendLink.js:566-570`, `docs/competitor-routing-teardown.md` section F).

Our `.torrent` path is already immune: we fetch in the browser and upload the file, so a redirect
is resolved before the NAS ever sees anything. `AddUrl` is not — a plain HTTP link goes to the NAS
exactly as the page wrote it. Magnets are unaffected.

**Establish before building.** It is not known whether QNAP's fetcher follows redirects; if it
does, this is nothing. A HEAD or ranged GET before `AddUrl` costs a round trip on every ordinary
download, so it is only worth it if the failure is real.

**Acceptance criteria**

- [ ] Confirmed on hardware whether Download Station follows a 30x on an `AddUrl` target.
- [ ] If it does not, the URL is resolved before sending, without adding a request to the common
      case where no redirect occurs.
- [ ] A dead task caused by a redirect is distinguishable from a dead task caused by anything
      else — silence here is what makes it expensive.

**2026-09-09 — filed under routing by accident; it is send correctness.** Nothing here depends on
a rule or a destination: a redirecting URL handed to the NAS produces a dead task whatever folder
it was going to. Keeping it in the routing list made that list look longer than it is. Unchanged
otherwise — still small, still gated on one question to a real NAS.
