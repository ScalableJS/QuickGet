/**
 * Folder chooser window — opened from the "Choose folder…" notification action.
 * Reads the pending torrent from session storage, lets the user pick a
 * destination folder, then uploads the torrent to the NAS.
 */

import { parseDestinationFolders } from "@lib/config.js";
import { loadSettings } from "@lib/settings.js";
import { findExistingTask, isRestartable, resumeTask, sendTorrentUrlToNas } from "@lib/torrentSender.js";

interface PendingTorrent {
  url: string;
  filename: string;
}

const pendingKey = (id: number): string => `pending_${id}`;

const nameEl = document.getElementById("torrent-name") as HTMLDivElement;
const folderEl = document.getElementById("folder") as HTMLInputElement;
const foldersList = document.getElementById("folders") as HTMLDataListElement;
const addBtn = document.getElementById("add-btn") as HTMLButtonElement;
const cancelBtn = document.getElementById("cancel-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

const downloadId = Number(new URLSearchParams(location.search).get("id"));

async function init(): Promise<void> {
  const settings = await loadSettings();

  const folders = parseDestinationFolders(settings);
  foldersList.innerHTML = "";
  for (const folder of folders) {
    const option = document.createElement("option");
    option.value = folder;
    foldersList.appendChild(option);
  }
  folderEl.value = folders[0] ?? settings.NASdir;

  const stored = await chrome.storage.session.get(pendingKey(downloadId));
  const pending = stored[pendingKey(downloadId)] as PendingTorrent | undefined;

  if (!pending) {
    nameEl.textContent = "(torrent no longer available)";
    addBtn.disabled = true;
    return;
  }

  nameEl.textContent = pending.filename;

  addBtn.addEventListener("click", () => {
    void submit(settings, pending);
  });
  cancelBtn.addEventListener("click", () => {
    void cancel();
  });
}

async function submit(settings: Awaited<ReturnType<typeof loadSettings>>, pending: PendingTorrent): Promise<void> {
  const folder = folderEl.value.trim();
  addBtn.disabled = true;
  statusEl.textContent = "Sending…";

  try {
    const { name, duplicate } = await sendTorrentUrlToNas(settings, pending.url, folder || undefined);
    await chrome.storage.session.remove(pendingKey(downloadId));

    if (duplicate) {
      await handleDuplicate(settings, name);
      return;
    }

    statusEl.textContent = `Added: ${name}`;
    setTimeout(() => window.close(), 900);
  } catch (error) {
    statusEl.textContent = `Failed: ${(error as Error).message}`;
    addBtn.disabled = false;
  }
}

/**
 * Already on the NAS — offer to resume the task if it stalled, otherwise report.
 */
async function handleDuplicate(settings: Awaited<ReturnType<typeof loadSettings>>, name: string): Promise<void> {
  const existing = await findExistingTask(settings, name).catch(() => undefined);

  if (existing?.hash && isRestartable(existing.status)) {
    statusEl.textContent = `Already on NAS (${existing.status}).`;
    folderEl.disabled = true;
    addBtn.disabled = false;
    addBtn.textContent = "Resume";
    addBtn.onclick = () => {
      void doResume(settings, existing.hash as string);
    };
    return;
  }

  statusEl.textContent = existing ? `Already on NAS — ${existing.status}` : `${name} is already on the NAS`;
  setTimeout(() => window.close(), 1200);
}

async function doResume(settings: Awaited<ReturnType<typeof loadSettings>>, hash: string): Promise<void> {
  addBtn.disabled = true;
  statusEl.textContent = "Resuming…";
  try {
    await resumeTask(settings, hash);
    statusEl.textContent = "Resumed.";
    setTimeout(() => window.close(), 900);
  } catch (error) {
    statusEl.textContent = `Failed: ${(error as Error).message}`;
    addBtn.disabled = false;
  }
}

async function cancel(): Promise<void> {
  await chrome.storage.session.remove(pendingKey(downloadId));
  window.close();
}

void init();
