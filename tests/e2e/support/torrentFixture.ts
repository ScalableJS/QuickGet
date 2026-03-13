import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

function bencodeString(value: string): string {
  return `${Buffer.byteLength(value, "utf8")}:${value}`;
}

function createTorrentContents(displayName: string): string {
  return [
    "d",
    `${bencodeString("announce")}${bencodeString("http://127.0.0.1/announce-test")}`,
    `${bencodeString("creation date")}i1e`,
    `${bencodeString("info")}d`,
    `${bencodeString("length")}i12345e`,
    `${bencodeString("name")}${bencodeString(displayName)}`,
    `${bencodeString("piece length")}i16384e`,
    `${bencodeString("pieces")}${bencodeString("12345678901234567890")}`,
    "ee",
  ].join("");
}

export interface TorrentFixture {
  displayName: string;
  torrentFilePath: string;
  cleanup: () => Promise<void>;
}

export async function createTorrentFixture(prefix = "quickget-e2e"): Promise<TorrentFixture> {
  const displayName = `${prefix}-${Date.now()}`;
  const tempDir = await mkdtemp(path.join(tmpdir(), "sendtoqnap-torrent-"));
  const torrentFilePath = path.join(tempDir, `${displayName}.torrent`);
  await writeFile(torrentFilePath, createTorrentContents(displayName), "utf8");

  return {
    displayName,
    torrentFilePath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

