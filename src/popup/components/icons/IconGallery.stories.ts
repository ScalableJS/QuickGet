import type { Meta, StoryObj } from "@storybook/svelte-vite";

import IconGallery from "./IconGallery.svelte";

/**
 * The project icon set (lucide, bundled build-time via unplugin-icons — CSP-safe).
 * Status icons follow torrent-client convention (arrow-down = download, arrow-up = seed, alert = error);
 * colour is the second recognition cue (blue = active, green = seed/done, red = error).
 */
const meta = {
  title: "Design system/Icons",
  component: IconGallery,
} satisfies Meta<typeof IconGallery>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ProjectIcons: Story = {};
