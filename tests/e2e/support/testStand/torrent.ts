/**
 * Torrent fixtures, generated per link.
 *
 * A single shared `sample.torrent` made every `.torrent` on the stand identical inside, so
 * nothing could tell whether the extension routed on the URL or on the file's real content
 * name. Here `info.name` is derived from what was requested.
 */

/** A real, parseable `.torrent` whose `info.name` is the release name we want to route on. */
export function buildTorrent(contentName: string, multiFile = false): Buffer {
  const info: [string, Buffer][] = multiFile
    ? [
        [
          "files",
          blist([
            bdict([
              ["length", bint(900_000)],
              ["path", blist([bstr("Season 1"), bstr("episode-01.mkv")])],
            ]),
            bdict([
              ["length", bint(950_000)],
              ["path", blist([bstr("Season 1"), bstr("episode-02.mkv")])],
            ]),
          ]),
        ],
      ]
    : [["length", bint(1_048_576)]];

  return bdict([
    ["announce", bstr("http://127.0.0.1/announce-test")],
    ["creation date", bint(1)],
    [
      "info",
      bdict([
        ...info,
        ["name", bstr(contentName)],
        ["piece length", bint(16_384)],
        ["pieces", bstr(Buffer.alloc(20, 0xab))],
      ]),
    ],
  ]);
}

function bstr(value: string | Buffer): Buffer {
  const raw = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from(`${raw.length}:`), raw]);
}

function bint(value: number): Buffer {
  return Buffer.from(`i${value}e`);
}

function blist(items: Buffer[]): Buffer {
  return Buffer.concat([Buffer.from("l"), ...items, Buffer.from("e")]);
}

function bdict(entries: [string, Buffer][]): Buffer {
  return Buffer.concat([Buffer.from("d"), ...entries.flatMap(([key, value]) => [bstr(key), value]), Buffer.from("e")]);
}
