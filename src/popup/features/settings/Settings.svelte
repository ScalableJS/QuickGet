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
  import { Alert, Button, Checkbox, Field, FormSection, IconButton, Link, SegmentedControl, Select, Tabs } from "@ui";

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

<div class="settings-stack flex flex-col pb-[var(--space-5)]">
{#if configProblem}
  <Alert tone="warning">
    {configProblem.summary} Downloads will stay in the browser until this is fixed.
  </Alert>
{/if}

<!-- Above the tabs, not inside one: the theme applies the moment it is picked, so it is not
     part of anything the Save button commits, and a tab holding a single instant control is
     navigation for its own sake. -->
<div class="settings-header flex items-center justify-between gap-[var(--space-2)] mb-[var(--space-2)]">
  <span class="control-label text-13px">Theme</span>
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
    <div class="connection-card flex flex-col gap-[var(--space-1)]">
      <p class="connection-identity m-0 font-600">{form.NASlogin}@{form.NASaddress}</p>
      <p class={["connection-health m-0 text-12px", connection.health.kind !== "ready" ? "text-[var(--color-warning)]" : "text-[var(--text-secondary)]"]}>
        {HEALTH_LABEL[connection.health.kind]}
      </p>
      {#if connection.health.kind === "unreachable"}
        <p class="text-[0.85rem] text-[var(--text-secondary)]">Saved connection settings are still in use.</p>
      {:else if connection.health.kind === "auth-failed"}
        <p class="text-[0.85rem] text-[var(--text-secondary)]">The NAS rejected the saved credentials.</p>
      {/if}

      <div class="connection-actions flex gap-[var(--space-2)] items-center mt-[var(--space-1)]">
        <Button variant="secondary" disabled={isTesting} onclick={testConnection}>
          {isTesting ? "Testing…" : "Test connection"}
        </Button>
        <Button variant="secondary" onclick={() => (editingConnection = true)}>Edit</Button>
      </div>
      <div class="connection-actions flex gap-[var(--space-2)] items-center mt-[var(--space-1)]">
        <Link size="small" onclick={removeConnection}>Remove connection</Link>
      </div>
    </div>
  {:else}
  <div class="form-group mb-[var(--spacing-md)]">
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

  <div class="form-group mb-[var(--spacing-md)]">
    <Field id="NASlogin" label="Username" placeholder="Your QNAP account" required bind:value={form.NASlogin} error={fieldErrors.NASlogin} onblur={() => validateField("NASlogin")} />
  </div>

  <div class="form-group mb-[var(--spacing-md)]">
    <Field id="NASpassword" label="Password" type="password" placeholder="Your QNAP password" required bind:value={form.NASpassword} error={fieldErrors.NASpassword} onblur={() => validateField("NASpassword")} />
  </div>
  {/if}
  </FormSection>

  <FormSection legend="Folders">
  <div class="form-group mb-[var(--spacing-md)]">
    <label for="NAStempdir" class="block font-500 mb-[var(--spacing-sm)] text-[var(--color-text)]">Temp Folder</label>
    <FolderSelect id="NAStempdir" placeholder="e.g. Download" settings={$state.snapshot(form)} bind:value={form.NAStempdir} bind:status={tempStatus} formError={fieldErrors.NAStempdir} />
  </div>

  <div class="form-group mb-[var(--spacing-md)]">
    <label for="NASdir" class="block font-500 mb-[var(--spacing-sm)] text-[var(--color-text)]">Target Folder</label>
    <FolderSelect id="NASdir" placeholder="e.g. Multimedia/Movies" settings={$state.snapshot(form)} bind:value={form.NASdir} bind:status={dirStatus} />
  </div>

  <div class="form-group form-inline mb-[var(--spacing-md)] flex items-center gap-[var(--spacing-sm)] font-500">
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
  <div class="form-group form-inline mb-[var(--spacing-md)] flex items-center gap-[var(--spacing-sm)] font-500">
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
    <div class="form-group mb-[var(--spacing-md)]">
      <Field id="lockPasswordInput" label="Settings password" type="password" placeholder="At least 8 characters" bind:value={lockPasswordInput} error={fieldErrors.lockPasswordInput} oninput={() => {
        const { lockPasswordInput: _removed, ...rest } = fieldErrors;
        fieldErrors = rest;
      }} />
    </div>
    <div class="form-group mb-[var(--spacing-md)]">
      <Field id="confirmLockPasswordInput" label="Confirm settings password" type="password" placeholder="Repeat the settings password" bind:value={confirmLockPasswordInput} error={fieldErrors.confirmLockPasswordInput} oninput={() => {
        const { confirmLockPasswordInput: _removed, ...rest } = fieldErrors;
        fieldErrors = rest;
      }} />
    </div>
  {:else if settingsLockEnabled}
    <p class="text-[0.85rem] text-[var(--text-secondary)]">Settings password is active. Turn this off to remove it.</p>
  {/if}
  </FormSection>
</section>

<section class="settings-section">
  <FormSection legend="Routing rules">
  <div class="routing-header flex items-center justify-between mb-[var(--space-2)]">
    <button type="button" class="add-rule inline-flex items-center gap-[var(--space-1)] p-0 border-0 bg-transparent text-[var(--color-primary)] text-[0.8rem] cursor-pointer no-underline hover:text-[color-mix(in_srgb,var(--color-primary)_75%,black)]" onclick={addRule}><Plus aria-hidden="true" />Add rule</button>
  </div>
  <Alert tone="hint">
    Send matching downloads to a folder automatically. Rules run top to bottom; the first match wins.
    Everything else uses the Target Folder.
  </Alert>

  {#if form.routingRules.length === 0}
    <p class="routing-empty text-12px text-[var(--text-secondary)]">No rules yet. All downloads use the Target Folder.</p>
  {:else}
    {#each form.routingRules as rule, i (rule)}
      <!-- Each rule is its own group with a name. Without it a screen reader reads three
           unlabelled controls per rule, with nothing saying where one rule ends. -->
      <fieldset class="routing-rule flex flex-col gap-[var(--space-1)] py-[var(--space-2)] border-0 m-0 p-0 min-w-0">
        <legend class="visually-hidden sr-only">Rule {i + 1}</legend>
        <div class="routing-conditions flex gap-[var(--space-1)] items-center">
          <div class="routing-match-type flex-1 min-w-0">
            <Select aria-label={`Rule ${i + 1} match type`} value={rule.type ?? ""} onchange={(e) => setRuleType(i, e.currentTarget.value)}>
              <option value="">Any type</option>
              <option value="url">URL</option>
              <option value="magnet">Magnet</option>
              <option value="torrent">.torrent</option>
            </Select>
          </div>
          <div class="routing-text-field flex-1 min-w-0">
            <Field placeholder="e.g. *.mkv" aria-label={`Rule ${i + 1} filename pattern`} bind:value={rule.namePattern} />
          </div>
          <div class="routing-text-field flex-1 min-w-0">
            <Field placeholder="e.g. *.site.com" aria-label={`Rule ${i + 1} domain`} bind:value={rule.domain} />
          </div>
          <IconButton class="flex-none text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_12%,var(--color-bg-alt))]" aria-label={`Remove rule ${i + 1}`} title="Remove rule" onclick={() => removeRule(i)}>
            <X aria-hidden="true" />
          </IconButton>
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
    <div class="backup-actions flex flex-col gap-[var(--space-2)] mt-[var(--space-3)]">
      <Button onclick={applyImport} block>Replace settings</Button>
      <Button variant="secondary" onclick={() => (pendingImport = null)} block>Cancel</Button>
    </div>
  {:else}
    <div class="backup-actions flex flex-col gap-[var(--space-2)] mt-[var(--space-3)]">
      <Button variant="secondary" onclick={exportBackup} block>Export settings</Button>
      <Button variant="secondary" onclick={() => importInput?.click()} block>Import settings</Button>
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

<footer class="settings-actions sticky bottom-0 z-10 flex items-center gap-[var(--space-2)] py-[var(--space-3)] bg-[var(--color-bg)]">
  <div class="settings-action-buttons flex flex-1 gap-[var(--space-2)]">
    <Button id="save-btn" disabled={!isDirty || isSaving} onclick={save}>
      {isSaving ? "Saving…" : showConnectionForm ? "Save & test" : "Save settings"}
    </Button>
  </div>
</footer>

<p class="version-line my-[var(--space-3)] mb-[var(--space-2)] text-center text-11px text-[var(--text-secondary)]">Version {chrome.runtime.getManifest().version}</p>
</div>
