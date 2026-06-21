import type { Task } from "@lib/tasks.js";
import type { Meta, StoryObj } from "@storybook/svelte-vite";

import DownloadItem from "./DownloadItem.svelte";
import DownloadItemGallery from "./DownloadItemGallery.svelte";

function task(over: Partial<Task> = {}): Task {
  return {
    id: "1",
    hash: "abc",
    name: "Ubuntu 24.04 LTS image",
    status: "downloading",
    progress: 42,
    sizeBytes: 2_400_000_000,
    downloadedBytes: 1_000_000_000,
    uploadedBytes: 620_000_000,
    downSpeedBps: 12_000_000,
    upSpeedBps: 800_000,
    etaSec: 2400,
    source: "qnap",
    ...over,
  };
}

const meta = {
  title: "Downloads/DownloadItem",
  component: DownloadItem,
  args: { onToggle: () => {}, selectedHash: null },
} satisfies Meta<typeof DownloadItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Downloading: Story = { args: { task: task() } };

export const Seeding: Story = {
  args: { task: task({ status: "seeding", progress: 100, downSpeedBps: 0, shareRatio: 0.48, etaSec: undefined }) },
};

export const ErrorState: Story = {
  args: { task: task({ status: "error", name: "Broken torrent" }) },
};

export const Selected: Story = {
  args: { task: task(), selectedHash: "abc" },
};

export const Removing: Story = {
  args: { task: task(), removing: true },
};

/** All statuses at once — visual regression surface for icons + colours. */
export const AllStatuses: StoryObj = {
  render: () => ({ Component: DownloadItemGallery }),
};
