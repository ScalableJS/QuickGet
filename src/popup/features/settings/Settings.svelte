<script lang="ts">
  import { showStatus } from "@/popup/components";
  import { DEFAULTS, type Settings } from "@lib/config.js";
  import { getErrorMessage } from "@lib/errors.js";
  import type { RoutingMatchType } from "@lib/routingRules.js";
  import { composeServerUrl, parseServerUrl } from "@lib/serverUrl.js";
  import { loadSettings, saveSettings } from "@lib/settings.js";

  import { getApiClient, invalidateClientCache } from "../../shared/api";
  import FolderSelect from "../folderPicker/FolderSelect.svelte";
  import type { FolderFieldStatus } from "../folderPicker/validateFolder.js";

  let form = $state<Settings>({ ...DEFAULTS });

  let tempStatus = $state<FolderFieldStatus>("idle");
  let dirStatus = $state<FolderFieldStatus>("idle");

  // Single "Server address" field, kept only in the form. On load we compose it
  // from the stored protocol/host/port; on save we parse it back into them.
  let serverUrl = $state("");

  let masterPasswordInput = $state("");
  let confirmMasterPasswordInput = $state("");
  let hasCachedMasterPassword = $state(false);

  function applyServerUrl(raw: string): void {
    Object.assign(form, parseServerUrl(raw));
  }

  function addRule(): void {
    form.routingRules.push({ destination: "" });
  }

  function removeRule(index: number): void {
    form.routingRules.splice(index, 1);
  }

  function setRuleType(index: number, raw: string): void {
    form.routingRules[index].type = raw === "" ? undefined : (raw as RoutingMatchType);
  }

  // Drop incomplete rules and normalise blank conditions to "no condition".
  function normalizeRoutingRules(): void {
    form.routingRules = form.routingRules
      .map((r) => ({
        type: r.type,
        namePattern: r.namePattern?.trim() ? r.namePattern.trim() : undefined,
        domain: r.domain?.trim() ? r.domain.trim() : undefined,
        destination: (r.destination ?? "").trim(),
      }))
      .filter((r) => r.destination !== "");
  }

  export async function load(): Promise<void> {
    try {
      form = await loadSettings();
      serverUrl = composeServerUrl(form);

      const session = await chrome.storage.session.get("cachedMasterPassword");
      hasCachedMasterPassword = Boolean(session.cachedMasterPassword);
    } catch (error) {
      showStatus(`Failed to load settings: ${getErrorMessage(error)}`, "error");
    }
  }

  export async function save(): Promise<void> {
    try {
      applyServerUrl(serverUrl);

      // Block save on a folder we positively know is wrong. "error" (unverifiable,
      // e.g. NAS offline) is allowed through — we don't punish offline users.
      if (tempStatus === "invalid" || dirStatus === "invalid") {
        showStatus("Fix the highlighted folder path before saving", "error");
        return;
      }

      normalizeRoutingRules();

      let masterPasswordToUse: string | undefined;

      if (form.rememberPassword) {
        if (!hasCachedMasterPassword) {
          if (!masterPasswordInput) {
            showStatus("Please enter a master password", "error");
            return;
          }
          if (masterPasswordInput.length < 8) {
            showStatus("Master password must be at least 8 characters long", "error");
            return;
          }
          if (masterPasswordInput !== confirmMasterPasswordInput) {
            showStatus("Master passwords do not match", "error");
            return;
          }
          masterPasswordToUse = masterPasswordInput;
        } else {
          const session = await chrome.storage.session.get("cachedMasterPassword");
          masterPasswordToUse = session.cachedMasterPassword as string | undefined;
        }
      }

      await saveSettings($state.snapshot(form), { masterPassword: masterPasswordToUse });

      if (masterPasswordToUse) {
        await chrome.storage.session.set({ cachedMasterPassword: masterPasswordToUse });
        hasCachedMasterPassword = true;
        masterPasswordInput = "";
        confirmMasterPasswordInput = "";
      }

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

  function triggerChangeMasterPassword(): void {
    hasCachedMasterPassword = false;
    masterPasswordInput = "";
    confirmMasterPasswordInput = "";
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

  <div class="form-group form-inline">
    <label for="rememberPassword">
      <input type="checkbox" id="rememberPassword" bind:checked={form.rememberPassword} />
      Remember password on this device
    </label>
  </div>

  {#if form.rememberPassword && !hasCachedMasterPassword}
    <div class="form-group">
      <label for="masterPasswordInput">Create Master Password</label>
      <input type="password" id="masterPasswordInput" placeholder="Minimum 8 characters" bind:value={masterPasswordInput} required />
    </div>
    <div class="form-group">
      <label for="confirmMasterPasswordInput">Confirm Master Password</label>
      <input type="password" id="confirmMasterPasswordInput" placeholder="Repeat master password" bind:value={confirmMasterPasswordInput} required />
    </div>
  {:else if form.rememberPassword && hasCachedMasterPassword}
    <div class="form-group form-inline-text">
      <span class="text-muted">Master password is active.</span>
      <button type="button" class="btn-link-small" onclick={triggerChangeMasterPassword}>
        Change Master Password
      </button>
    </div>
  {/if}

  <div class="form-group">
    <label for="NAStempdir">Temp Folder</label>
    <FolderSelect id="NAStempdir" placeholder="Download" settings={$state.snapshot(form)} bind:value={form.NAStempdir} bind:status={tempStatus} />
  </div>

  <div class="form-group">
    <label for="NASdir">Target Folder</label>
    <FolderSelect id="NASdir" placeholder="Multimedia/Movies" settings={$state.snapshot(form)} bind:value={form.NASdir} bind:status={dirStatus} />
  </div>

  <div class="form-group">
    <label for="torrentInterceptMode">Intercept .torrent downloads</label>
    <select id="torrentInterceptMode" bind:value={form.torrentInterceptMode}>
      <option value="off">Off — download normally</option>
      <option value="ask">Ask — offer to send to NAS</option>
      <option value="always">Always send to NAS</option>
    </select>
  </div>
</section>

<section class="form-section">
  <div class="routing-header">
    <span class="routing-title">Routing rules</span>
    <button type="button" class="btn-link-small" onclick={addRule}>+ Add rule</button>
  </div>
  <p class="routing-hint">
    Auto-route matching downloads to a folder. Rules are checked top-to-bottom — the first match
    wins; otherwise the Target Folder above is used.
  </p>

  {#if form.routingRules.length === 0}
    <p class="routing-empty text-muted">No rules — every download uses the Target Folder.</p>
  {:else}
    {#each form.routingRules as rule, i (rule)}
      <div class="routing-rule">
        <div class="routing-conditions">
          <select aria-label="Match type" value={rule.type ?? ""} onchange={(e) => setRuleType(i, e.currentTarget.value)}>
            <option value="">Any type</option>
            <option value="url">URL</option>
            <option value="magnet">Magnet</option>
            <option value="torrent">.torrent</option>
          </select>
          <input type="text" placeholder="Name e.g. *.mkv" aria-label="Filename pattern" bind:value={rule.namePattern} />
          <input type="text" placeholder="Domain e.g. *.site.com" aria-label="Domain" bind:value={rule.domain} />
          <button type="button" class="rule-remove" aria-label="Remove rule" title="Remove rule" onclick={() => removeRule(i)}>
            ✕
          </button>
        </div>
        <FolderSelect placeholder="Destination folder" settings={$state.snapshot(form)} bind:value={rule.destination} />
      </div>
    {/each}
  {/if}
</section>

<section class="button-group">
  <button type="button" id="save-btn" class="btn btn-primary" onclick={save}>Save Settings</button>
  <button type="button" id="test-btn" class="btn btn-secondary" onclick={testConnection}>Test Connection</button>
</section>

<style>
  .btn-link-small {
    background: none;
    border: none;
    color: var(--accent-color, #1a73e8);
    font-size: 0.85rem;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
    margin-left: 8px;
    display: inline;
  }

  .routing-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .routing-title {
    font-weight: 600;
  }

  .routing-hint {
    margin: 4px 0 8px;
    font-size: 12px;
    color: #777;
  }

  .routing-empty {
    font-size: 12px;
  }

  .routing-rule {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
    border-top: 1px solid #eee;
  }

  .routing-conditions {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .routing-conditions select,
  .routing-conditions input {
    flex: 1;
    min-width: 0;
  }

  .rule-remove {
    flex-shrink: 0;
    border: 1px solid #d0d0d0;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    padding: 0 8px;
    font-size: 13px;
    line-height: 1;
    color: #d32f2f;
  }

  .rule-remove:hover {
    background: #fdecea;
  }
  .btn-link-small:hover {
    color: var(--accent-hover-color, #1557b0);
  }
  .text-muted {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .form-inline-text {
    display: flex;
    align-items: center;
    margin-top: -8px;
    margin-bottom: 12px;
  }
</style>

