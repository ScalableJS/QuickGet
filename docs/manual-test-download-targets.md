# Manual test targets for file interception (RES-5)

Public URLs for testing "click a file link, it goes to the NAS" by hand. Every redirect count and
content type below was **measured** with `curl -sIL` on 2026-09-13, not taken from a search result
or an assistant's recall — version numbers in particular go stale, so re-measure before trusting a
row that is months old:

```bash
curl -sI -o /dev/null -w "%{http_code} redirects=%{num_redirects} %{content_type}\n%{url_effective}\n" -L "<url>"
```

Pick sizes deliberately: the feature's whole claim is that size does not matter, so at least one
pass should use something the browser would visibly struggle with.

## Direct — no redirect

The baseline. If these do not work, nothing else will.

| URL | Size | Measured |
| --- | --- | --- |
| `https://releases.ubuntu.com/24.04/ubuntu-24.04.4-desktop-amd64.iso` | ~6 GB | 200, 0 redirects, `application/x-iso9660-image` |
| `https://download.blender.org/release/Blender4.5/blender-4.5.13-windows-x64.zip` | ~400 MB | 200, 0 redirects, `application/zip` |
| `https://mirror.math.princeton.edu/pub/archlinux/iso/latest/archlinux-x86_64.iso` | ~1.5 GB | 200, 0 redirects, `application/octet-stream` |
| `http://speedtest.tele2.net/1GB.zip` | exactly 1 GB | 200, 0 redirects, `application/zip` |

The Arch mirror is worth a pass of its own: the server types it `application/octet-stream`, so it
is the case where only the URL's `.iso` says what it is.

## Redirecting — the GAP-15 cases

A plain redirect to a mirror. The NAS is handed the *original* URL today, so these are where the
unresolved-redirect problem shows up first.

| URL | Redirects to | Measured |
| --- | --- | --- |
| `https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-13.7.0-amd64-netinst.iso` | `saimei.ftp.acc.umu.se` | 200, 1 redirect, `application/x-iso9660-image` |
| `https://download.fedoraproject.org/pub/fedora/linux/releases/44/Workstation/x86_64/iso/Fedora-Workstation-Live-44-1.7.x86_64.iso` | MirrorManager picks a mirror | 200, 1 redirect, `application/x-iso9660-image` |
| `https://github.com/blender/blender/archive/refs/tags/v4.5.13.zip` | `codeload.github.com` | 200, 1 redirect, `application/zip` |

The Blender source zip is small — use it to exercise the redirect mechanism without waiting on
gigabytes.

## Redirecting to an **expiring signed** URL

The harder half of the same problem: even resolving the redirect is not enough, because the
resolved URL dies. If Download Station queues the task behind others, the link can expire before
the transfer starts.

| URL | Redirects to | Expiry evidence |
| --- | --- | --- |
| `https://github.com/git-for-windows/git/releases/download/<tag>/<asset>` | `release-assets.githubusercontent.com` | `se=2026-09-13T16:38:53Z` in the query, plus a JWT with `exp` — about a 60-minute window |
| `https://sourceforge.net/projects/sevenzip/files/7-Zip/24.09/7z2409-x64.exe/download` | a SourceForge mirror | 2 redirects, `?e=1789401024&st=…` — `e` is a unix expiry |

Get a current GitHub asset URL rather than guessing the filename:

```bash
curl -s https://api.github.com/repos/git-for-windows/git/releases/latest | grep browser_download_url
```

## Negative — must **not** be sent to the NAS

| URL | Why it is the trap |
| --- | --- |
| `https://ubuntu.com/download/desktop/thank-you?version=24.04.4&architecture=amd64` | Reads like a download link, measured as 200 `text/html` — a page |

Worth adding by hand while testing: a link whose query string ends in a file extension
(`/page.html?next=file.zip`), which must stay a page, against one whose *path* carries the
extension and a token in the query (`/movie.mkv?token=abc`), which must be sent.

## Etiquette

These are volunteer-funded mirrors. Test against them a handful of times, not in a loop, and use
the local test stand (`tests/e2e/fixtures/test-stand/`) for anything repeated.
