/**
 * Reactive view model for the toolbar — mutated by the toolbar feature and the
 * downloads feature (status speed); read reactively by Toolbar.svelte.
 */
export const toolbarView = $state<{
  hasSelection: boolean;
  settingsExpanded: boolean;
  statusSpeed: string;
}>({
  hasSelection: false,
  settingsExpanded: false,
  statusSpeed: "↓ 0 B/s ↑ 0 B/s",
});
