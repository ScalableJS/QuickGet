<script lang="ts">
  import { tick, untrack } from "svelte";
  import ChevronDown from "~icons/lucide/chevron-down";
  import ChevronUp from "~icons/lucide/chevron-up";
  import Monitor from "~icons/lucide/monitor";
  import Moon from "~icons/lucide/moon";
  import Plus from "~icons/lucide/plus";
  import Sun from "~icons/lucide/sun";
  import X from "~icons/lucide/x";

  import { showStatus } from "@/popup/components";
  import { applyTheme } from "@lib/applyTheme.js";
  import { DEFAULTS, type Settings, type ThemeMode } from "@lib/config.js";
  import { getErrorMessage } from "@lib/errors.js";
  import {
    type RoutingRule,
    type RoutingRuleDraft,
    serializeRoutingRuleDraft,
    toRoutingRuleDraft,
    validateRoutingRuleDraft,
  } from "@lib/routingRules.js";
  import type { SourceKind } from "@lib/sourceKind.js";
  import { findConfigProblem } from "@lib/configHealth.js";
  import { connectionFailure, type ConnectionState, readConnectionState } from "@lib/connectionHealth.js";
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

  /**
   * Whether the browser can hold a download at the filename stage. Chrome can; Firefox has
   * never implemented `downloads.onDeterminingFilename` (Bugzilla 1245652, open since 2016),
   * and offering a switch that silently does nothing there is worse than not offering it.
   */
  const supportsFilenameHold = typeof chrome !== "undefined" && Boolean(chrome.downloads?.onDeterminingFilename);

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
    { id: "NAStempdir", label: "Temp folder", value: () => form.NAStempdir, tab: "connection" },
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

  let routingRuleDrafts = $state<RoutingRuleDraft[]>([]);
  let routingErrors = $state<Record<string, { destination?: string; conditions?: string }>>({});

  function settingsSignature(): string {
    // The theme is applied and stored the moment it is picked, so it must not make the form
    // dirty — a preference that takes effect immediately has nothing left to save.
    const { theme: _appliedImmediately, routingRules: _storedRules, ...pending } = form;
    return JSON.stringify({
      form: pending,
      routingRuleDrafts,
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

  /** Mirrors the id `Field` derives for its error message, so siblings can point at it. */
  function conditionErrorId(index: number): string {
    return `routing-${index}-namePattern-error`;
  }

  function clearDraftError(id: string, field: "destination" | "conditions"): void {
    if (!routingErrors[id]) return;
    const current = { ...routingErrors[id] };
    delete current[field];
    if (!current.destination && !current.conditions) {
      const next = { ...routingErrors };
      delete next[id];
      routingErrors = next;
    } else {
      routingErrors = { ...routingErrors, [id]: current };
    }
  }

  async function addRule(): Promise<void> {
    const newDraft = toRoutingRuleDraft({ destination: "" });
    routingRuleDrafts = [...routingRuleDrafts, newDraft];
    // The new card appears at the bottom of a scrolling list while focus stays on the button.
    // Without moving it, adding a rule is indistinguishable from a no-op without sight.
    const index = routingRuleDrafts.length - 1;
    await tick();
    document.getElementById(`routing-${index}-type`)?.focus();
    showStatus(`Rule ${index + 1} added`, "info", { autoHideMs: 2000 });
  }

  function removeRule(index: number): void {
    const removed = routingRuleDrafts[index];
    routingRuleDrafts.splice(index, 1);
    if (removed && routingErrors[removed.id]) {
      const next = { ...routingErrors };
      delete next[removed.id];
      routingErrors = next;
    }
    // Removing a row is silent otherwise: focus moves and nothing says what happened.
    showStatus(`Rule ${index + 1} removed`, "info", { autoHideMs: 2000 });
  }

  /**
   * Priority order is the whole meaning of a rule set — first match wins — so changing it
   * cannot be silent, and it cannot cost the keyboard user their place: the button that did the
   * move is disabled the moment the rule reaches an end, and Chrome then drops focus to <body>.
   */
  async function moveRule(index: number, delta: -1 | 1): Promise<void> {
    const target = index + delta;
    if (target < 0 || target >= routingRuleDrafts.length) return;

    const copy = [...routingRuleDrafts];
    const moved = copy[index];
    copy[index] = copy[target];
    copy[target] = moved;
    routingRuleDrafts = copy;

    const direction = delta < 0 ? "up" : "down";
    showStatus(`Rule ${index + 1} moved ${direction} — now rule ${target + 1}`, "info", { autoHideMs: 2000 });

    await tick();
    focusMoveControl(target, direction);
  }

  /** Prefer the button that was just used; fall back to its sibling when it is now disabled. */
  function focusMoveControl(index: number, direction: "up" | "down"): void {
    const preferred = document.getElementById(`routing-${index}-move-${direction}`);
    if (preferred instanceof HTMLButtonElement && !preferred.disabled) {
      preferred.focus();
      return;
    }
    document.getElementById(`routing-${index}-move-${direction === "up" ? "down" : "up"}`)?.focus();
  }

  function setRuleType(index: number, raw: string): void {
    const nextType = raw === "" || raw === "all" ? "all" : (raw as SourceKind);
    routingRuleDrafts[index].type = nextType;
    clearDraftError(routingRuleDrafts[index].id, "conditions");
  }

  let importInput = $state<HTMLInputElement | null>(null);

  function exportBackup(): void {
    const backupForm = {
      ...form,
      routingRules: routingRuleDrafts
        .map(serializeRoutingRuleDraft)
        .filter((r): r is RoutingRule => r !== null),
    };
    const json = exportSettings($state.snapshot(backupForm));
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
    routingRuleDrafts = form.routingRules.map((r) => toRoutingRuleDraft(r));
    routingErrors = {};
    pendingImport = null;
    showStatus("Settings imported — review and Save", "success", { autoHideMs: 2500 });
  }

  export async function load(): Promise<void> {
    try {
      form = await loadSettings();
      routingRuleDrafts = form.routingRules.map((r) => toRoutingRuleDraft(r));
      routingErrors = {};
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

      // Validate all routing rule drafts before touching storage or form
      const newRoutingErrors: Record<string, { destination?: string; conditions?: string }> = {};
      let firstInvalidDraftId: string | null = null;
      let firstInvalidFieldId: string | null = null;

      for (let i = 0; i < routingRuleDrafts.length; i++) {
        const draft = routingRuleDrafts[i];
        const validation = validateRoutingRuleDraft(draft);
        if (!validation.valid) {
          newRoutingErrors[draft.id] = validation.errors;
          if (!firstInvalidDraftId) {
            firstInvalidDraftId = draft.id;
            firstInvalidFieldId = validation.errors.destination
              ? `routing-${i}-destination`
              : `routing-${i}-namePattern`;
          }
        }
      }

      if (firstInvalidDraftId) {
        routingErrors = newRoutingErrors;
        activeTab = "advanced";
        await tick();
        if (firstInvalidFieldId) {
          document.getElementById(firstInvalidFieldId)?.focus();
        }
        showStatus("Fix the highlighted routing rule errors before saving", "error");
        return;
      }

      routingErrors = {};
      const serializedRules = routingRuleDrafts
        .map(serializeRoutingRuleDraft)
        .filter((r): r is RoutingRule => r !== null);
      form.routingRules = serializedRules;

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

      routingRuleDrafts = serializedRules.map((r) => toRoutingRuleDraft(r));
      routingErrors = {};

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
      const now = Date.now();
      connection = { configured: true, health: { kind: "ready", lastCheckedAt: now, lastSuccessAt: now } };
      showStatus("Connected to the NAS", "success", { autoHideMs: 2500 });
    } catch (error) {
      connection = { configured: findConfigProblem(form) === undefined, health: connectionFailure(error) };
      showStatus(getErrorMessage(error), "error");
    } finally {
      isTesting = false;
    }
  }

  async function removeConnection(): Promise<void> {
    if (!confirm("Remove saved connection? Downloads will no longer be sent to this NAS.")) {
      return;
    }

    await saveSettings({ NASaddress: "", NASlogin: "", NASpassword: "" });
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

<div class="settings-stack flex flex-col pb-0">
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
      { value: "auto", label: "System", icon: Monitor },
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
        <p class="text-[0.85rem] text-[var(--text-secondary)]">Saved connection settings still active.</p>
      {:else if connection.health.kind === "auth-failed"}
        <p class="text-[0.85rem] text-[var(--text-secondary)]">NAS rejected saved credentials.</p>
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
    <Field id="NASlogin" label="Username" placeholder="QNAP username" required bind:value={form.NASlogin} error={fieldErrors.NASlogin} onblur={() => validateField("NASlogin")} />
  </div>

  <div class="form-group mb-[var(--spacing-md)]">
    <Field id="NASpassword" label="Password" type="password" placeholder="Password" required bind:value={form.NASpassword} error={fieldErrors.NASpassword} onblur={() => validateField("NASpassword")} />
  </div>
  {/if}
  </FormSection>

  <FormSection legend="Folders">
  <div class="form-group mb-[var(--spacing-md)]">
    <label for="NAStempdir" class="block font-500 mb-[var(--spacing-sm)] text-[var(--color-text)]">Temp folder</label>
    <FolderSelect id="NAStempdir" placeholder="e.g. Download" settings={$state.snapshot(form)} bind:value={form.NAStempdir} bind:status={tempStatus} formError={fieldErrors.NAStempdir} />
  </div>

  <div class="form-group mb-[var(--spacing-md)]">
    <label for="NASdir" class="block font-500 mb-[var(--spacing-sm)] text-[var(--color-text)]">Target folder</label>
    <FolderSelect id="NASdir" placeholder="e.g. Multimedia/Movies" settings={$state.snapshot(form)} bind:value={form.NASdir} bind:status={dirStatus} />
  </div>

  <div class="form-group mb-[var(--spacing-md)] flex flex-col gap-[var(--spacing-sm)]">
    <!-- Two states, so a checkbox rather than a two-item select: the setting reads as the
         sentence it is, and needs no menu to discover what the alternative even is. -->
    <div class="form-inline flex items-center gap-[var(--spacing-sm)] font-500">
      <Checkbox
        id="torrentInterceptMode"
        aria-describedby="shiftClickHint"
        checked={form.torrentInterceptMode === "always"}
        onchange={(event) => (form.torrentInterceptMode = event.currentTarget.checked ? "always" : "off")}
      >
        Send .torrent downloads to NAS
      </Checkbox>
    </div>
    <!-- The gesture is worth a line here because nobody discovers a modifier on their own, and it
         is what makes these checkboxes low-stakes: leave them off and still send a link at will. -->
    <p id="shiftClickHint" class="m-0 ml-[var(--spacing-lg)] text-12px text-[var(--color-text-secondary)]">
      Hold <kbd class="font-600">Shift</kbd> when clicking any torrent or magnet link to send just that
      one — whether these are on or off.
    </p>

    <!-- A refinement of the setting above, not a peer: kept visible but disabled until
         interception is on, so its effect stays discoverable while the dependency stays clear.
         Chrome-only — Firefox has no `downloads.onDeterminingFilename`, so the control is hidden
         there instead of being shown dead. -->
    {#if supportsFilenameHold}
      <div class="ml-[var(--spacing-lg)]">
        <Checkbox
          id="suppressLocalTorrentFile"
          disabled={form.torrentInterceptMode !== "always"}
          aria-describedby="suppressLocalTorrentFileHint"
          bind:checked={form.suppressLocalTorrentFile}
        >
          Don't save .torrent locally
        </Checkbox>
        <div class="mt-[var(--spacing-xs)] ml-[var(--spacing-lg)]">
          {#if form.torrentInterceptMode === "always"}
            <p id="suppressLocalTorrentFileHint" class="m-0 text-12px text-[var(--color-text-secondary)]">
              Sends torrent directly to NAS without saving locally. If the transfer fails, download locally.
            </p>
          {:else}
            <p id="suppressLocalTorrentFileHint" class="m-0 text-12px text-[var(--color-text-secondary)]">
              Requires .torrent interception.
            </p>
          {/if}
        </div>
      </div>
    {/if}

    <div class="form-inline flex items-center gap-[var(--spacing-sm)] font-500 mt-[var(--spacing-sm)]">
      <Checkbox
        id="autoCaptureMagnets"
        aria-describedby="autoCaptureMagnetsHint"
        bind:checked={form.autoCaptureMagnets}
      >
        Intercept magnet links
      </Checkbox>
    </div>
    <div class="ml-[var(--spacing-lg)]">
      <p id="autoCaptureMagnetsHint" class="m-0 text-12px text-[var(--color-text-secondary)]">
        Send clicked magnet links to Download Station instead of local app.
      </p>
    </div>
  </div>
  </FormSection>
</section>
    {:else if tab.id === "advanced"}
<section class="settings-section">
  <FormSection legend="Security">
  <div class="form-group form-inline mb-[var(--spacing-md)] flex items-center gap-[var(--spacing-sm)] font-500">
    <Checkbox id="settingsLockEnabled" bind:checked={settingsLockEnabled}>
      Lock settings with password
    </Checkbox>
  </div>
  <Alert tone="hint">
    Require a password to view or change settings. Background downloads continue while locked.
  </Alert>

  {#if settingsLockEnabled && !lockWasEnabled}
    <div class="form-group mb-[var(--spacing-md)]">
      <Field id="lockPasswordInput" label="Settings password" type="password" placeholder="At least 8 characters" bind:value={lockPasswordInput} error={fieldErrors.lockPasswordInput} oninput={() => {
        const { lockPasswordInput: _removed, ...rest } = fieldErrors;
        fieldErrors = rest;
      }} />
    </div>
    <div class="form-group mb-[var(--spacing-md)]">
      <Field id="confirmLockPasswordInput" label="Confirm password" type="password" placeholder="Repeat password" bind:value={confirmLockPasswordInput} error={fieldErrors.confirmLockPasswordInput} oninput={() => {
        const { confirmLockPasswordInput: _removed, ...rest } = fieldErrors;
        fieldErrors = rest;
      }} />
    </div>
  {:else if settingsLockEnabled}
    <p class="text-[0.85rem] text-[var(--text-secondary)]">Password lock is active. Uncheck to remove.</p>
  {/if}
  </FormSection>
</section>

<section class="settings-section">
  <FormSection legend="Routing rules">
  <div class="routing-header flex items-center justify-between mb-[var(--space-2)]">
    <button type="button" class="add-rule inline-flex items-center gap-[var(--space-1)] p-0 border-0 bg-transparent text-[var(--color-primary)] text-[0.8rem] cursor-pointer no-underline hover:text-[color-mix(in_srgb,var(--color-primary)_75%,black)]" onclick={addRule}><Plus aria-hidden="true" />Add rule</button>
  </div>
  <!-- Said once for the whole section. It was on every rule card, which turned three rules into
       three copies of the same paragraph. -->
  <Alert tone="hint">
    Route downloads to folders automatically. First matching rule wins. Unmatched downloads use the Target folder.
    List several values in a field — <code>mkv mp4 avi</code>, <code>rutracker.org nnmclub.to</code> — and any one of
    them matches. Use <code>*</code> for anything that is not an extension: <code>*S0?E0?*</code>, <code>*1080p*</code>.
  </Alert>

  {#if routingRuleDrafts.length === 0}
    <p class="routing-empty text-12px text-[var(--text-secondary)]">No rules yet. All downloads use the Target folder.</p>
  {:else}
    <div class="routing-rules-list flex flex-col gap-[var(--space-3)] mt-[var(--space-2)]">
      {#each routingRuleDrafts as draft, i (draft.id)}
        {@const draftError = routingErrors[draft.id]}
        <fieldset
          class={[
            "routing-rule flex flex-col gap-[var(--space-2)] p-[var(--space-2)] rounded-[var(--radius)] border border-solid border-[var(--color-control-border)] bg-[var(--color-bg-alt)] transition-[border-color,box-shadow] duration-[var(--duration-fast)]",
            (draftError?.destination || draftError?.conditions) && "!border-[var(--color-error)]"
          ]}
        >
          <legend class="sr-only">Rule {i + 1}</legend>
          <div class="routing-rule-header flex items-center justify-between pb-1 border-b border-solid border-[var(--color-control-border)]">
            <!-- The legend above already names the group; repeating it would announce twice. -->
            <span class="font-600 text-12px text-[var(--color-text)]" aria-hidden="true">Rule {i + 1}</span>
            <!-- The destructive control is deliberately not in the same group as the two
                 navigational ones: `↑ ↓ ✕` as three identical 28px buttons 4px apart put "reorder"
                 and "delete for good" a mis-click away from each other, and there is no undo. -->
            <div class="routing-rule-actions flex items-center gap-[var(--space-3)]">
              <div class="flex items-center gap-1">
                <IconButton
                  id={`routing-${i}-move-up`}
                  size="sm"
                  aria-label={`Move rule ${i + 1} up`}
                  title="Move up"
                  disabled={i === 0}
                  onclick={() => moveRule(i, -1)}
                >
                  <ChevronUp aria-hidden="true" />
                </IconButton>
                <IconButton
                  id={`routing-${i}-move-down`}
                  size="sm"
                  aria-label={`Move rule ${i + 1} down`}
                  title="Move down"
                  disabled={i === routingRuleDrafts.length - 1}
                  onclick={() => moveRule(i, 1)}
                >
                  <ChevronDown aria-hidden="true" />
                </IconButton>
              </div>
              <IconButton
                size="sm"
                class="text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_12%,var(--color-bg-alt))]"
                aria-label={`Remove rule ${i + 1}`}
                title="Remove rule"
                onclick={() => removeRule(i)}
              >
                <X aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          <!-- IF section: conditions -->
          <div class="routing-conditions flex flex-col gap-[var(--space-1)]">
            <div class="flex items-center justify-between text-11px font-600 text-[var(--text-secondary)] uppercase tracking-wider">
              <span>If</span>
              <span class="text-11px font-normal normal-case">all filled conditions must match</span>
            </div>
            <!-- Headers rather than placeholders: a placeholder stops being a label the moment
                 anything is typed, which is exactly when you need to know which field is which. -->
            <div class="grid grid-cols-3 gap-[var(--space-1)] text-11px text-[var(--text-secondary)]" aria-hidden="true">
              <span>Source</span>
              <span>Name or extension</span>
              <span>Site</span>
            </div>
            <div class="grid grid-cols-3 gap-[var(--space-1)]">
              <div class="routing-match-type min-w-0">
                <Select
                  id={`routing-${i}-type`}
                  size="sm"
                  aria-label={`Rule ${i + 1} match type`}
                  aria-invalid={draftError?.conditions ? "true" : undefined}
                  aria-describedby={draftError?.conditions ? conditionErrorId(i) : undefined}
                  value={draft.type}
                  onchange={(e) => setRuleType(i, e.currentTarget.value)}
                >
                  <option value="all">Any type</option>
                  <option value="url">URL</option>
                  <option value="magnet">Magnet</option>
                  <option value="torrent">.torrent</option>
                </Select>
              </div>
              <div class="routing-text-field min-w-0">
                <!-- The condition error belongs to the group, but it has to live on a control
                     to be announced: `Field` renders it, and the other two point at it. -->
                <Field
                  id={`routing-${i}-namePattern`}
                  size="sm"
                  placeholder="mkv mp4 avi"
                  aria-label={`Rule ${i + 1} name or extension`}
                  error={draftError?.conditions}
                  bind:value={draft.namePattern}
                  oninput={() => clearDraftError(draft.id, "conditions")}
                />
              </div>
              <div class="routing-text-field min-w-0">
                <Field
                  id={`routing-${i}-domain`}
                  size="sm"
                  placeholder="rutracker.org"
                  aria-label={`Rule ${i + 1} site`}
                  aria-invalid={draftError?.conditions ? "true" : undefined}
                  aria-describedby={draftError?.conditions ? conditionErrorId(i) : undefined}
                  bind:value={draft.domain}
                  oninput={() => clearDraftError(draft.id, "conditions")}
                />
              </div>
            </div>
            {#if draft.type === "magnet"}
              <p class="m-0 text-11px text-[var(--text-secondary)] italic">
                A magnet has no site of its own, so Site matches the page it was clicked on.
              </p>
            {/if}
          </div>

          <!-- THEN SAVE TO section: destination -->
          <div class="routing-then flex flex-col gap-[var(--space-1)]">
            <span class="text-11px font-600 text-[var(--text-secondary)] uppercase tracking-wider">Then save to</span>
            <FolderSelect
              id={`routing-${i}-destination`}
              placeholder="e.g. Multimedia/Movies"
              settings={$state.snapshot(form)}
              bind:value={draft.destination}
              formError={draftError?.destination}
              oninput={() => clearDraftError(draft.id, "destination")}
            />
          </div>
        </fieldset>
      {/each}
    </div>
  {/if}
  </FormSection>
</section>

<section class="settings-section">
  <FormSection legend="Backup">
  <Alert tone="hint">Export or import settings. Credentials are never included.</Alert>

  {#if pendingImport}
    <Alert tone="warning">
      This will overwrite current settings: {pendingImport.changes.join(", ")}.
      Review and click Save to apply.
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

<p class="version-line mt-[var(--space-1)] mb-0 text-center text-11px text-[var(--text-secondary)]">Version {chrome.runtime.getManifest().version}</p>
</div>
