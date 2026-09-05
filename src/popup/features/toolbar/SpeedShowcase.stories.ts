import type { Meta, StoryObj } from "@storybook/svelte-vite";

import SpeedShowcase from "./SpeedShowcase.svelte";

/**
 * Speed telemetry showcase demonstrating zero-gap icons, no borders, and <= 3 digits rule.
 */
const meta = {
  title: "Controls/SpeedTelemetry",
  component: SpeedShowcase,
} satisfies Meta<typeof SpeedShowcase>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllSpeedCases: Story = {};
