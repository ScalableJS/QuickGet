/**
 * Reactive view model for the toolbar — mutated by the toolbar feature and the
 * downloads feature (status speed); read reactively by Toolbar.svelte.
 */
export const toolbarView = $state<{
  hasSelection: boolean;
  settingsExpanded: boolean;
  statusDownloadSpeed: string;
  statusUploadSpeed: string;
}>({
  hasSelection: false,
  settingsExpanded: false,
  statusDownloadSpeed: "0 B/s",
  statusUploadSpeed: "0 B/s",
});
