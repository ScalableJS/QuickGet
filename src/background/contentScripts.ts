/**
 * Re-run declarative content scripts in tabs that were already open during an extension update.
 * Chrome does not otherwise replace their invalidated extension context until the user reloads
 * the page, leaving a click handler that can no longer reach the service worker.
 */
const CONTENT_SCRIPTS_READY_KEY = "quickget:retained-content-scripts-ready";

/**
 * Refresh retained tabs once for an extension lifetime. Session storage survives service-worker
 * suspension but is reset by an extension reload.
 */
export async function refreshRetainedContentScripts(): Promise<void> {
  const state = await chrome.storage.session.get(CONTENT_SCRIPTS_READY_KEY);
  if (state[CONTENT_SCRIPTS_READY_KEY]) return;

  await refreshContentScripts();
  await chrome.storage.session.set({ [CONTENT_SCRIPTS_READY_KEY]: true });
}

export async function refreshContentScripts(): Promise<void> {
  const scripts = chrome.runtime.getManifest().content_scripts ?? [];
  const filesByScript = scripts.map((script) => script.js ?? []).filter((files) => files.length > 0);
  if (filesByScript.length === 0) return;

  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.all(
    tabs.flatMap(({ id: tabId }) => {
      if (tabId === undefined) return [];
      return filesByScript.map(async (files) => {
        try {
          await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files });
        } catch {
          // Tabs can disappear or deny injection while the update is being applied.
        }
      });
    }),
  );
}
