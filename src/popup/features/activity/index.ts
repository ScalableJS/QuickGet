import { mount } from "svelte";

import ActivityPanel from "./Activity.svelte";

/** Mounts the activity list under the downloads section; renders nothing when empty. */
export function initializeActivity(): void {
  const host = document.getElementById("activity-section");
  if (!host) return;

  host.replaceChildren();
  mount(ActivityPanel, { target: host });
}
