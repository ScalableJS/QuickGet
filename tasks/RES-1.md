---
type: "task"
id: "RES-1"
status: "todo"
priority: "p2"
area: "api/research"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "S"
---

# Verify on a live NAS how `AddUrl` handles a magnet URI

**Size:** S · **Area:** api/research
**Files:** none yet — this card produces findings, not code
**Blocks:** GAP-1 (the hand-off path it will use)

Magnet reaches Download Station through a **different and much simpler path** than a
`.torrent`, and confirming its exact behaviour is worth doing before GAP-1 is implemented.

**Why the path differs.** A `.torrent` is a file Chrome has already begun downloading, which
is why `handleDownloadCreated` has to be transactional — pause, hand off, cancel only on
success, resume on failure. A magnet is a *string*. There is no `DownloadItem`, nothing to
pause, nothing to cancel, and nothing to lose if the send fails. So GAP-1 shares only the
task-submission code with torrent interception, and none of the download-lifecycle races.

**What is already true (verified, do not re-check):**

- `menus.ts:103` already accepts `magnet:` and routes it through `AddUrl`, so sending a magnet
  from the context menu works today. GAP-1 is about capturing the *click*, not about teaching
  the extension what a magnet is.
- `AddUrl` requires **both** `temp` and `move` (`client.ts:127-139`); omitting either is
  rejected. Verified against a live QTS 5 NAS after it broke once.

**Questions this card answers — on real hardware, not from documentation:**

- [ ] Does `AddUrl` accept a magnet URI with the same `temp`/`move` contract as an HTTP URL,
      or does it want something different?
- [ ] What does the task look like in `Task/Query` immediately after submission, before
      metadata resolves? A magnet has no name until the swarm supplies one — does the popup
      render a blank row, and for how long?
- [ ] Does a **v2 / hybrid** magnet (`xt=urn:btmh:`) get accepted or rejected? QNAP documents
      "BitTorrent / Magnet / DHT" but does not state a libtorrent version or BEP-52 support,
      so this is unknown and only measurable.
- [ ] What happens to a magnet whose swarm never resolves — does the task sit forever, and is
      that distinguishable from a genuine failure in what we display?

**Design consequence to record either way:** validate the **scheme only** (`magnet:`), never
the `xt` prefix. Hard-coding `urn:btih:` would reject v2 magnets that the NAS may well accept
— and whether it accepts them is the NAS's business, not ours. We forward a string; we are not
a BitTorrent client and should not act as a gatekeeper for one.

**Method.** Same as the earlier `AddUrl` verification: submit against the real NAS, read back
`Task/Query`, record the raw payloads in `docs/` next to the existing API findings. No
guessing from vendor documentation — it is what got `temp`/`move` wrong the first time.
