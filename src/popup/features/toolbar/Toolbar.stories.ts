import type { Meta, StoryObj } from "@storybook/svelte";

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

/** Nothing selected → task controls disabled (only Settings + Add are usable). */
export const Idle: Story = { args: { hasSelection: false, settingsExpanded: false } };

/** A download is selected → start/stop/pause/remove enabled. */
export const WithSelection: Story = { args: { hasSelection: true, settingsExpanded: false } };

/** Settings panel open → settings button pressed/expanded. */
export const SettingsOpen: Story = { args: { hasSelection: false, settingsExpanded: true } };
