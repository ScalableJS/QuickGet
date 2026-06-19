<script lang="ts">
  import { showStatus } from "@/popup/components";
  import { DEFAULTS, type Settings } from "@lib/config.js";
  import { getErrorMessage } from "@lib/errors.js";
  import { composeServerUrl, parseServerUrl } from "@lib/serverUrl.js";
  import { loadSettings, saveSettings } from "@lib/settings.js";

  import { getApiClient, invalidateClientCache } from "../../shared/api";
  import FolderSelect from "../folderPicker/FolderSelect.svelte";

  let { onDebugToggle }: { onDebugToggle?: (enabled: boolean) => void } = $props();

  let form = $state<Settings>({ ...DEFAULTS });

  // Single "Server address" field, kept only in the form. On load we compose it
  // from the stored protocol/host/port; on save we parse it back into them.
  let serverUrl = $state("");

  function applyServerUrl(raw: string): void {
    Object.assign(form, parseServerUrl(raw));
  }

  // Keep the debug logger in sync with the toggle (load + user changes).
  $effect(() => {
    onDebugToggle?.(form.enableDebugLogging);
  });

  export async function load(): Promise<void> {
    try {
      form = await loadSettings();
      serverUrl = composeServerUrl(form);
      showStatus("Settings loaded", "info", { autoHideMs: 1500 });
    } catch (error) {
      showStatus(`Failed to load settings: ${getErrorMessage(error)}`, "error");
    }
  }

  export async function save(): Promise<void> {
    try {
      applyServerUrl(serverUrl);
      await saveSettings($state.snapshot(form));
      invalidateClientCache();
      showStatus("Settings saved successfully", "success", { autoHideMs: 1500 });
    } catch (error) {
      showStatus(`Failed to save settings: ${getErrorMessage(error)}`, "error");
    }
  }

  async function testConnection(): Promise<void> {
    try {
      applyServerUrl(serverUrl);
      showStatus("Testing connection...", "info");
      const client = await getApiClient({ settings: $state.snapshot(form) });
      const { tasks } = await client.queryTasks({ params: { limit: 1 } });
      if (Array.isArray(tasks)) {
        showStatus("Connection successful!", "success", { autoHideMs: 2000 });
      } else {
        showStatus("Connection failed. Check settings and try again.", "error");
      }
    } catch (error) {
      showStatus(`Connection error: ${getErrorMessage(error)}`, "error");
    }
  }

  // Auto-load on mount (mirrors the previous restoreSettings-on-init behaviour).
  void load();
</script>

<section class="form-section">
  <div class="form-group">
    <label for="serverUrl">Server address</label>
    <input type="text" id="serverUrl" placeholder="https://downloadstation.local:8080" required bind:value={serverUrl} />
  </div>

  <div class="form-group">
    <label for="NASlogin">Username</label>
    <input type="text" id="NASlogin" placeholder="download" required bind:value={form.NASlogin} />
  </div>

  <div class="form-group">
    <label for="NASpassword">Password</label>
    <input type="password" id="NASpassword" placeholder="App-specific password" required bind:value={form.NASpassword} />
  </div>

  <div class="form-group">
    <label for="NAStempdir">Temp Folder</label>
    <FolderSelect id="NAStempdir" placeholder="/share/Download" settings={$state.snapshot(form)} bind:value={form.NAStempdir} />
  </div>

  <div class="form-group">
    <label for="NASdir">Target Folder</label>
    <FolderSelect id="NASdir" placeholder="/share/Multimedia/Movies" settings={$state.snapshot(form)} bind:value={form.NASdir} />
  </div>

  <div class="form-group">
    <label for="torrentInterceptMode">Intercept .torrent downloads</label>
    <select id="torrentInterceptMode" bind:value={form.torrentInterceptMode}>
      <option value="off">Off — download normally</option>
      <option value="ask">Ask — offer to send to NAS</option>
      <option value="always">Always send to NAS</option>
    </select>
  </div>

  <div class="form-group form-inline">
    <label for="enableDebug">
      <input type="checkbox" id="enableDebug" bind:checked={form.enableDebugLogging} />
      Enable debug logs
    </label>
  </div>
</section>

<section class="button-group">
  <button type="button" id="save-btn" class="btn btn-primary" onclick={save}>Save Settings</button>
  <button type="button" id="test-btn" class="btn btn-secondary" onclick={testConnection}>Test Connection</button>
</section>
