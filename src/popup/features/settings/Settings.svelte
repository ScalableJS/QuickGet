<script lang="ts">
  import { tick, untrack } from "svelte";
  import Monitor from "~icons/lucide/monitor";
  import Moon from "~icons/lucide/moon";
  import Plus from "~icons/lucide/plus";
  import Sun from "~icons/lucide/sun";
  import X from "~icons/lucide/x";

  import { showStatus } from "@/popup/components";
  import { applyTheme } from "@lib/applyTheme.js";
  import { DEFAULTS, type Settings, type ThemeMode } from "@lib/config.js";
  import { getErrorMessage } from "@lib/errors.js";
  import type { RoutingMatchType } from "@lib/routingRules.js";
  import { findConfigProblem } from "@lib/configHealth.js";
  import { clearConnectionHealth, type ConnectionState, readConnectionState, recordFailure, recordSuccess } from "@lib/connectionHealth.js";
  import { composeServerUrl, parseServerUrl } from "@lib/serverUrl.js";
  import { loadSettings, saveSettings } from "@lib/settings.js";
  import { disableSettingsLock, enableSettingsLock, getSettingsLockState } from "@lib/settingsLock.js";
  import { Alert, Button, Checkbox, Field, FormSection, Link, SegmentedControl, Select, Tabs } from "@ui";

  import { getApiClient, invalidateClientCache } from "../../shared/api";
  import FolderSelect from "../folderPicker/FolderSelect.svelte";
  import type { FolderFieldStatus } from "../folderPicker/validateFolder.js";
  import { describeImport, exportSettings, parseImportedSettings } from "./settingsBackup.js";

  /** Which tab opens first. Only Storybook needs this — the popup always starts on Connection. */
  type Props = { initialTab?: "connection" | "advanced" };
  let { initialTab = "connection" }: Props = $props();

  let form = $state<Settings>({ ...DEFAULTS });

  let tempStatus = $state<FolderFieldStatus>("idle");
  let dirStatus = $state<FolderFieldStatus>("idle");

  // Single "Server address" field, kept only in the form. On load we compose it
  // from the stored protocol/host/port; on save we parse it back into them.
  let serverUrl = $state("");

  let lockPasswordInput = $state("");
  let confirmLockPasswordInput = $state("");
  /** Whether the settings screen itself is password-protected. Never gates downloading. */
  let settingsLockEnabled = $state(false);
  let lockWasEnabled = $state(false);
  let savedSignature = $state("");
  let savedConnectionSignature = $state("");
  let isSaving = $state(false);

  const isDirty = $derived(savedSignature !== "" && savedSignature !== settingsSignature());

  /**
   * The theme takes effect and is stored on selection, with no Save involved. It changes
   * nothing the NAS cares about and cannot be "wrong", so making the user confirm it — and
   * blocking it behind a form that refuses to save while a field is empty — was pure friction.
   */
  async function chooseTheme(theme: ThemeMode): Promise<void> {
    form.theme = theme;
    applyTheme(theme);
    try {
      await saveSettings({ theme });
    } catch (error) {
      showStatus(`Could not save the theme: ${getErrorMessage(error)}`, "error");
    }
  }

  // Shown while the form is incomplete, so the gap is visible before a download reveals it.
  const configProblem = $derived(savedSignature === "" ? undefined : findConfigProblem(form));

  /**
   * Per-field errors, filled in as fields are left rather than only when Save is pressed.
   * Waiting for Save is how an empty Temp Folder went unnoticed until every download failed.
   */
  let fieldErrors = $state<Record<string, string>>({});

  /**
   * Configuration and health are separate: a NAS that is switched off does not make the saved
   * settings wrong, so the form is not shown again just because a check failed.
   */
  let connection = $state<ConnectionState>({ configured: false, health: { kind: "unknown" } });
  /** True while the user is deliberately editing an already-configured connection. */
  let editingConnection = $state(false);
  let isTesting = $state(false);

  const showConnectionForm = $derived(!connection.configured || editingConnection);

  const TABS: { id: NonNullable<Props["initialTab"]>; label: string }[] = [
    { id: "connection", label: "Connection" },
    { id: "advanced", label: "Advanced" },
  ];
  // `initialTab` only sets the starting value; reading it here (rather than in a closure) is
  // deliberate — the tab is expected to change independently of the prop afterwards.
  let activeTab = $state(untrack(() => initialTab));

  /** Field ids in the order they appear, so Save can focus the first one that is wrong. */
  const REQUIRED_FIELDS: { id: string; label: string; value: () => string; tab: NonNullable<Props["initialTab"]> }[] = [
    { id: "serverUrl", label: "Server address", value: () => serverUrl, tab: "connection" },
    { id: "NASlogin", label: "Username", value: () => form.NASlogin, tab: "connection" },
    { id: "NASpassword", label: "Password", value: () => form.NASpassword, tab: "connection" },
    { id: "NAStempdir", label: "Temp Folder", value: () => form.NAStempdir, tab: "connection" },
  ];

  function validateField(id: string): void {
    const field = REQUIRED_FIELDS.find((candidate) => candidate.id === id);
    if (!field) return;

    if (field.value().trim()) {
      const { [id]: _removed, ...rest } = fieldErrors;
      fieldErrors = rest;
    } else {
      fieldErrors = { ...fieldErrors, [id]: `${field.label} is required` };
    }
  }

  /** Marks every empty required field and returns the first one, for focus. */
  function markMissingFields(): string | undefined {
    const errors: Record<string, string> = {};
    for (const field of REQUIRED_FIELDS) {
      if (!field.value().trim()) errors[field.id] = `${field.label} is required`;
    }
    fieldErrors = errors;
    return REQUIRED_FIELDS.find((field) => errors[field.id])?.id;
  }

  function settingsSignature(): string {
    // The theme is applied and stored the moment it is picked, so it must not make the form
    // dirty — a preference that takes effect immediately has nothing left to save.
    const { theme: _appliedImmediately, ...pending } = form;
    return JSON.stringify({
      form: pending,
      serverUrl,
      lockPasswordInput,
      confirmLockPasswordInput,
      // Toggling the lock on its own is a change worth saving, so it must dirty the form.
      settingsLockEnabled,
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
    // Removing a row is silent otherwise: focus moves and nothing says what happened.
    showStatus(`Rule ${index + 1} removed`, "info", { autoHideMs: 2000 });
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

  /**
   * A file chosen from disk used to overwrite the form the instant it was picked, with nothing
   * said beforehand and no way back. It is held here instead until the user confirms, and the
   * confirmation names what will change — the file's contents are otherwise invisible to them.
   */
  let pendingImport = $state<{ patch: Partial<Settings>; changes: string[] } | null>(null);

  async function importBackup(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const patch = parseImportedSettings(await file.text());
      const changes = describeImport(patch);

      if (changes.length === 0) {
        showStatus("That backup contains no settings to import", "error");
        return;
      }

      pendingImport = { patch, changes };
    } catch (error) {
      showStatus(`Import failed: ${getErrorMessage(error)}`, "error");
    } finally {
      input.value = ""; // let the same file be re-selected later
    }
  }

  function applyImport(): void {
    if (!pendingImport) return;

    Object.assign(form, pendingImport.patch);
    serverUrl = composeServerUrl(form);
    pendingImport = null;
    showStatus("Settings imported — review and Save", "success", { autoHideMs: 2500 });
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

      connection = await readConnectionState(form);

      const lock = await getSettingsLockState();
      settingsLockEnabled = lock.enabled;
      lockWasEnabled = lock.enabled;
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

      // Saving an incomplete connection is what leaves the extension silently unable to reach
      // the NAS later, so the required fields are checked here rather than trusting `required`
      // on the inputs — nothing submits this form, so the browser never enforces them.
      const firstMissing = markMissingFields();
      if (firstMissing) {
        // Take the user to the problem rather than describing it and leaving them to look. The
        // field may live in a tab that isn't open, so switch there first or the focus is silently
        // dropped into a hidden panel.
        const field = REQUIRED_FIELDS.find((candidate) => candidate.id === firstMissing);
        if (field) activeTab = field.tab;
        await tick();
        document.getElementById(firstMissing)?.focus();
        showStatus("Fill in the highlighted fields before saving", "error");
        return;
      }

      normalizeRoutingRules();

      // The settings lock is independent of the NAS credentials: it guards this screen, and
      // never the background hand-off. Turning it on is the only case that needs a password.
      if (settingsLockEnabled && !lockWasEnabled) {
        if (lockPasswordInput.length < 8) {
          fieldErrors = { ...fieldErrors, lockPasswordInput: "Use at least 8 characters" };
          activeTab = "advanced";
          await tick();
          document.getElementById("lockPasswordInput")?.focus();
          showStatus("The settings password must be at least 8 characters long", "error");
          return;
        }
        if (lockPasswordInput !== confirmLockPasswordInput) {
          fieldErrors = { ...fieldErrors, confirmLockPasswordInput: "Passwords do not match" };
          activeTab = "advanced";
          await tick();
          document.getElementById("confirmLockPasswordInput")?.focus();
          showStatus("The settings passwords do not match", "error");
          return;
        }
      }

      await saveSettings($state.snapshot(form));

      if (settingsLockEnabled && !lockWasEnabled) {
        await enableSettingsLock(lockPasswordInput);
      } else if (!settingsLockEnabled && lockWasEnabled) {
        await disableSettingsLock();
      }

      lockWasEnabled = settingsLockEnabled;
      lockPasswordInput = "";
      confirmLockPasswordInput = "";

      connection = await readConnectionState(form);
      editingConnection = false;

      invalidateClientCache();
      applyTheme(form.theme);
      markClean();
      showStatus("Settings saved", "success");

      // Save and test are one action: settings that cannot reach the NAS should say so now,
      // not hours later when a download quietly fails.
      if (shouldVerifyConnection) await testConnection();
    } catch (error) {
      showStatus(`Failed to save settings: ${getErrorMessage(error)}`, "error");
    } finally {
      isSaving = false;
    }
  }

  /**
   * One action behind two labels: "Save & test" while editing, "Test connection" on the card.
   * A third "Connect" would imply a session that is held open, which none of this does.
   */
  async function testConnection(): Promise<void> {
    if (isTesting) return;

    try {
      isTesting = true;
      const client = await getApiClient({ settings: $state.snapshot(form) });
      await client.queryTasks({ params: { limit: 1 } });
      await recordSuccess();
      showStatus("Connected to the NAS", "success", { autoHideMs: 2500 });
    } catch (error) {
      await recordFailure(error);
      showStatus(getErrorMessage(error), "error");
    } finally {
      connection = await readConnectionState(form);
      isTesting = false;
    }
  }

  async function removeConnection(): Promise<void> {
    if (!confirm("Remove the saved NAS address, username and password? Downloads will no longer be sent to this NAS.")) {
      return;
    }

    await saveSettings({ NASaddress: "", NASlogin: "", NASpassword: "" });
    await clearConnectionHealth();
    form = await loadSettings();
    serverUrl = composeServerUrl(form);
    connection = await readConnectionState(form);
    editingConnection = false;
    markClean();
    showStatus("Connection removed", "info", { autoHideMs: 2500 });
  }

  const HEALTH_LABEL: Record<ConnectionState["health"]["kind"], string> = {
    unknown: "Not checked yet",
    ready: "Ready",
    unreachable: "NAS unreachable",
    "auth-failed": "Authentication failed",
  };

</script>

<div class="settings-stack">
{#if configProblem}
  <Alert tone="warning">
    {configProblem.summary} Downloads will stay in the browser until this is fixed.
  </Alert>
{/if}

<!-- Above the tabs, not inside one: the theme applies the moment it is picked, so it is not
     part of anything the Save button commits, and a tab holding a single instant control is
     navigation for its own sake. -->
<div class="settings-header">
  <span class="control-label">Theme</span>
  <SegmentedControl
    compact
    size="sm"
    label="Theme"
    items={[
      { value: "auto", label: "Follow system", icon: Monitor },
      { value: "light", label: "Light", icon: Sun },
      { value: "dark", label: "Dark", icon: Moon },
    ]}
    bind:value={form.theme}
    onActivate={(theme) => void chooseTheme(theme)}
  />
</div>

<Tabs tabs={TABS} active={activeTab} onActivate={(id) => (activeTab = id)}>
  {#snippet panels(tab)}
    {#if tab.id === "connection"}
<section class="settings-section">
  <FormSection legend="Connection">
  {#if !showConnectionForm}
    <!-- Configured: no inputs at all. Showing a password box permanently is what let an empty
         one overwrite a working password. -->
    <div class="connection-card">
      <p class="connection-identity">{form.NASlogin}@{form.NASaddress}</p>
      <p class="connection-health" class:problem={connection.health.kind !== "ready"}>
        {HEALTH_LABEL[connection.health.kind]}
      </p>
      {#if connection.health.kind === "unreachable"}
        <p class="text-muted">Saved connection settings are still in use.</p>
      {:else if connection.health.kind === "auth-failed"}
        <p class="text-muted">The NAS rejected the saved credentials.</p>
      {/if}

      <div class="connection-actions">
        <Button variant="secondary" disabled={isTesting} onclick={testConnection}>
          {isTesting ? "Testing…" : "Test connection"}
        </Button>
        <Button variant="secondary" onclick={() => (editingConnection = true)}>Edit</Button>
      </div>
      <div class="connection-actions">
        <Link size="small" onclick={removeConnection}>Remove connection</Link>
      </div>
    </div>
  {:else}
  <div class="form-group">
    <Field
      id="serverUrl"
      label="Server address"
      placeholder="http://192.168.1.100:8080"
      required
      bind:value={serverUrl}
      error={fieldErrors.serverUrl}
      oninput={(event) => syncServerUrl(event.currentTarget.value)}
      onblur={() => validateField("serverUrl")}
    />
  </div>

  <div class="form-group">
    <Field id="NASlogin" label="Username" placeholder="Your QNAP account" required bind:value={form.NASlogin} error={fieldErrors.NASlogin} onblur={() => validateField("NASlogin")} />
  </div>

  <div class="form-group">
    <Field id="NASpassword" label="Password" type="password" placeholder="Your QNAP password" required bind:value={form.NASpassword} error={fieldErrors.NASpassword} onblur={() => validateField("NASpassword")} />
  </div>
  {/if}
  </FormSection>

  <FormSection legend="Folders">
  <div class="form-group">
    <label for="NAStempdir">Temp Folder</label>
    <FolderSelect id="NAStempdir" placeholder="e.g. Download" settings={$state.snapshot(form)} bind:value={form.NAStempdir} bind:status={tempStatus} formError={fieldErrors.NAStempdir} />
  </div>

  <div class="form-group">
    <label for="NASdir">Target Folder</label>
    <FolderSelect id="NASdir" placeholder="e.g. Multimedia/Movies" settings={$state.snapshot(form)} bind:value={form.NASdir} bind:status={dirStatus} />
  </div>

  <div class="form-group form-inline">
    <!-- Two states, so a checkbox rather than a two-item select: the setting reads as the
         sentence it is, and needs no menu to discover what the alternative even is. -->
    <Checkbox
      id="torrentInterceptMode"
      checked={form.torrentInterceptMode === "always"}
      onchange={(event) => (form.torrentInterceptMode = event.currentTarget.checked ? "always" : "off")}
    >
      Send .torrent downloads to the NAS
    </Checkbox>
  </div>
  </FormSection>
</section>
    {:else if tab.id === "advanced"}
<section class="settings-section">
  <FormSection legend="Privacy">
  <div class="form-group form-inline">
    <Checkbox id="settingsLockEnabled" bind:checked={settingsLockEnabled}>
      Protect settings
    </Checkbox>
  </div>
  <Alert tone="hint">
    Require a password to view or change your NAS connection settings. Background downloads
    continue to work while settings are locked. This does not encrypt the stored password —
    protecting files on this computer is your operating system's job.
  </Alert>

  {#if settingsLockEnabled && !lockWasEnabled}
    <div class="form-group">
      <Field id="lockPasswordInput" label="Settings password" type="password" placeholder="At least 8 characters" bind:value={lockPasswordInput} error={fieldErrors.lockPasswordInput} oninput={() => {
        const { lockPasswordInput: _removed, ...rest } = fieldErrors;
        fieldErrors = rest;
      }} />
    </div>
    <div class="form-group">
      <Field id="confirmLockPasswordInput" label="Confirm settings password" type="password" placeholder="Repeat the settings password" bind:value={confirmLockPasswordInput} error={fieldErrors.confirmLockPasswordInput} oninput={() => {
        const { confirmLockPasswordInput: _removed, ...rest } = fieldErrors;
        fieldErrors = rest;
      }} />
    </div>
  {:else if settingsLockEnabled}
    <p class="text-muted">Settings password is active. Turn this off to remove it.</p>
  {/if}
  </FormSection>
</section>

<section class="settings-section">
  <FormSection legend="Routing rules">
  <div class="routing-header">
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
      <!-- Each rule is its own group with a name. Without it a screen reader reads three
           unlabelled controls per rule, with nothing saying where one rule ends. -->
      <fieldset class="routing-rule">
        <legend class="visually-hidden">Rule {i + 1}</legend>
        <div class="routing-conditions">
          <div class="routing-match-type">
            <Select aria-label={`Rule ${i + 1} match type`} value={rule.type ?? ""} onchange={(e) => setRuleType(i, e.currentTarget.value)}>
              <option value="">Any type</option>
              <option value="url">URL</option>
              <option value="magnet">Magnet</option>
              <option value="torrent">.torrent</option>
            </Select>
          </div>
          <div class="routing-text-field">
            <Field placeholder="e.g. *.mkv" aria-label={`Rule ${i + 1} filename pattern`} bind:value={rule.namePattern} />
          </div>
          <div class="routing-text-field">
            <Field placeholder="e.g. *.site.com" aria-label={`Rule ${i + 1} domain`} bind:value={rule.domain} />
          </div>
          <button type="button" class="rule-remove" aria-label={`Remove rule ${i + 1}`} title="Remove rule" onclick={() => removeRule(i)}>
            <X aria-hidden="true" />
          </button>
        </div>
        <FolderSelect id={`routing-${i}-destination`} placeholder="e.g. Multimedia/Films" settings={$state.snapshot(form)} bind:value={rule.destination} />
      </fieldset>
    {/each}
  {/if}
  </FormSection>
</section>

<section class="settings-section">
  <FormSection legend="Backup">
  <Alert tone="hint">Export or restore settings. Credentials are never included.</Alert>

  {#if pendingImport}
    <Alert tone="warning">
      Importing will overwrite your current settings: {pendingImport.changes.join(", ")}.
      Nothing is saved until you press Save.
    </Alert>
    <div class="backup-actions">
      <Button onclick={applyImport}>Replace settings</Button>
      <Button variant="secondary" onclick={() => (pendingImport = null)}>Cancel</Button>
    </div>
  {:else}
    <div class="backup-actions">
      <Button variant="secondary" onclick={exportBackup}>Export settings</Button>
      <Button variant="secondary" onclick={() => importInput?.click()}>Import settings</Button>
    </div>
  {/if}

  <!-- Named because the popup has another file input (torrent upload); an unqualified
       `input[type=file]` selector reaches the wrong one. -->
  <input id="import-input" bind:this={importInput} type="file" accept="application/json,.json" hidden onchange={importBackup} />
  </FormSection>
</section>
    {/if}
  {/snippet}
</Tabs>

<footer class="settings-actions">
  <div class="settings-action-buttons">
    <Button id="save-btn" disabled={!isDirty || isSaving} onclick={save}>
      {isSaving ? "Saving…" : showConnectionForm ? "Save & test" : "Save settings"}
    </Button>
  </div>
</footer>

<p class="version-line">Version {chrome.runtime.getManifest().version}</p>
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


  .routing-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
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

  /* Present to assistive tech, absent visually — the rules are positional on screen. */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .routing-rule {
    border: none;
    margin: 0;
    padding: 0;
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
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .connection-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .connection-identity {
    margin: 0;
    font-weight: 600;
  }

  .connection-health {
    margin: 0;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .connection-health.problem {
    color: var(--color-warning);
  }

  .connection-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    margin-top: var(--space-1);
  }

  .version-line {
    margin: var(--space-3) 0 var(--space-2);
    text-align: center;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .control-label {
    font-size: 13px;
  }

</style>
