import type { Meta, StoryObj } from "@storybook/svelte-vite";

import ToolbarShowcase from "./ToolbarShowcase.svelte";

/**
 * Toolbar control states. Task-control buttons (start/stop/pause) and remove are
 * disabled until a download is selected; the settings button reflects panel state.
 */
const meta = {
  title: "Controls/Toolbar",
  component: ToolbarShowcase,
} satisfies Meta<typeof ToolbarShowcase>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Idle transfer state — no download/upload active. */
export const Idle: Story = { args: { hasSelection: false, settingsExpanded: false, isIdle: true } };

/** Active transfer speeds — download & upload speeds visible. */
export const ActiveTransfer: Story = { args: { hasSelection: false, settingsExpanded: false, isIdle: false } };

/** Low speed bytes transfer (<= 3 digits). */
export const LowSpeedTransfer: Story = {
  args: { hasSelection: false, settingsExpanded: false, isIdle: false, downloadSpeed: "0.5 KB/s", uploadSpeed: "0.1 KB/s" },
};

/** High speed transfer (e.g. 125 MB/s, 15.2 MB/s, strictly <= 3 digits). */
export const HighSpeedTransfer: Story = {
  args: { hasSelection: false, settingsExpanded: false, isIdle: false, downloadSpeed: "125 MB/s", uploadSpeed: "15.2 MB/s" },
};

/** Gigabit connection transfer. */
export const GigabitSpeedTransfer: Story = {
  args: { hasSelection: false, settingsExpanded: false, isIdle: false, downloadSpeed: "1.1 GB/s", uploadSpeed: "100 MB/s" },
};

/** Download only — upload is 0 KB/s. */
export const DownloadOnly: Story = {
  args: { hasSelection: false, settingsExpanded: false, isIdle: false, downloadSpeed: "12.5 MB/s", uploadSpeed: "0 KB/s" },
};

/** Upload only — download is 0 KB/s. */
export const UploadOnly: Story = {
  args: { hasSelection: false, settingsExpanded: false, isIdle: false, downloadSpeed: "0 KB/s", uploadSpeed: "8.4 MB/s" },
};

/** A download is selected → start/stop/pause/remove enabled. */
export const WithSelection: Story = { args: { hasSelection: true, settingsExpanded: false, isIdle: false } };

/** Settings panel open → settings button pressed/expanded. */
export const SettingsOpen: Story = { args: { hasSelection: false, settingsExpanded: true, isIdle: false } };
