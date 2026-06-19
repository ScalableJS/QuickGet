<script lang="ts">
  import { showStatus } from "@/popup/components";
  import { getErrorMessage } from "@lib/errors.js";
  import { resetSettings, unlock } from "@lib/settings.js";

  let { onUnlock }: { onUnlock: () => void } = $props();

  let masterPassword = $state("");
  let isUnlocking = $state(false);

  function focusOnMount(node: HTMLInputElement): void {
    node.focus();
  }

  async function handleUnlock(): Promise<void> {
    if (!masterPassword) {
      showStatus("Please enter your master password", "error");
      return;
    }

    try {
      isUnlocking = true;
      const success = await unlock(masterPassword);
      if (success) {
        // Cache master password in session storage so saving settings works seamlessly
        await chrome.storage.session.set({ cachedMasterPassword: masterPassword });
        showStatus("Unlocked successfully", "success", { autoHideMs: 1500 });
        onUnlock();
      } else {
        showStatus("Incorrect master password", "error");
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
    <h2>QuickGet is Locked</h2>
    <p class="subtitle">Enter your master password to unlock your credentials</p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); void handleUnlock(); }}>
    <div class="form-group">
      <input
        type="password"
        id="masterPassword"
        placeholder="Master Password"
        required
        bind:value={masterPassword}
        disabled={isUnlocking}
        use:focusOnMount
      />
    </div>

    <button type="submit" class="btn btn-primary btn-block" disabled={isUnlocking}>
      {isUnlocking ? "Unlocking..." : "Unlock"}
    </button>
  </form>

  <div class="unlock-footer">
    <button type="button" class="btn-link" onclick={handleReset}>
      Forgot master password? Reset settings
    </button>
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
    color: var(--accent-color, #1a73e8);
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
    border: 1px solid var(--border-color, #dadce0);
    border-radius: 4px;
    background-color: var(--bg-secondary, #f8f9fa);
    color: var(--text-primary);
    font-size: 0.95rem;
    box-sizing: border-box;
    transition: border-color 0.15s ease-in-out;
  }

  input[type="password"]:focus {
    outline: none;
    border-color: var(--accent-color, #1a73e8);
  }

  .btn-block {
    width: 100%;
    padding: 10px;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .unlock-footer {
    margin-top: 24px;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--accent-color, #1a73e8);
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }

  .btn-link:hover {
    color: var(--accent-hover-color, #1557b0);
  }
</style>
