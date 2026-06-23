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
  import { Alert, Button, Checkbox, Field, Link, Select } from "@ui";

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
  let savedConnectionSignature = $state("");
  let isSaving = $state(false);

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
    savedConnectionSignature = connectionSignature(form);
  }

  function connectionSignature(settings: Settings): string {
    return JSON.stringify({
      NASsecure: settings.NASsecure,
      NASaddress: settings.NASaddress,
      NASport: settings.NASport,
      NASlogin: settings.NASlogin,
      NASpassword: settings.NASpassword,
    });
  }

  function applyServerUrl(raw: string): void {
    Object.assign(form, parseServerUrl(raw));
  }

  function syncServerUrl(raw: string): void {
    try {
      applyServerUrl(raw);
      tempStatus = "idle";
      dirStatus = "idle";
    } catch {
      // Keep the last valid connection settings while the user is still typing.
    }
  }

  function addRule(): void {
    form = {
      ...form,
      routingRules: [...form.routingRules, { namePattern: "", domain: "", destination: "" }],
    };
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
    if (isSaving || !isDirty) return;

    try {
      isSaving = true;
      applyServerUrl(serverUrl);
      const shouldVerifyConnection = connectionSignature(form) !== savedConnectionSignature;

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
      applyTheme(form.theme);
      markClean();

      if (shouldVerifyConnection) {
        const settings = $state.snapshot(form);
        void verifySavedConnection(settings);
      }
    } catch (error) {
      showStatus(`Failed to save settings: ${getErrorMessage(error)}`, "error");
    } finally {
      isSaving = false;
    }
  }

  async function verifySavedConnection(settings: Settings): Promise<void> {
    try {
      const client = await getApiClient({ settings });
      const { tasks } = await client.queryTasks({ params: { limit: 1 } });
      if (!Array.isArray(tasks)) {
        showStatus("Settings saved; connection could not be verified", "info", { autoHideMs: 4000 });
      }
    } catch (error) {
      showStatus(`Settings saved; connection could not be verified: ${getErrorMessage(error)}`, "info", { autoHideMs: 4000 });
    }
  }

  function triggerChangeMasterPassword(): void {
    hasCachedMasterPassword = false;
    masterPasswordInput = "";
    confirmMasterPasswordInput = "";
  }

</script>

<div class="settings-stack">
<section class="settings-section">
  <h2 class="section-heading">Connection</h2>
  <div class="form-group">
    <Field
      id="serverUrl"
      label="Server address"
      placeholder="https://downloadstation.local:8080"
      required
      bind:value={serverUrl}
      oninput={(event) => syncServerUrl(event.currentTarget.value)}
    />
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
</section>

<section class="settings-section">
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
      <option value="always">Always send to NAS</option>
    </Select>
  </div>

  <div class="form-group">
    <Select id="theme" label="Theme" bind:value={form.theme}>
      <option value="auto">Auto — follow system</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </Select>
  </div>
</section>

<section class="settings-section">
  <div class="routing-header">
    <h2 class="section-heading routing-title">Routing rules</h2>
    <button type="button" class="add-rule" onclick={addRule}><Plus aria-hidden="true" />Add rule</button>
  </div>
  <Alert tone="hint">
    Send matching downloads to a folder automatically. Rules run top to bottom; the first match wins.
    Everything else uses the Target Folder.
  </Alert>

  {#if form.routingRules.length === 0}
    <p class="routing-empty text-muted">No rules yet. All downloads use the Target Folder.</p>
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
</section>

<section class="settings-section">
  <div class="routing-header">
    <h2 class="section-heading routing-title">Backup</h2>
  </div>
  <Alert tone="hint">Export or restore settings. Credentials are never included.</Alert>
  <div class="backup-actions">
    <Button variant="secondary" onclick={exportBackup}>Export settings</Button>
    <Button variant="secondary" onclick={() => importInput?.click()}>Import settings</Button>
    <input bind:this={importInput} type="file" accept="application/json,.json" hidden onchange={importBackup} />
  </div>
</section>

<footer class="settings-actions">
  <div class="settings-action-buttons">
    <Button id="save-btn" disabled={!isDirty || isSaving} onclick={save}>
      {isSaving ? "Saving…" : "Save Settings"}
    </Button>
  </div>
</footer>
</div>

<style>
  .settings-stack {
    display: flex;
    flex-direction: column;
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

  .add-rule {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-primary);
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: none;
  }

  .add-rule:hover {
    color: color-mix(in srgb, var(--color-primary) 75%, black);
  }

  .routing-empty {
    font-size: 12px;
  }

  .routing-rule {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) 0;
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
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }

  .backup-actions :global(.btn) {
    flex: none;
    width: 100%;
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
