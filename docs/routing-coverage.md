# Routing rules — what is covered, what cannot be, and what that means

Written 2026-09-09, after the routing engine stopped matching on the URL and started matching on
the name a download will actually have. The question this answers is not "do the tests pass" but
**"which links do we actually route, and on what"** — because every uncovered combination so far
turned out to be one where routing silently fell through to the default folder and nobody saw it.

Two things do the work:

- **`tests/e2e/fixtures/test-stand/index.html`** — the manual stand, five tabs of real links.
  Run it with `npm run stand`.
- **`tests/e2e/routing-matrix.spec.ts`** — drives every case the stand can produce against one
  rule set and asserts the folder the NAS was actually told to use. It attaches the table below
  to the Playwright report on every run, passing or failing.

The stand's host (`tests/e2e/support/testStandHost.ts`) generates a **different torrent per link**,
with `info.name` set to the release the link claims to be. Before that it served one shared
`sample.torrent` for everything, so no test could tell whether the extension routed on the URL or
on the file — the two answers were indistinguishable, which is exactly how the bug survived.

## The matrix — asserted on every run

Rules, in order (first match wins), fallback `Multimedia/Default`:

```
1. site localhost                                  → R/OtherHost
2. magnet + site never.example.org + name avi      → R/WrongSite     (must never fire)
3. magnet + site 127.0.0.1        + name avi       → R/FromThisSite
4. magnet + name mkv                               → R/MagnetMovies
5. magnet                                          → R/MagnetsAny
6. torrent + name *S01*                            → R/Series
7. torrent + name mkv                              → R/TorrentMovies
8. torrent + name iso                              → R/Images
9. url     + name mkv                              → R/DirectMovies
```

Rule 2 exists to fail loudly: it is identical to rule 3 except for a site that never matches, so
if the site condition were ever dropped or matched permissively — it *was* stripped from magnet
rules until 2026-09-09 — it would swallow the origin case and the run would go red. Note the bare
extensions: a field holds a list, and a token without a wildcard is an extension, so `mkv` and
`*.mkv` mean the same thing.

| # | Source shape | Entry path | Name matched against | Lands in |
|---|---|---|---|---|
| 1 | `.torrent` link naming an `.mkv` | download interception | `info.name` | `R/TorrentMovies` |
| 2 | `.torrent` link naming an `.iso` | download interception | `info.name` | `R/Images` |
| 3 | uppercase `.TORRENT` extension | download interception | `info.name` | `R/Images` |
| 4 | **opaque tracker endpoint `dl.php`** — no extension, no name in the URL | download interception | `info.name` | `R/TorrentMovies` |
| 5 | **MIME only** — no `Content-Disposition`, no extension; the name exists nowhere outside the file | download interception | `info.name` | `R/TorrentMovies` |
| 6 | multi-file season pack (directory torrent) | download interception | `info.name` (the directory) | `R/Series` |
| 7 | same torrent served from a second hostname | download interception | domain, rule 1 wins on order | `R/OtherHost` |
| 8 | magnet with a `dn` | content-script capture | `dn` | `R/MagnetMovies` |
| 9 | magnet whose `dn` has a broken percent escape | content-script capture | `dn`, decoded safely | `R/MagnetMovies` |
| 10 | **magnet with no `dn` at all** | content-script capture | nothing — only `type` can match | `R/MagnetsAny` |
| 11 | BitTorrent v2 magnet (`urn:btmh`) | content-script capture | `dn` | `R/MagnetMovies` |
| 12 | **magnet matched by the page it was clicked on** | content-script capture | the page's host — a magnet has none of its own | `R/FromThisSite` |
| 13 | plain `.mkv` download | — | — | **not sent to the NAS at all** |

The run then closes the loop the other way: it reloads the popup and asserts that the magnet's
card **displays** `R/MagnetMovies`, and that the task which went to the Target folder shows no
folder line at all. Everything above asserts what was *sent*; this asserts what the user *sees*.
A magnet is the case worth spending it on — it is the only one with neither a filename nor a host
of its own — and it is the path the mock used to lie about: `AddUrl` validated the `move` it was
given and then created the task with a hardcoded folder, so no test could have caught a magnet
losing its destination.

Rows 4 and 5 are the ones that mattered: both used to route as `url`, on a name of `dl.php` or the
empty string. Row 12 is the other one — a domain rule could never match a magnet before, because
the matcher only ever looked at the link's own host. Row 13 is asserted deliberately — see below.

