import type { Preview } from "@storybook/svelte-vite";

import "../src/popup/index.css";

function applyTheme(theme: string): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  const styles = getComputedStyle(root);
  document.body.style.backgroundColor = styles.getPropertyValue("--color-bg").trim();
  document.body.style.color = styles.getPropertyValue("--color-text").trim();
}

const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: { expanded: true },
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Switch between light and dark UI palettes",
      defaultValue: "light",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story, context) => {
      applyTheme(context.globals.theme ?? "light");
      return story();
    },
  ],
};

export default preview;
