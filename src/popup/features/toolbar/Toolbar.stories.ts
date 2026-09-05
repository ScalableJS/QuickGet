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
  args: { hasSelection: false, settingsExpanded: false, isIdle: false, downloadSpeed: "500B/s", uploadSpeed: "45B/s" },
};

/** High speed transfer (e.g. 125MB/s, 15.2MB/s, strictly <= 3 digits). */
export const HighSpeedTransfer: Story = {
  args: { hasSelection: false, settingsExpanded: false, isIdle: false, downloadSpeed: "125MB/s", uploadSpeed: "15.2MB/s" },
};

/** Gigabit connection transfer. */
export const GigabitSpeedTransfer: Story = {
  args: { hasSelection: false, settingsExpanded: false, isIdle: false, downloadSpeed: "1.1GB/s", uploadSpeed: "100MB/s" },
};

/** Download only — upload is 0B/s. */
export const DownloadOnly: Story = {
  args: { hasSelection: false, settingsExpanded: false, isIdle: false, downloadSpeed: "12.5MB/s", uploadSpeed: "0B/s" },
};

/** Upload only — download is 0B/s. */
export const UploadOnly: Story = {
  args: { hasSelection: false, settingsExpanded: false, isIdle: false, downloadSpeed: "0B/s", uploadSpeed: "8.4MB/s" },
};

/** A download is selected → start/stop/pause/remove enabled. */
export const WithSelection: Story = { args: { hasSelection: true, settingsExpanded: false, isIdle: false } };

/** Settings panel open → settings button pressed/expanded. */
export const SettingsOpen: Story = { args: { hasSelection: false, settingsExpanded: true, isIdle: false } };
