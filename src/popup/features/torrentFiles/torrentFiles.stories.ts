import type { TorrentFile } from "@api/client.js";
import type { Meta, StoryObj } from "@storybook/svelte-vite";

import TorrentFiles from "./TorrentFiles.svelte";

const files: TorrentFile[] = [
  { no: 0, filename: "Ubuntu 24.04 LTS/ubuntu-24.04.2-desktop-amd64.iso", size: 5_900_000_000, done: 68, priority: 1 },
  { no: 1, filename: "Ubuntu 24.04 LTS/SHA256SUMS", size: 2048, done: 100, priority: 1 },
  { no: 2, filename: "Ubuntu 24.04 LTS/SHA256SUMS.gpg", size: 833, done: 0, priority: 0 },
];

const meta = {
  title: "Downloads/Torrent files",
  component: TorrentFiles,
  args: {
    hash: "demo-multi-file-torrent",
    loadFiles: async () => files,
    saveFiles: async (_hash: string, selections: { index: number; priority: 0 | 1 }[]) =>
      selections.map(({ index }) => ({ index, ok: true })),
  },
} satisfies Meta<typeof TorrentFiles>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FileSelection: Story = {};

export const LongList: Story = {
  args: {
    loadFiles: async () =>
      Array.from({ length: 108 }, (_, index) => ({
        no: index,
        filename: `Season 01/Episode ${String(index + 1).padStart(3, "0")}.mkv`,
        size: 1_572_864_000,
        done: 0,
        priority: index < 6 ? 1 : 0,
      })),
  },
};
