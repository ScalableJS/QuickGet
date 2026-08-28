import type { Preview } from "@storybook/svelte-vite";

import "virtual:uno.css";
import "../src/popup/styles/tokens.css";
import "../src/popup/styles/base.css";
import { installChromeMock } from "./chromeMock";

// Settings and the folder picker read `chrome.storage` on mount; without a stand-in they throw
// before rendering, so none of their states could be reviewed here.
installChromeMock();

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
    // "error" fails the story rather than merely annotating it, so a regression is a failure
    // and not a note someone has to notice.
    a11y: { test: "error" },
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
