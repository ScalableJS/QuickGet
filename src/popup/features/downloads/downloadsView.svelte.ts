import type { Task } from "@lib/tasks.js";

/**
 * Reactive view model for the downloads list. Mutated by downloadsUI;
 * read reactively by DownloadsList.svelte.
 */
export const downloadsView = $state<{ tasks: Task[]; selectedHash: string | null; removingHash: string | null }>({
  tasks: [],
  selectedHash: null,
  removingHash: null,
});
