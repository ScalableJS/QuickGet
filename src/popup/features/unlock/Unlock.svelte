<script lang="ts">
  import { showStatus } from "@/popup/components";
  import { getErrorMessage } from "@lib/errors.js";
  import { resetSettings } from "@lib/settings.js";
  import { unlockSettings } from "@lib/settingsLock.js";
  import { Button, Link } from "@ui";

  let { onUnlock }: { onUnlock: () => void } = $props();

  let settingsPassword = $state("");
  let isUnlocking = $state(false);

  function focusOnMount(node: HTMLInputElement): void {
    node.focus();
  }

  async function handleUnlock(): Promise<void> {
    if (!settingsPassword) {
      showStatus("Please enter your settings password", "error");
      return;
    }

    try {
      isUnlocking = true;
      if (await unlockSettings(settingsPassword)) {
        onUnlock();
      } else {
        showStatus("Incorrect settings password", "error");
      }
    } catch (error) {
      showStatus(`Unlock error: ${getErrorMessage(error)}`, "error");
    } finally {
      isUnlocking = false;
    }
  }

  async function handleReset(): Promise<void> {
    if (confirm("Are you sure you want to reset all settings? This will clear your NAS configuration.")) {
      try {
        await resetSettings();
        showStatus("Settings reset to defaults", "success", { autoHideMs: 1500 });
        // Reload the extension popup to start fresh
        window.location.reload();
      } catch (error) {
        showStatus(`Reset error: ${getErrorMessage(error)}`, "error");
      }
    }
  }
</script>

<div class="unlock-container py-6 px-4 flex flex-col text-center">
  <div class="unlock-header mb-6">
    <div class="unlock-icon mx-auto mb-4 text-[var(--color-primary)] flex justify-center">
      <!-- A beautiful SVG lock icon -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    <h2 class="text-[1.25rem] font-600 m-0 mb-2 text-[var(--text-primary)]">Settings are locked</h2>
    <p class="subtitle text-[0.85rem] text-[var(--text-secondary)] m-0">Enter your settings password to view or change the NAS connection.</p>
    <p class="subtitle text-[0.85rem] text-[var(--text-secondary)] m-0">Background downloads continue to work while settings are locked.</p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); void handleUnlock(); }}>
    <div class="form-group mb-5">
      <input
        type="password"
        id="settingsPassword"
        placeholder="Settings password"
        required
        class="w-full px-3 py-[10px] border border-solid border-transparent rounded-[var(--radius)] bg-[var(--textbox-bg)] text-[var(--textbox-text)] text-[0.95rem] box-border transition-[background-color,border-color,box-shadow] duration-[var(--duration-fast)] hover:border-[var(--color-control-border)] focus:outline-none focus:border-[var(--color-primary-visual)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus-ring)_28%,transparent)]"
        bind:value={settingsPassword}
        disabled={isUnlocking}
        use:focusOnMount
      />
    </div>

    <Button type="submit" block disabled={isUnlocking}>
      {isUnlocking ? "Unlocking…" : "Unlock settings"}
    </Button>
  </form>

  <div class="unlock-footer mt-6">
    <Link size="small" onclick={handleReset}>Forgot it? Reset all settings</Link>
  </div>
</div>
