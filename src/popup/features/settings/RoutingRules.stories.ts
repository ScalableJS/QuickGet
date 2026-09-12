import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, userEvent, within } from "storybook/test";

import SettingsShowcase from "./SettingsShowcase.svelte";

const meta = {
  title: "Features/Settings/Routing Rules",
  component: SettingsShowcase,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof SettingsShowcase>;

export default meta;

type Story = StoryObj<typeof meta>;

const BASE_SETTINGS = {
  NASsecure: false,
  NASaddress: "192.168.1.100",
  NASport: "8080",
  NASlogin: "admin",
  NASpassword: "hunter2",
  NAStempdir: "Download",
  NASdir: "Multimedia/Movies",
  interceptTorrentLinks: true,
  theme: "auto",
};

/** Empty state: no routing rules configured. "Add rule" button is ready. */
export const EmptyState: Story = {
  args: {
    storage: {
      ...BASE_SETTINGS,
      routingRules: [],
    },
    initialTab: "advanced",
  },
};

/** Single complete rule: Move Up and Move Down are both disabled. */
export const SingleRule: Story = {
  args: {
    storage: {
      ...BASE_SETTINGS,
      routingRules: [
        {
          type: "torrent",
          namePattern: "*.mkv",
          destination: "Multimedia/Movies",
        },
      ],
    },
    initialTab: "advanced",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const upButton = canvas.getByRole("button", { name: "Move rule 1 up" });
    const downButton = canvas.getByRole("button", { name: "Move rule 1 down" });
    await expect(upButton).toBeDisabled();
    await expect(downButton).toBeDisabled();
  },
};

/** Multiple prioritized rules: boundary items have directional controls disabled, middle item has both enabled. */
export const MultiplePrioritizedRules: Story = {
  args: {
    storage: {
      ...BASE_SETTINGS,
      routingRules: [
        {
          type: "torrent",
          namePattern: "*.iso",
          destination: "Software/Linux",
        },
        {
          domain: "tracker.example.com",
          namePattern: "*S01*",
          destination: "TV/Shows",
        },
        {
          type: "magnet",
          destination: "Downloads/Magnets",
        },
      ],
    },
    initialTab: "advanced",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Move rule 1 up" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Move rule 1 down" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Move rule 2 up" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Move rule 2 down" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Move rule 3 up" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Move rule 3 down" })).toBeDisabled();
  },
};

/** Magnet rule: Domain field is disabled with an explanatory hint. */
export const MagnetSiteMatchesThePage: Story = {
  args: {
    storage: {
      ...BASE_SETTINGS,
      routingRules: [
        {
          type: "magnet",
          namePattern: "*ubuntu*",
          destination: "Downloads/Linux",
        },
      ],
    },
    initialTab: "advanced",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The Site field used to be disabled for magnets, on the reasoning that a magnet has no
    // host. It has none of its own — but it was clicked on a page, and that is what the rule
    // matches now, so the field has to be usable.
    const siteInput = canvas.getByLabelText("Rule 1 site");
    await expect(siteInput).toBeEnabled();
    await expect(
      canvas.getByText("A magnet has no site of its own, so Site matches the page it was clicked on."),
    ).toBeVisible();
  },
};

/** Validation error: saving with missing destination shows inline error and retains draft. */
export const ValidationErrorMissingDestination: Story = {
  args: {
    storage: {
      ...BASE_SETTINGS,
      routingRules: [],
    },
    initialTab: "advanced",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Add rule" }));
    await userEvent.type(canvas.getByLabelText("Rule 1 name or extension"), "*.avi");
    await userEvent.click(canvas.getByRole("button", { name: "Save settings" }));
    await userEvent.keyboard("{Escape}");

    await expect(canvas.getByText("Destination folder is required")).toBeVisible();
    await expect(canvas.getByText("Fix the highlighted routing rule errors before saving")).toBeVisible();
  },
};

/** Validation error: saving with destination but no condition criteria. */
export const ValidationErrorNoConditions: Story = {
  args: {
    storage: {
      ...BASE_SETTINGS,
      routingRules: [],
    },
    initialTab: "advanced",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Add rule" }));
    const destInput = canvasElement.querySelector("#routing-0-destination") as HTMLInputElement;
    if (destInput) {
      await userEvent.type(destInput, "Downloads/Unsorted");
    }
    await userEvent.click(canvas.getByRole("button", { name: "Save settings" }));

    await expect(canvas.getByText("Set at least one condition: source, name or extension, or site")).toBeVisible();
  },
};

/** Reorder interaction: moving rule down swaps priorities immediately and marks form dirty. */
export const ReorderPriorityInteraction: Story = {
  args: {
    storage: {
      ...BASE_SETTINGS,
      routingRules: [
        {
          type: "torrent",
          namePattern: "FIRST_RULE",
          destination: "Folder1",
        },
        {
          type: "magnet",
          namePattern: "SECOND_RULE",
          destination: "Folder2",
        },
      ],
    },
    initialTab: "advanced",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const moveDownBtn = canvas.getByRole("button", {
      name: "Move rule 1 down",
    });
    await expect(moveDownBtn).toBeEnabled();
    await userEvent.click(moveDownBtn);

    // After swapping, the first rule's pattern field now contains SECOND_RULE
    const rule1Pattern = canvas.getByLabelText("Rule 1 name or extension");
    await expect(rule1Pattern).toHaveValue("SECOND_RULE");

    const rule2Pattern = canvas.getByLabelText("Rule 2 name or extension");
    await expect(rule2Pattern).toHaveValue("FIRST_RULE");

    // Save button should be enabled because order changed (isDirty)
    const saveBtn = canvas.getByRole("button", { name: "Save settings" });
    await expect(saveBtn).toBeEnabled();
  },
};

/** Long patterns and deep paths: verifies text wrapping and control layout under narrow widths. */
export const LongPatternsAndDeepPaths: Story = {
  args: {
    storage: {
      ...BASE_SETTINGS,
      routingRules: [
        {
          type: "torrent",
          domain: "very-long-subdomain.tracker-network-distribution.internal.company.com",
          namePattern: "*very.long.release.name.with.many.dots.and.tags.2160p.hdr.remux*",
          destination: "/share/CACHEDEV1_DATA/Multimedia/Archive/4K/HDR/Uncompressed/Films",
        },
      ],
    },
    initialTab: "advanced",
  },
};
