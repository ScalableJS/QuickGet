/**
 * Torrent fixtures, generated per link.
 *
 * A single shared `sample.torrent` made every `.torrent` on the stand identical inside, so
 * nothing could tell whether the extension routed on the URL or on the file's real content
 * name. Here `info.name` is derived from what was requested.
 */

/**
 * A real, parseable `.torrent` whose `info.name` is the release name we want to route on.
 *
 * **`pieces` is sized from the content, not fixed.** It used to be a single 20-byte hash for a
 * 1 MiB file with a 16 KiB piece length — 64 pieces' worth of data described by one hash. Our mock
 * NAS never looked, so every test passed; a real Download Station rejects it outright with
 * `16384`, "incorrect torrent format". The fixture was only ever valid enough to fool the fixture.
 */
export function buildTorrent(contentName: string, multiFile = false): Buffer {
  const pieceLength = 262_144;
  const files: Array<{ length: number; path: string[] }> = multiFile
    ? [
        { length: 900_000, path: ["Season 1", "episode-01.mkv"] },
        { length: 950_000, path: ["Season 1", "episode-02.mkv"] },
      ]
    : [{ length: 1_048_576, path: [] }];

  const totalBytes = files.reduce((sum, file) => sum + file.length, 0);
  const pieceCount = Math.ceil(totalBytes / pieceLength);
  // Hashes of nothing real — no data is ever transferred from these — but the *count* has to agree
  // with the declared size, which is what a validating client checks before it looks at anything.
  const pieces = Buffer.concat(Array.from({ length: pieceCount }, (_, index) => Buffer.alloc(20, index + 1)));

  const info: [string, Buffer][] = multiFile
    ? [
        [
          "files",
          blist(
            files.map((file) =>
              bdict([
                ["length", bint(file.length)],
                ["path", blist(file.path.map((segment) => bstr(segment)))],
              ]),
            ),
          ),
        ],
      ]
    : [["length", bint(files[0].length)]];

  return bdict([
    ["announce", bstr("http://127.0.0.1/announce-test")],
    ["creation date", bint(1)],
    [
      "info",
      bdict([...info, ["name", bstr(contentName)], ["piece length", bint(pieceLength)], ["pieces", bstr(pieces)]]),
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
