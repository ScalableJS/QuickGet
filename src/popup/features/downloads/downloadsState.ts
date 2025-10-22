import type { Task } from "@lib/tasks.js";

export interface DownloadsSnapshot {
  hashes: Set<string>;
  names: Set<string>;
}

type SelectionListener = (hash: string | null) => void;
type SnapshotListener = (snapshot: DownloadsSnapshot) => void;

let selectedHash: string | null = null;
let snapshot: DownloadsSnapshot = {
  hashes: new Set(),
  names: new Set(),
};

const selectionListeners = new Set<SelectionListener>();
const snapshotListeners = new Set<SnapshotListener>();

export function getSelectedHash(): string | null {
  return selectedHash;
}

export function setSelectedHash(hash: string | null): void {
  if (selectedHash === hash) return;
  selectedHash = hash;
  selectionListeners.forEach((listener) => listener(selectedHash));
}

export function clearSelection(): void {
  setSelectedHash(null);
}

export function onSelectionChange(listener: SelectionListener): () => void {
  selectionListeners.add(listener);
  return () => selectionListeners.delete(listener);
}

export function getSnapshot(): DownloadsSnapshot {
  return snapshot;
}

export function updateSnapshot(next: DownloadsSnapshot): void {
  snapshot = next;
  snapshotListeners.forEach((listener) => listener(snapshot));
}

export function onSnapshotChange(listener: SnapshotListener): () => void {
  snapshotListeners.add(listener);
  return () => snapshotListeners.delete(listener);
}

export function buildTaskSnapshot(tasks: any[]): DownloadsSnapshot {
  const hashes = new Set<string>();
  const names = new Set<string>();

  tasks.forEach((task) => {
    const hash = task?.hash ?? task?.bt_hash ?? task?.id ?? null;
    if (hash) hashes.add(String(hash).toLowerCase());

    [task?.name, task?.title, task?.source, task?.source_name, task?.filename]
      .filter(Boolean)
      .forEach((value) => {
        const normalized = String(value)
          .replace(/\.torrent$/i, "")
          .replace(/\[[^\]]*\]/g, "")
          .replace(/[._-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (normalized) names.add(normalized);
      });
  });

  return { hashes, names };
}

export function buildSnapshotFromTasks(tasks: Task[]): DownloadsSnapshot {
  return buildTaskSnapshot(tasks);
}
