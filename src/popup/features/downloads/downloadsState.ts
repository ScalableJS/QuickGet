type SelectionListener = (hash: string | null) => void;

let selectedHash: string | null = null;

const selectionListeners = new Set<SelectionListener>();

export function getSelectedHash(): string | null {
  return selectedHash;
}

export function setSelectedHash(hash: string | null): void {
  if (selectedHash === hash) return;
  selectedHash = hash;
  selectionListeners.forEach((listener) => {
    listener(selectedHash);
  });
}

export function clearSelection(): void {
  setSelectedHash(null);
}

export function onSelectionChange(listener: SelectionListener): () => void {
  selectionListeners.add(listener);
  return () => selectionListeners.delete(listener);
}
