<script lang="ts">
  import Plus from "~icons/lucide/plus";
  import X from "~icons/lucide/x";

  import { showStatus } from "@/popup/components";
  import { applyTheme } from "@lib/applyTheme.js";
  import { DEFAULTS, type Settings } from "@lib/config.js";
  import { getErrorMessage } from "@lib/errors.js";
  import type { RoutingMatchType } from "@lib/routingRules.js";
  import { composeServerUrl, parseServerUrl } from "@lib/serverUrl.js";
  import { loadSettings, saveSettings } from "@lib/settings.js";
  import { Alert, Button, Card, Checkbox, Field, Link, Select } from "@ui";

  import { getApiClient, invalidateClientCache } from "../../shared/api";
  import FolderSelect from "../folderPicker/FolderSelect.svelte";
  import type { FolderFieldStatus } from "../folderPicker/validateFolder.js";
  import { exportSettings, parseImportedSettings } from "./settingsBackup.js";

  let form = $state<Settings>({ ...DEFAULTS });

  let tempStatus = $state<FolderFieldStatus>("idle");
  let dirStatus = $state<FolderFieldStatus>("idle");

  // Single "Server address" field, kept only in the form. On load we compose it
  // from the stored protocol/host/port; on save we parse it back into them.
  let serverUrl = $state("");

  let masterPasswordInput = $state("");
  let confirmMasterPasswordInput = $state("");
  let hasCachedMasterPassword = $state(false);
  let savedSignature = $state("");

  const isDirty = $derived(savedSignature !== "" && savedSignature !== settingsSignature());

  function settingsSignature(): string {
    return JSON.stringify({
      form,
      serverUrl,
      masterPasswordInput,
      confirmMasterPasswordInput,
      hasCachedMasterPassword,
    });
  }

  function markClean(): void {
    savedSignature = settingsSignature();
  }

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

  let importInput = $state<HTMLInputElement | null>(null);

  function exportBackup(): void {
    const json = exportSettings($state.snapshot(form));
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quickget-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showStatus("Settings exported", "success", { autoHideMs: 1500 });
  }

  async function importBackup(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const patch = parseImportedSettings(await file.text());
      Object.assign(form, patch);
      serverUrl = composeServerUrl(form);
      showStatus("Settings imported — review and Save", "success", { autoHideMs: 2500 });
    } catch (error) {
      showStatus(`Import failed: ${getErrorMessage(error)}`, "error");
    } finally {
      input.value = ""; // let the same file be re-selected later
    }
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
      markClean();
    } catch (error) {
      showStatus(`Failed to load settings: ${getErrorMessage(error)}`, "error");
      markClean();
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
      markClean();
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

<div class="settings-stack">
<Card variant="plain">
  <h2 class="section-heading">Connection</h2>
  <div class="form-group">
    <Field id="serverUrl" label="Server address" placeholder="https://downloadstation.local:8080" required bind:value={serverUrl} />
  </div>

  <div class="form-group">
    <Field id="NASlogin" label="Username" placeholder="download" required bind:value={form.NASlogin} />
  </div>

  <div class="form-group">
    <Field id="NASpassword" label="Password" type="password" placeholder="App-specific password" required bind:value={form.NASpassword} />
  </div>

  <div class="form-group form-inline">
    <Checkbox id="rememberPassword" bind:checked={form.rememberPassword}>
      Remember password on this device
    </Checkbox>
  </div>

  {#if form.rememberPassword && !hasCachedMasterPassword}
    <div class="form-group">
      <Field id="masterPasswordInput" label="Create Master Password" type="password" placeholder="Minimum 8 characters" bind:value={masterPasswordInput} required />
    </div>
    <div class="form-group">
      <Field id="confirmMasterPasswordInput" label="Confirm Master Password" type="password" placeholder="Repeat master password" bind:value={confirmMasterPasswordInput} required />
    </div>
  {:else if form.rememberPassword && hasCachedMasterPassword}
    <div class="form-group form-inline-text">
      <span class="text-muted">Master password is active.</span>
      <Link size="small" onclick={triggerChangeMasterPassword}>Change Master Password</Link>
    </div>
  {/if}
</Card>

<Card variant="plain">
  <h2 class="section-heading">Download defaults</h2>
  <div class="form-group">
    <label for="NAStempdir">Temp Folder</label>
    <FolderSelect id="NAStempdir" placeholder="Download" settings={$state.snapshot(form)} bind:value={form.NAStempdir} bind:status={tempStatus} />
  </div>

  <div class="form-group">
    <label for="NASdir">Target Folder</label>
    <FolderSelect id="NASdir" placeholder="Multimedia/Movies" settings={$state.snapshot(form)} bind:value={form.NASdir} bind:status={dirStatus} />
  </div>

  <div class="form-group">
    <Select id="torrentInterceptMode" label="Intercept .torrent downloads" bind:value={form.torrentInterceptMode}>
      <option value="off">Off — download normally</option>
      <option value="ask">Ask — offer to send to NAS</option>
      <option value="always">Always send to NAS</option>
    </Select>
  </div>

  <div class="form-group">
    <Select
      id="theme"
      label="Theme"
      bind:value={form.theme}
      onchange={() => applyTheme(form.theme)}
    >
      <option value="auto">Auto — follow system</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </Select>
  </div>
</Card>

<Card variant="plain">
  <div class="routing-header">
    <h2 class="section-heading routing-title">Routing rules</h2>
    <Link class="add-rule" size="small" onclick={addRule}><Plus aria-hidden="true" />Add rule</Link>
  </div>
  <Alert tone="hint">
    Auto-route matching downloads to a folder. Rules are checked top-to-bottom — the first match
    wins; otherwise the Target Folder above is used.
  </Alert>

  {#if form.routingRules.length === 0}
    <p class="routing-empty text-muted">No rules — every download uses the Target Folder.</p>
  {:else}
    {#each form.routingRules as rule, i (rule)}
      <div class="routing-rule">
        <div class="routing-conditions">
          <div class="routing-match-type">
            <Select aria-label="Match type" value={rule.type ?? ""} onchange={(e) => setRuleType(i, e.currentTarget.value)}>
              <option value="">Any type</option>
              <option value="url">URL</option>
              <option value="magnet">Magnet</option>
              <option value="torrent">.torrent</option>
            </Select>
          </div>
          <div class="routing-text-field">
            <Field placeholder="Name e.g. *.mkv" aria-label="Filename pattern" bind:value={rule.namePattern} />
          </div>
          <div class="routing-text-field">
            <Field placeholder="Domain e.g. *.site.com" aria-label="Domain" bind:value={rule.domain} />
          </div>
          <button type="button" class="rule-remove" aria-label="Remove rule" title="Remove rule" onclick={() => removeRule(i)}>
            <X aria-hidden="true" />
          </button>
        </div>
        <FolderSelect id={`routing-${i}-destination`} placeholder="Destination folder" settings={$state.snapshot(form)} bind:value={rule.destination} />
      </div>
    {/each}
  {/if}
</Card>

<Card variant="plain">
  <div class="routing-header">
    <h2 class="section-heading routing-title">Backup</h2>
  </div>
  <Alert tone="hint">Export or restore settings. Credentials are never included.</Alert>
  <div class="backup-actions">
    <Button variant="secondary" onclick={exportBackup}>Export settings</Button>
    <Button variant="secondary" onclick={() => importInput?.click()}>Import settings</Button>
    <input bind:this={importInput} type="file" accept="application/json,.json" hidden onchange={importBackup} />
  </div>
</Card>

<footer class="settings-actions">
  {#if isDirty}
    <p class="dirty-state" aria-live="polite">Unsaved changes</p>
  {/if}
  <div class="settings-action-buttons">
    <Button id="save-btn" disabled={!isDirty} onclick={save}>Save Settings</Button>
    <Button id="test-btn" variant="secondary" onclick={testConnection}>Test configuration</Button>
  </div>
</footer>
</div>

<style>
  .settings-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding-bottom: var(--space-5);
  }

  .settings-actions {
    position: sticky;
    bottom: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg);
  }

  .settings-action-buttons {
    display: flex;
    flex: 1;
    gap: var(--space-2);
  }

  .settings-action-buttons :global(.btn) {
    flex: 1;
  }

  .dirty-state {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .section-heading {
    margin: 0 0 var(--space-3);
    color: var(--color-text);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.5;
  }

  .routing-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  .routing-title {
    margin-bottom: 0;
  }

  :global(.link.add-rule) {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    text-decoration: none;
  }

  .routing-empty {
    font-size: 12px;
  }

  .routing-rule {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
  }

  .routing-conditions {
    display: flex;
    gap: var(--space-1);
    align-items: center;
  }

  .routing-match-type,
  .routing-text-field {
    flex: 1;
    min-width: 0;
  }

  .rule-remove {
    flex-shrink: 0;
    min-height: var(--control-height);
    border: 1px solid var(--color-control-border);
    background: var(--color-bg-alt);
    border-radius: var(--radius);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-2);
    font-size: 13px;
    line-height: 1;
    color: var(--color-error);
  }

  .rule-remove:hover {
    background: color-mix(in srgb, var(--color-error) 12%, var(--color-bg-alt));
  }

  .backup-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .text-muted {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .form-inline-text {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: 0;
    margin-bottom: 0;
  }
</style>
