<script lang="ts">
  import type { Settings } from "@lib/config.js";
  import { getErrorMessage } from "@lib/errors.js";
  import { classifyUrl, resolveDestination } from "@lib/routingRules.js";
  import { loadSettings } from "@lib/settings.js";
  import {
    findExistingTask,
    isRestartable,
    type PendingTorrent,
    resumeTask,
    sendTorrentUrlToNas,
  } from "@lib/torrentSender.js";
  import FolderSelect from "../popup/features/folderPicker/FolderSelect.svelte";

  const downloadId = Number(new URLSearchParams(location.search).get("id"));
  const pendingKey = `pending_${downloadId}`;

  let settings = $state<Settings | null>(null);
  let pending = $state<PendingTorrent | null>(null);
  let folder = $state("");
  let name = $state("…");
  let status = $state("");
  let addLabel = $state("Add to NAS");
  let addDisabled = $state(false);
  let folderDisabled = $state(false);
  let resumeHash: string | null = null;

  async function init(): Promise<void> {
    settings = await loadSettings();
    folder = settings.NASdir;

    const stored = await chrome.storage.session.get(pendingKey);
    pending = (stored[pendingKey] as PendingTorrent | undefined) ?? null;

    if (!pending) {
      name = "(torrent no longer available)";
      addDisabled = true;
      return;
    }
    name = pending.filename;
    // Pre-fill with the routing-rule destination; the user can still override it.
    folder = resolveDestination(
      { url: pending.url, kind: classifyUrl(pending.url) },
      settings.routingRules,
      settings.NASdir,
    );
  }

  async function handleAdd(): Promise<void> {
    if (resumeHash) return doResume(resumeHash);
    if (!settings || !pending) return;

    addDisabled = true;
    status = "Sending…";
    try {
      const result = await sendTorrentUrlToNas(settings, pending.url, folder.trim() || undefined);
      await chrome.storage.session.remove(pendingKey);
      if (result.duplicate) {
        await handleDuplicate(result.name);
        return;
      }
      status = `Added: ${result.name}`;
      setTimeout(() => window.close(), 900);
    } catch (error) {
      status = `Failed: ${getErrorMessage(error)}`;
      addDisabled = false;
    }
  }

  async function handleDuplicate(torrentName: string): Promise<void> {
    if (!settings) return;
    const existing = await findExistingTask(settings, torrentName).catch(() => undefined);

    if (existing?.hash && isRestartable(existing.status)) {
      status = `Already on NAS (${existing.status}).`;
      folderDisabled = true;
      addDisabled = false;
      addLabel = "Resume";
      resumeHash = existing.hash;
      return;
    }

    status = existing ? `Already on NAS — ${existing.status}` : `${torrentName} is already on the NAS`;
    setTimeout(() => window.close(), 1200);
  }

  async function doResume(hash: string): Promise<void> {
    if (!settings) return;
    addDisabled = true;
    status = "Resuming…";
    try {
      await resumeTask(settings, hash);
      status = "Resumed.";
      setTimeout(() => window.close(), 900);
    } catch (error) {
      status = `Failed: ${getErrorMessage(error)}`;
      addDisabled = false;
    }
  }

  async function cancel(): Promise<void> {
    await chrome.storage.session.remove(pendingKey);
    window.close();
  }

  void init();
</script>

<h1>Send torrent to NAS</h1>
<div class="name" id="torrent-name">{name}</div>

<label for="folder">Target Folder</label>
{#if folderDisabled}
  <input id="folder" type="text" placeholder="/share/Multimedia/Movies" bind:value={folder} disabled />
{:else}
  <FolderSelect id="folder" placeholder="/share/Multimedia/Movies" settings={settings ?? undefined} bind:value={folder} />
{/if}

<div class="actions">
  <button type="button" id="cancel-btn" onclick={cancel}>Cancel</button>
  <button type="button" id="add-btn" class="primary" disabled={addDisabled} onclick={handleAdd}>{addLabel}</button>
</div>

<div class="status" id="status">{status}</div>
