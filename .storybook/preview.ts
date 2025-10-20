import type { Decorator, Preview } from "@storybook/html";

import "../src/popup/index.css";

const themeDecorator: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? "light";
  const root = document.documentElement;

  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.setAttribute("data-theme", "dark");
  }

  // Sync body colors to current CSS variables for clean canvas background
  const styles = getComputedStyle(root);
  document.body.style.backgroundColor = styles.getPropertyValue("--color-bg").trim();
  document.body.style.color = styles.getPropertyValue("--color-text").trim();

  return Story();
};

const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: {
      expanded: true,
    },
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
  decorators: [themeDecorator],
};

export default preview;
