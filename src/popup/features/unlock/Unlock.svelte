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

<div class="unlock-container">
  <div class="unlock-header">
    <div class="unlock-icon">
      <!-- A beautiful SVG lock icon -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    <h2>Settings are locked</h2>
    <p class="subtitle">Enter your settings password to view or change the NAS connection.</p>
    <p class="subtitle">Background downloads continue to work while settings are locked.</p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); void handleUnlock(); }}>
    <div class="form-group">
      <input
        type="password"
        id="settingsPassword"
        placeholder="Settings password"
        required
        bind:value={settingsPassword}
        disabled={isUnlocking}
        use:focusOnMount
      />
    </div>

    <Button type="submit" block disabled={isUnlocking}>
      {isUnlocking ? "Unlocking…" : "Unlock settings"}
    </Button>
  </form>

  <div class="unlock-footer">
    <Link size="small" onclick={handleReset}>Forgot it? Reset all settings</Link>
  </div>
</div>

<style>
  .unlock-container {
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }

  .unlock-header {
    margin-bottom: 24px;
  }

  .unlock-icon {
    margin: 0 auto 16px;
    color: var(--color-primary);
    display: flex;
    justify-content: center;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-primary);
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .form-group {
    margin-bottom: 20px;
  }

  input[type="password"] {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background-color: var(--textbox-bg);
    color: var(--textbox-text);
    font-size: 0.95rem;
    box-sizing: border-box;
    transition: border-color 0.15s ease-in-out;
  }

  input[type="password"]:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .unlock-footer {
    margin-top: 24px;
  }

</style>
