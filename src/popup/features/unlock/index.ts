import { mount } from "svelte";

import UnlockPanel from "./Unlock.svelte";

type InitializeUnlockOptions = {
  onUnlock: () => void;
};

export type UnlockFeature = {
  showPanel: () => void;
  hidePanel: () => void;
};

export function initializeUnlock(options: InitializeUnlockOptions): UnlockFeature {
  const panel = document.getElementById("unlock-panel");
  if (panel) {
    panel.replaceChildren();
    mount(UnlockPanel, {
      target: panel,
      props: { onUnlock: options.onUnlock },
    });
  }

  return {
    showPanel: () => {
      panel?.classList.remove("hidden");
    },
    hidePanel: () => {
      panel?.classList.add("hidden");
    },
  };
}
