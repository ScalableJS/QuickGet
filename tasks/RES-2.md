---
type: "task"
id: "RES-2"
status: "todo"
priority: "p2"
area: "api/research"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "S"
---

# Decide whether `ftp://` links are worth supporting

**Size:** S · **Area:** api/research
**Files:** `src/background/menus.ts` (`isSupportedUrl`)

Download Station accepts HTTP/HTTPS, **FTP/FTPS**, magnet and BitTorrent. Our validator
(`menus.ts:102-110`) accepts only `magnet:`, `http:` and `https:`, so an `ftp://` link is
refused with "Only web and magnet links can be sent to Download Station" even though the NAS
would take it.

The change itself is one line. The question is whether it should be made at all: FTP links in
a browser are close to extinct — Chrome removed FTP support entirely in version 95 — so an
`ftp://` anchor is something the browser itself can no longer open. Adding a branch for it
means carrying code, a test and an error path for a case that may never occur.

**Decide, then act:**

- [ ] Establish whether any real user hits this — an issue, a review, or a concrete site.
- [ ] If yes: extend `isSupportedUrl` and its unit test, and confirm the NAS accepts the URL
      form we pass.
- [ ] If no: close this card as "not needed" and leave the validator alone. Not shipping the
      branch is a valid outcome and should be recorded as one.

Deliberately **not** doing it speculatively: we do not add code for users we have not met.
