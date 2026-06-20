import type { Task } from "@lib/tasks.js";
import type { Meta, StoryObj } from "@storybook/svelte-vite";

import DownloadsListShowcase from "./DownloadsListShowcase.svelte";

const task = (name: string, status: Task["status"]): Task => ({
  id: name,
  name,
  status,
  progress: status === "finished" || status === "seeding" ? 100 : 42,
  sizeBytes: 2_400_000_000,
  downloadedBytes: 1_000_000_000,
  uploadedBytes: 0,
  downSpeedBps: status === "downloading" ? 12_000_000 : 0,
  upSpeedBps: status === "seeding" ? 800_000 : 0,
  etaSec: status === "downloading" ? 2400 : undefined,
});

const meta = {
  title: "Downloads/List",
  component: DownloadsListShowcase,
} satisfies Meta<typeof DownloadsListShowcase>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InProgress: Story = {
  args: { tasks: [task("Ubuntu 24.04 LTS image", "downloading"), task("Arch Linux", "queued"), task("Debian", "paused")] },
};

export const EmptyInProgress: Story = {
  args: { tasks: [task("Fedora ISO", "finished"), task("Ubuntu seed", "seeding")] },
};
