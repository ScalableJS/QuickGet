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

/** A download is selected → start/stop/pause/remove enabled. */
export const WithSelection: Story = { args: { hasSelection: true, settingsExpanded: false, isIdle: false } };

/** Settings panel open → settings button pressed/expanded. */
export const SettingsOpen: Story = { args: { hasSelection: false, settingsExpanded: true, isIdle: false } };
