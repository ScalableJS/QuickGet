/**
 * Folder chooser window entry — mounts Chooser.svelte. Opened from the
 * "Choose folder…" notification action with ?id=<downloadId>.
 */

import { mount } from "svelte";

import Chooser from "./Chooser.svelte";

const target = document.getElementById("app");
if (target) {
  mount(Chooser, { target });
}
