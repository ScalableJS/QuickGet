# Competitor teardown — folder routing and destination handling

Focused follow-up to [competitor-analysis.md](./competitor-analysis.md), written because our own
routing rules turned out to match against the wrong string, and "does anyone solve this properly?"
needed a code answer rather than a store description.

Sources were unpacked from AMO and read directly (none are minified). The `.xpi` files are not
kept in the repo — the provenance table below re-fetches them.

**The short answer: nobody solves it.** Only *Send To QNAP++* has routing at all, and it matches
on the URL's last path segment, exactly as we did. It also contains a working bencode parser that
extracts the real content name — and never hands it to the matcher. Routing on the true name is
an unclaimed differentiator, and their own code proves it is cheap.

## Provenance (reproducible)

| Add-on | Slug / AMO listing | Version | XPI URL | Unpacked to |
|---|---|---|---|---|
| **Send To QNAP++** | [`sendtoqnapplus`](https://addons.mozilla.org/en-US/firefox/addon/sendtoqnapplus/) | **2.95.13** (MV2) | `https://addons.mozilla.org/firefox/downloads/file/5013529/sendtoqnapplus-2.95.13.xpi` | `competitors/plus/` |
| **SendToQnap** (Wolff / garoloup) | [`sendtoqnap`](https://addons.mozilla.org/en-US/firefox/addon/sendtoqnap/) | **2.7** (MV2) | `https://addons.mozilla.org/firefox/downloads/file/4249659/sendtoqnap-2.7.xpi` | `competitors/wolff/` |
| **Download Station (Synology)** (Kaakati) | [`download-station-synology`](https://addons.mozilla.org/en-US/firefox/addon/download-station-synology/) | **1.0.0** (MV3) | `https://addons.mozilla.org/firefox/downloads/file/4700706/download_station_synology-1.0.0.xpi` | `competitors/synology/` |

Re-fetch recipe: `curl -s "https://addons.mozilla.org/api/v5/addons/addon/<slug>/" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['current_version']['version'], d['current_version']['file']['url'])"`

**Note vs. the June 2026 analysis:** `++` has moved **2.30.15 → 2.95.13** and grown from ~6.7k to
**~10.5k lines**. The routing engine described below is the current one. Wolff is unchanged at 2.7.

**Headline:** only **Send To QNAP++** has folder routing at all. Wolff has none (single global
`temp`/`move`). Synology has none (single global `defaultDestination`). Everything in A–E below is
therefore about `++` unless stated otherwise.

---

## A. Rule shape

A rule is a flat 4-field object. Created in `__frAddRule` — `plus/popup/Configure_QNAP_Access.js:1229`:

```js
__frWorkingRules.push({ id: __frMakeId(), type, value, folder });
```

| Field | Values | Notes |
|---|---|---|
| `id` | `"fr_" + random36 + "_" + Date.now()` (`:1116-1118`) | only used as a DOM `data-id`; the engine never reads it |
| `type` | `"magnet"` \| `"ext"` \| `"domain"` | exactly three, from the `<select>` at `Configure_QNAP_Access.html:600-604` |
| `value` | string; normalised at add-time; forced to `""` for `magnet` | see C |
| `folder` | string, NAS path, no leading `/` | empty ⇒ falls through to global `NASdir` |

**Priority = array index.** There is no `priority`/`order` field; order *is* the array order, mutated
by swap (`__frMoveRule`, `:1183-1190`).

**There is no per-rule enable/disable flag.** No `enabled`, no `muted` — grep for it returns nothing.
The only toggle is the global `folderRoutingEnabled` boolean. To silence one rule you must delete it.

**Storage:** `chrome.storage.local`, two flat top-level keys — `folderRules` (array) and
`folderRoutingEnabled` (bool). Written in `__frDone` (`:1245-1248`):

```js
await storageSet({
  folderRules: __frWorkingRules,
  folderRoutingEnabled: !!(inpFolderRoutingEnabled && inpFolderRoutingEnabled.checked)
});
```

Read back into background globals in `loadDownloadHijackerSettings` (`plus/SendLink.js:890-891`),
with a `storage.onChanged` invalidation at `SendLink.js:919`:

```js
folderRoutingEnabled = (result.folderRoutingEnabled === true);
folderRules = Array.isArray(result.folderRules) ? result.folderRules : [];
```

Both keys are in the backup/restore allowlist (`plus/options/backup_restore.js:40`), but note the
import **does not sanitise rule objects** — `KNOWN_KEYS` gates key names only, so an imported
`folderRules` array is trusted wholesale.

**Things we have that they do not:** a per-rule enable flag (neither has it — we don't either), and
our `namePattern` + `domain` + `type` **AND-combination** in one rule. Theirs is one condition per
rule (see C).

---

## B. What string the matcher compares against — **the crux**

**Answer: the raw request URL, and nothing else. All three link kinds are matched on the URL.**
`applyFolderRules(url)` — `plus/SendLink.js:798-812`:

```js
function applyFolderRules(url) {
  if (!folderRoutingEnabled || !Array.isArray(folderRules) || !folderRules.length) return null;
  const lower = (url || "").toLowerCase().trim();
  const isMagnet  = lower.startsWith("magnet:");
  const isTorrent = lower.endsWith(".torrent");

  let ext = "", hostname = "";
  try {
    const u = new URL(url);
    hostname = (u.hostname || "").toLowerCase().replace(/\.$/, "");
    const seg = (u.pathname || "").split("/").pop() || "";
    const dot = seg.lastIndexOf(".");
    if (dot >= 0) ext = seg.slice(dot).toLowerCase();
  } catch {}
```

and the `ext` branch re-derives the same thing (`:824-825`):

```js
let filename = "";
try { filename = new URL(url).pathname.split("/").pop().toLowerCase(); } catch {}
```

So, per link kind:

| Link kind | What the matcher sees | Verdict |
|---|---|---|
| **(i) `.torrent` link** | **the URL's last path segment.** For `https://tracker/dl.php?id=99887` that is `"dl.php"` — verified: `new URL(...).pathname.split("/").pop()` ⇒ `"dl.php"`. | **No better than ours.** Meaningless on any opaque tracker endpoint. |
| **(ii) `magnet:`** | **nothing usable.** `new URL("magnet:?xt=...&dn=...")` yields `hostname === ""` and `pathname === ""` (verified in node), so `ext === ""`, `filename === ""`, `hostname === ""`. Only the boolean `isMagnet` is usable. | **No `dn` read.** Only a blanket "any magnet" rule can match. |
| **(iii) plain HTTP** | last path segment + hostname. | Same as ours. |

### They do NOT read the magnet `dn` for routing

`dn` *is* parsed — but only to title a notification, in the `hijack_magnet` handler
(`plus/SendLink.js:735-745`), and the result never reaches `applyFolderRules`:

```js
let displayName = "Magnet Link";
const dnMatch = msg.url.match(/[?&]dn=([^&]+)/i);
...
const niceName = __notifyFormatFilename(displayName, 32);
SendWithQueue(msg.url, { pageUrl: msg.pageUrl });   // <- raw msg.url, dn discarded
```

### They DO parse the .torrent (bencode) — and then throw the name away for routing

This is the most instructive finding. `getTorrentInfoHashAndName(arrayBuffer)`
(`plus/SendLink.js:453-521`) is a real hand-rolled bencode walker that extracts the info-dict
SHA-1 **and the true `name` field**:

```js
if (key === "info") {
    let infoStart = offset;
    parse();
    let infoBytes = view.slice(infoStart, offset);
    const hashBuffer = await crypto.subtle.digest("SHA-1", infoBytes);
    result.hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,"0")).join("").toUpperCase();

    let nameBytes = [0x34, 0x3A, 0x6E, 0x61, 0x6D, 0x65];   // "4:name"
    ...
    result.name = new TextDecoder().decode(infoBytes.slice(vStart, vStart + vLen));
```

It is invoked in `sendURL` (`plus/SendLink.js:571-576`) — the extension **fetches the .torrent
itself** before handing the URL to the NAS:

```js
const resp = await fetch(url, { credentials: 'omit' });
if (resp.ok) {
    if (resp.url && resp.url !== url && /^https?:/i.test(resp.url)) {
        url = resp.url;               // follow redirects the NAS won't
    }
    const buffer = await resp.arrayBuffer();
    const { hash, name } = await getTorrentInfoHashAndName(buffer);
    if (hash) obj["TORRENT_MAP_" + hash] = { url: url, ts: now };
    if (name) obj["TORRENT_MAP_NAME_" + name] = { url: url, ts: now };
}
```

The real content name is written to `storage.local` as `TORRENT_MAP_NAME_<name>` **purely to map a
NAS task back to its source URL later** (consumed in `plus/common.js:1631-1666`, matched against the
task's `source_name`). `sendURL` then calls `__sendURL_internal`, which calls `applyFolderRules(url)`
with the **URL**. The parsed name is available, in the same call stack, one function up — and is not
passed down.

**Conclusion for us:** nobody solves the torrent-naming problem. `++` accidentally has 90% of the
machinery (they already fetch and bencode-parse the file) and never wired it to routing. Routing on
the bencode `name` / magnet `dn` is an unclaimed differentiator, and `++`'s own code is proof it is
cheap to obtain.

### Not found

- **No use of `DownloadItem.filename`** for routing. The hijacker passes only `msg.url`.
- **No `Content-Disposition` read** anywhere — grep for `content-disposition` in `plus/` returns
  nothing (they read `content-range` only, for the size preflight).

---

## C. Matcher semantics

`plus/SendLink.js:813-845`, the full loop:

```js
  for (const rule of folderRules) {
    if (!rule || !rule.type) continue;
    let matched = false;

    if (rule.type === "magnet") {
      matched = (isMagnet || isTorrent);
    } else if (rule.type === "ext") {
      const ruleValue = (rule.value || "").toLowerCase().trim();
      if (!ruleValue) { matched = true; break; }
      const patterns = ruleValue.split(/[\s,]+/).filter(Boolean);
      let filename = "";
      try { filename = new URL(url).pathname.split("/").pop().toLowerCase(); } catch {}
      matched = patterns.some(pat => {
        if (!pat.includes("*")) {
          return pat.startsWith(".") ? ext === pat : (filename.endsWith(pat) || ext === pat);
        }
        const re = new RegExp("^" + pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
        return re.test(filename);
      });
    } else if (rule.type === "domain") {
      const ruleDomain = (rule.value || "").toLowerCase().trim().replace(/^\./, "");
      if (!ruleDomain) { matched = true; break; }
      if (!hostname) break;
      if (ruleDomain.startsWith("*.")) {
        matched = hostname.endsWith("." + ruleDomain.slice(2));
      } else {
        matched = hostname === ruleDomain || hostname.endsWith("." + ruleDomain);
      }
    }

    if (matched) return { folder: (rule.folder || "").trim() };
  }
  return null;
```

- **Glob, not regex.** `*` is the only wildcard; every other regex metachar is escaped
  (`pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")`). Anchored `^...$` against the
  filename. **No user-supplied regex ⇒ no ReDoS surface** (same posture we settled on in BUG-41..45).
- **Substring only via explicit globs** — `*sample*`. A bare token is suffix/extension matching:
  `filename.endsWith(pat) || ext === pat`.
- **OR *within* a rule, never AND.** One rule carries exactly one condition kind. Multiple patterns
  inside an `ext` rule are OR-ed (`patterns.some(...)`, space/comma separated). There is **no way to
  express "domain X AND pattern Y"** — a capability our `{type, namePattern, domain}` AND-shape has
  and theirs does not.
- **First match wins**, top-to-bottom, `return` on first hit. Documented to the user in
  `Configure_QNAP_Access.html:589`: `Rules evaluate top-to-bottom. The first match overrides the "Move-to folder".`
- **Case-insensitive** throughout — `url.toLowerCase()`, `ruleValue.toLowerCase()`,
  `hostname.toLowerCase()`, `filename...toLowerCase()`, and the built regex tests an already-lowered
  filename.
- **Nothing matches ⇒ `return null`** ⇒ caller keeps the global default (`SendLink.js:661-665`):
  ```js
  let effectiveDir = NASdir;
  const frMatch = applyFolderRules(url);
  if (frMatch && typeof frMatch.folder === "string" && frMatch.folder) {
    effectiveDir = frMatch.folder;
  }
  ```
  Note the double fallback: a matched rule with an **empty** `folder` also falls back to `NASdir`,
  because the `&& frMatch.folder` truthiness check rejects `""`. So an empty-destination rule acts as
  a deliberate "stop here, use the default" — but this is emergent, not designed.
- **`magnet` type is misnamed:** it matches `isMagnet || isTorrent`, i.e. magnets *and* `.torrent`
  URLs. The UI label is `"Magnet / Torrent"` (`Configure_QNAP_Access.html:601`), so it's honest.

### Three control-flow bugs worth not copying

The `break`s in this loop are wrong — `break` exits the `for`, skipping the
`if (matched) return {...}` below it, so the function falls through to `return null`:

1. `if (!ruleValue) { matched = true; break; }` — an `ext` rule with an empty value sets
   `matched = true` and then **discards the match**. Should be `continue` or a direct return.
2. `if (!ruleDomain) { matched = true; break; }` — same for `domain`.
3. **`if (!hostname) break;` is the damaging one.** A `magnet:` link has `hostname === ""` (verified).
   So the *first* `domain` rule in the list **aborts evaluation of the entire rule list** for every
   magnet. With rules ordered `[domain: example.com → A]`, `[magnet → B]`, magnets never reach rule 2
   and silently land in the global default. Should be `continue`.

The add-time normaliser partly hides #1/#2 (empty values are rejected for `ext`, see `:1204-1207`),
but an imported or hand-edited `folderRules` array reaches the engine unvalidated.

---

## D. Editor UX

A dedicated modal, `#FolderRoutingModal` (`plus/popup/Configure_QNAP_Access.html:570-655`), opened
from a settings row. Rendered imperatively by `__frRenderList` (`Configure_QNAP_Access.js:1124-1181`).

**Layout — a list of committed rules above, one "add" form below.** Rules are *not* editable in
place: to change a rule you delete it and re-add it. No edit button exists.

| Affordance | Present? | Evidence |
|---|---|---|
| **Visible field labels** | **Yes** | `<label class="fr-field-label" id="FrValueLabel">Match / Pattern` and `NAS folder <span class="fr-field-hint">(no leading /)</span>` (`html:610-624`) |
| **Per-field help popovers** | **Yes** — a `?` button per field with a multi-line `data-help` carrying worked examples (`` `.mkv .mp4` — multiple types, space-separated ``, `` `*2024*.mkv` `` …) (`html:612, 623`) | the single best UX idea here |
| **Priority reorder** | **Yes** — ▲/▼ buttons per row, disabled at the ends | `upBtn.disabled = (idx === 0)`, `dnBtn.disabled = (idx === rules.length - 1)` (`js:1165-1169`); swap in `__frMoveRule` (`js:1183-1190`). No drag-and-drop. |
| **Delete** | Yes, `×` per row (`js:1176`) | |
| **Mute / disable one rule** | **No** — not found | no `enabled` field anywhere; only the global `folderRoutingEnabled` |
| **Test/preview a rule against a link** | **No** — not found | there is no dry-run input anywhere in the modal or the JS |
| **Destination folder validation** | **Yes, live, against the NAS** | see below |
| **Rule count** | Yes, `aria-live="polite"` — `"3 rules"` / `"1 rule"` (`js:1120-1122, 1129`) | |
| **Default-folder preview on empty destination** | **Yes** — a rule with no folder renders the global `NASdir` greyed at 0.6 opacity with `title="Uses default: …"` (`js:1150-1157`) | nice touch: the fallback is *shown*, not implied |
| **Ghosting when disabled** | Yes — `__setConfigGhosted("FrConfigArea", on)` dims the whole config area while the master toggle is off (`js:1066-1078`) | |
| **Cancel / Done** | Yes — edits work on a deep clone (`JSON.parse(JSON.stringify(stored))`, `js:1091`) so Cancel truly discards | |

### Destination validation (`__frVerifyFolder`, `js:1033-1064`)

A folder-icon button beside the destination input; click ⇒ live check ⇒ the button turns
`fv-ok`/`fv-fail` with a `✓`/`✗` badge and an `aria-live` status line (`"Folder found ✓"` /
`"Folder not found."` / `"Could not check (NAS unreachable or not logged in)."`).

Nice detail — **`__frNudgeVerify`** (`js:1025-1031`) adds a `fv-nudge` class when a folder has been
typed but not yet verified, i.e. the UI *pesters* you to validate before adding:

```js
const resolved = elFrVerifyBtn.classList.contains("fv-ok") || elFrVerifyBtn.classList.contains("fv-fail") || elFrVerifyBtn.classList.contains("fv-busy");
if (folder && !resolved) elFrVerifyBtn.classList.add("fv-nudge");
```

It resolves through **File Station `func=stat`**, not Download Station (`plus/common.js:701-742`):

```js
const url = `${NASprotocol}://${NASaddr}:${NASport}/cgi-bin/filemanager/utilRequest.cgi?func=stat&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(parent)}&file_total=1&file_name=${encodeURIComponent(name)}`;
...
const item = js && js.datas && js.datas[0];
if (!item || Number(item.exist) !== 1) return { ok: false, msg: `Folder not found: ${fullPath}` };
if (Number(item.isfolder) !== 1)       return { ok: false, msg: `Not a folder: ${fullPath}` };
```

It requires a **separate File Station login** (`fileStationLogin()`) and distinguishes `isfolder` —
i.e. it catches "that path is a *file*", which a `Misc/Dir` listing would too. **Verification is
manual and advisory: nothing blocks adding or saving an unverified or failed rule.** `__frAddRule`
only ever sets `fr-err` on an empty `ext` value; `hasErr` is never set from the verify state.

**Validation is per-field, not per-rule-list** — the committed rows have no validity indicator at
all, so a rule whose folder was deleted on the NAS later shows as normal.

---

## E. Post-add destination

**No competitor changes a task's destination after the task exists. Confirmed by endpoint census.**

Every NAS endpoint `++` touches, exhaustively (`grep -rhoE "downloadstation/V4/[A-Za-z]+/[A-Za-z]+"`):

```
downloadstation/V4/Addon/Query    downloadstation/V4/Task/Pause
downloadstation/V4/Addon/Search   downloadstation/V4/Task/Query
downloadstation/V4/Misc/Login     downloadstation/V4/Task/Remove
downloadstation/V4/Task/AddTorrent downloadstation/V4/Task/Resume
downloadstation/V4/Task/AddUrl     downloadstation/V4/Task/Start
                                   downloadstation/V4/Task/Stop
```

There is **no `Task/Set…` / edit / relocate call**. And every File Station function they use
(`grep -rhoE "func=[a-z_]+"`) is exactly one:

```
func=stat
```

— i.e. File Station is used **only** to check a folder exists, never `func=move` or `func=copy`.
**This corroborates our belief:** QNAP Download Station exposes no destination-change call, and even
the one competitor with File Station credentials in hand does not use it to move completed files.
Routing is therefore necessarily a *pre-add* decision. Synology likewise: `apiDeleteTasks` and
`create` only, no `SYNO.DownloadStation.Task` `edit` (`synology/background.js:200-225`).

### Temp folder is global-only, per-rule destination only

`__sendURL_internal` (`plus/SendLink.js:660-684`) — `effectiveTempdir` is initialised from the global
and **never reassigned**; only `effectiveDir` is routed:

```js
let effectiveTempdir = NAStempdir;
let effectiveDir = NASdir;
const frMatch = applyFolderRules(url);
if (frMatch && typeof frMatch.folder === "string" && frMatch.folder) {
  effectiveDir = frMatch.folder;
}
...
const data =
  "sid=" + encodeURIComponent(sid) +
  "&temp=" + encodeURIComponent(effectiveTempdir) +
  "&move=" + encodeURIComponent(effectiveDir) +
  "&url=" + encodeURIComponent(url);
```

A rule sets `move` only. There is no per-rule temp. (Same shape as ours.)

### Routing coverage is incomplete in `++` — one call site only

`applyFolderRules` is called from **exactly one place**, `__sendURL_internal`. Consequences:

- The **`.torrent` file upload UI does not route at all.** `plus/upload/upload.js:141-147` hardcodes
  the globals:
  ```js
  formData.append("temp", bgPage.NAStempdir || "Download");
  formData.append("move", bgPage.NASdir || "Download");
  ```
  So a user with a "magnet/torrent → Movies" rule who drags a `.torrent` into the upload page gets
  the default folder, silently. **We route the interception/auto-send path — they don't.**

- Everything that funnels through `SendWithQueue` → `sendURL` (context menu, quick-add, hijacker,
  magnet hijack, retry queue) *does* route, because they all converge on that one function. That
  convergence is the good part of the design: **one choke point, impossible to forget** — except for
  the `AddTorrent` path, which bypasses it entirely and proves the point.

### One ordering bug in the choke point

Routing runs **after** the auth-helper cookie/referer injection has rewritten `url`
(`SendLink.js:627-651` sets `__cookie` / `__referer` search params, then `:663` matches on the
rewritten URL). Harmless today — injection only adds query params, and the matcher reads `hostname`
and `pathname` — but it's a latent trap: any future rewrite touching the path silently changes
routing. Match on the original URL, before rewriting.

---

## F. Ideas worth taking / not taking

**Worth taking:**

1. **Per-field `?` help popovers with worked examples.** The single highest-value UX item here.
   Their `data-help` for the pattern field lists five concrete patterns with plain-English glosses
   (`Configure_QNAP_Access.html:612`). Rule syntax is exactly the thing users get wrong; a tooltip
   beats a doc page.
2. **Render the fallback destination inline on rules that have none** — greyed default folder text
   with `title="Uses default: …"` (`js:1150-1157`). Makes "no destination" self-explaining instead of
   looking like a broken rule.
3. **The "unverified" nudge** (`__frNudgeVerify`, `js:1025-1031`) — highlight the validate control
   once a folder is typed but not yet checked. Cheap, and it converts an optional check into a
   near-default one. (Our F1 red-ring is stronger; the nudge is complementary — it prompts *before*
   an error rather than reporting one.)
4. **`isfolder` discrimination in validation** (`common.js:738`) — distinguish "not found" from
   "exists but is a file". Our `Misc/Dir` check should report the second case distinctly.
5. **Deep-clone-on-open + real Cancel** (`js:1091`) — the editor mutates a clone, so Cancel is
   genuinely lossless. Worth confirming our Settings rules editor does the same.
6. **Live rule count with `aria-live`** (`js:1120-1129`) — trivial, good a11y.
7. **They already prove the bencode route is cheap.** `getTorrentInfoHashAndName`
   (`SendLink.js:453-521`) is ~65 lines of dependency-free bencode walking that yields the true
   content name; they fetch the `.torrent` anyway. Matching on the real name (bencode `name`, magnet
   `dn`) instead of the URL's last path segment is the differentiator none of the three have taken —
   and it directly fixes the "`dl.php` is meaningless" problem in our engine.
8. **Redirect resolution before handing the URL to the NAS** (`SendLink.js:566-570`) — an
   unrelated but genuinely good idea we should check we do: `fetch` follows 3xx, `resp.url` is the
   final URL, and QNAP's own fetcher won't follow some of them (their comment cites
   `itorrents.org → itorrents.net`). Sending the pre-redirect URL yields a silently dead task.
9. **Their *other* matcher is better than their routing matcher.** The file-type-icon rules
   (`plus/popup/ListDownload.js:554-573`) support pipe alternation plus a `matchType: "word"` mode:
   ```js
   const parts = alts.map(a => {
     const escaped = escEach(a);
     return matchType === "word" ? "\\b" + escaped + "\\b" : escaped;
   });
   return new RegExp(parts.join("|"), "i");
   ```
   A **word-boundary vs. anywhere** toggle is a nice, safe middle ground between glob and raw regex —
   `2024` as a word won't match `12024`. Note this matcher runs against `tr.dataset.filename`, which
   comes from the NAS task's `source_name` (`ListDownload.js:2244, 2289`) — i.e. **the real content
   name, available only post-add**. They have the good name and the good matcher on one side of the
   add, and the bad name and the weak matcher on the other, and never joined them.

**Explicitly not worth copying:**

- `break` instead of `continue` in the rule loop — three real bugs, one of which (`if (!hostname) break;`)
  makes any `domain` rule silently shadow every rule below it for magnet links.
- Matching after URL rewriting.
- No per-rule edit (delete-and-retype only).
- Unsanitised `folderRules` on settings import.
- Routing bypassed entirely on the `AddTorrent` file-upload path.
- Advisory-only folder validation that never blocks a save.

**Not found in any competitor (so: no prior art to borrow, and an open field for us):**

- routing on the torrent's real content name or magnet `dn`;
- routing on `DownloadItem.filename` / `Content-Disposition`;
- AND-combined conditions in a single rule;
- per-rule enable/mute;
- test/preview a rule against a sample link;
- per-rule temp folder;
- any post-add destination change on either NAS vendor.

---

## Addendum, 2026-09-09 — nobody shows the destination on a task card

Checked while designing BUG-38, because "where did this go" is the only feedback a routing rule
ever gives and it seemed too obvious to be missing.

- **Send To QNAP++** has the data and never renders it. `task.move_dir || task.move` appears only
  inside `__buildAbsoluteDownloadPath` and `__buildLocalOpenUri`
  (`plus/popup/ListDownload.js:825`, `:3528`), which back a click-to-copy on the task title and an
  `openfolder:\\NAS\…` custom-protocol link — the latter useless without a helper installed on
  the user's machine. The visible meta row is built at `:2494` and is `ETA • ↓ down • ↑ up • size`.
  The only place a folder reaches the user as text is error code 6, "Destination folder not found"
  (`:2855`).
- **Download Station (Synology)** sends `destination` as a request field (`synology/background.js:213`)
  and never reads it back.
- **SendToQnap (Wolff)** has one global `move` and no per-task display.

Note also `move_dir`, which `++` prefers over `move`. It is not in our typed V4 surface; either it
is a field we have not seen or defensive coding against a firmware that emits it. Worth a look if
a real NAS ever reports an empty `move`.

So this is an unclaimed differentiator, and a cheap one: the field is already in every
`Task/Query` response.

## Addendum, 2026-09-09 — how they handle card density

Checked when our own task card grew a fourth row and started to feel crowded.

**Send To QNAP++ uses an explicit, persisted density toggle, not hover.** `__applyCompactMode`
(`plus/popup/ListDownload.js:1286`) toggles a body class saved under `__COMPACT_MODE_KEY`; the CSS
then removes the entire meta row:

```css
body.dnl-compact-mode .dnl-meta,
body.dnl-compact-mode .dnl-state-indicator { display: none !important; }
```

and reveals a 28px circular progress ring in place of the linear bar
(`Configure_QNAP_Access.css:4511`, `:4526`). Compact is one line per task: ring plus name.

**Their dense row is visibly straining.** `__checkMetaOverflow` (`:1083`) measures the row and
scales its font down to as low as **9px** when it overflows, rather than reflowing:

```js
if (meta.scrollWidth > meta.offsetWidth) {
  const scale = meta.offsetWidth / meta.scrollWidth;
  meta.style.fontSize = Math.max(9, base * scale).toFixed(2) + "px";
}
```

Worth knowing before putting anything else in a single meta row — we hit the same wall and moved
the folder to its own line instead.

**Hover reveals exactly one thing:** a delayed two-line tooltip on the task title, carrying the
full name and what a click will do (`__attachTitleTooltip`, `:1060`). Nothing else is
hover-revealed.

**Neither the Synology client nor Wolff has any density control or hover disclosure.**

Our answer was neither: show the destination only when it differs from the Target folder, so the
common card keeps its old shape and the extra line carries actual news. A density toggle remains
a reasonable future card if the popup keeps growing.