## What the stand cannot exercise, and why

| Not covered | Why | Tracked as |
|---|---|---|
| **Chrome's native context menu** | Playwright cannot drive it. The handler itself *is* covered — `menus.test.ts` invokes `handleContextMenuClick` through MSW and asserts the `move` field, including for a fetched torrent. Only the OS-level menu wiring is untested, and reaching it needs a seam in a production build. Deliberately left. | BUG-55 |
| ~~Popup `.torrent` file upload~~ | **Fixed** — `uploadTorrent` now reads the file's `info.name` and routes like every other send path. Unit-covered; no stand card, because the popup's file input is not something the stand can drive. | BUG-54 |
| **Popup quick-add** | Deliberate: `CreateUrls.svelte` has an explicit folder picker, and an explicit choice must beat a rule. Worth an assertion so nobody "fixes" it. | BUG-55 |
| **Plain HTTP download interception** | The feature does not exist — only `.torrent` downloads are intercepted. Asserted as row 12 so the limitation stays visible. | RES-5 |
| **Login-walled tracker + routing** | `hotlink-guard.spec.ts` covers the page-context fetch and the refusal, but not what folder a successfully fetched torrent lands in. | BUG-55 |
| **Unreadable bencode with a valid MIME** | Falls back to `DownloadItem.filename`; unit-covered in `torrentMeta.test.ts`, not exercised end to end. | BUG-55 |
| **Non-ASCII / `name.utf-8` release names** | Unit-covered only. | BUG-55 |
| **`ftp://`** | Rejected by `isSupportedUrl` by design. | RES-2 |
| **A magnet whose metadata resolves on the NAS** | Needs a NAS with working DHT; ours has none. This is the window where a magnet's real name first exists. | RES-6 |

The stand used to carry cards that *looked* like coverage and were not — two links to hosts that
resolve nowhere, and a set of ordinary downloads captioned as though a rule applied to them. Those
are gone or relabelled: the "Direct downloads" and "URL edge cases" tabs now open with "nothing on
this tab reaches the NAS" and each card says which rule *cannot* fire (BUG-56). Domain matching is
demonstrated for real on the Tracker tab, twice — once by hostname, once by originating page.

## What this makes visible about the rules themselves

Product truths that were previously folklore, now asserted:

0. **A condition field holds a list.** `mkv mp4 avi` and `rutracker.org nnmclub.to` are one rule
   each, OR-ed inside the field and still AND-ed with the other fields. A token with no wildcard
   is an extension, so `mkv`, `.mkv` and `*.mkv` are the same thing; `*` is how you ask for
   anything else. This is what replaced "one rule per extension", which is the shape that made
   the editor feel like a form.
1. **`type: url` is effectively context-menu-only.** A plain HTTP download is never intercepted
   (row 12), so a `url` rule can only fire on a link the user right-clicks, or on quick-add — which
   bypasses rules on purpose. Anyone writing `type: url → Folder` and expecting their browser
   downloads to be routed will be disappointed, and nothing currently tells them.
2. **A multi-file torrent routes on its directory name, not on the files inside** (row 6). A rule
   written `*.mkv` will not catch a season pack, and that is correct — the member names are not
   knowable before the NAS has the task — but it is surprising, and belongs in the editor's hints
   (UX-18).
3. **You can see whether a rule worked.** A task card carries a folder line — `Multimedia/Movies`,
   folded to the last two segments, full path and staging folder in the tooltip — **only when the
   destination differs from the configured Target** (BUG-38). Silence means "went where everything
   goes"; a line means a rule chose something else. Before this, a rule sending everything to the
   wrong place was indistinguishable from one that worked.
4. **A magnet without `dn` can be caught by a `type` rule or by the page it came from** (rows 10
   and 12) — but never by a filename pattern, because there is no name until the NAS resolves
   metadata. Whether *that* can ever be used is RES-6.

## Keeping it honest

- Add a case to the stand **and** a row to `CASES` in the matrix spec. A stand card with no
  assertion is a claim, not coverage.
- The matrix asserts the folder, not merely that something was sent. Sending to the default folder
  is the failure mode this exists to catch, and it looks like success in every other test.
- When a case genuinely cannot be exercised, add a row to the table above rather than leaving the
  stand implying it works.
