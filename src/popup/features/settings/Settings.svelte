<script lang="ts">
  import { showStatus } from "@/popup/components";
  import { DEFAULTS, type Settings } from "@lib/config.js";
  import { getErrorMessage } from "@lib/errors.js";
  import { loadSettings, saveSettings } from "@lib/settings.js";

  import { getApiClient, invalidateClientCache } from "../../shared/api";

  let { onDebugToggle }: { onDebugToggle?: (enabled: boolean) => void } = $props();

  let form = $state<Settings>({ ...DEFAULTS });

  // Keep the debug logger in sync with the toggle (load + user changes).
  $effect(() => {
    onDebugToggle?.(form.enableDebugLogging);
  });

  export async function load(): Promise<void> {
    try {
      form = await loadSettings();
      showStatus("Settings loaded", "info", { autoHideMs: 1500 });
    } catch (error) {
      showStatus(`Failed to load settings: ${getErrorMessage(error)}`, "error");
    }
  }

  export async function save(): Promise<void> {
    try {
      await saveSettings($state.snapshot(form));
      invalidateClientCache();
      showStatus("Settings saved successfully", "success", { autoHideMs: 1500 });
    } catch (error) {
      showStatus(`Failed to save settings: ${getErrorMessage(error)}`, "error");
    }
  }

  async function testConnection(): Promise<void> {
    try {
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
    <label for="NASsecure">
      <input type="checkbox" id="NASsecure" bind:checked={form.NASsecure} />
      Use HTTPS
    </label>
  </div>

  <div class="form-group">
    <label for="NASaddress">NAS Address</label>
    <input type="text" id="NASaddress" placeholder="downloadstation.local" required bind:value={form.NASaddress} />
  </div>

  <div class="form-group">
    <label for="NASport">NAS Port</label>
    <input type="text" id="NASport" placeholder="8080" bind:value={form.NASport} />
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
    <label for="NAStempdir">Temporary Directory</label>
    <input type="text" id="NAStempdir" placeholder="/share/Download" bind:value={form.NAStempdir} />
  </div>

  <div class="form-group">
    <label for="NASdir">Final Directory</label>
    <input type="text" id="NASdir" placeholder="/share/Multimedia/Movies" bind:value={form.NASdir} />
  </div>

  <div class="form-group">
    <label for="torrentInterceptMode">Intercept .torrent downloads</label>
    <select id="torrentInterceptMode" bind:value={form.torrentInterceptMode}>
      <option value="off">Off — download normally</option>
      <option value="ask">Ask — offer to send to NAS</option>
      <option value="always">Always send to NAS</option>
    </select>
  </div>

  <div class="form-group">
    <label for="destinationFolders">Destination folders (one per line)</label>
    <textarea
      id="destinationFolders"
      rows="3"
      placeholder={"/share/Multimedia/Movies\n/share/Multimedia/TV\n/share/Download"}
      bind:value={form.destinationFolders}
    ></textarea>
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
