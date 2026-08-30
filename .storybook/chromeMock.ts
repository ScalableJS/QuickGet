/**
 * Minimal `chrome.*` stand-in so components that read real settings can be shown in Storybook.
 *
 * Settings talks to `chrome.storage` directly rather than through props, so without this the
 * component throws on mount and none of its states can be reviewed. The mock is per-story:
 * `seedChromeStorage` resets it, so one story's state cannot leak into the next.
 */

type StorageState = Record<string, unknown>;

let local: StorageState = {};
let session: StorageState = {};

function read(state: StorageState, keys: unknown): StorageState {
  if (keys == null) return { ...state };
  if (typeof keys === "string") return { [keys]: state[keys] };
  if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, state[key]]));
  return { ...(keys as StorageState), ...state };
}

function area(get: () => StorageState, set: (next: StorageState) => void) {
  return {
    get: (keys: unknown, callback?: (items: StorageState) => void) => {
      const result = read(get(), keys);
      if (callback) return void callback(result);
      return Promise.resolve(result);
    },
    set: (items: StorageState, callback?: () => void) => {
      set({ ...get(), ...items });
      if (callback) return void callback();
      return Promise.resolve();
    },
    remove: (keys: string | string[], callback?: () => void) => {
      const next = { ...get() };
      for (const key of typeof keys === "string" ? [keys] : keys) delete next[key];
      set(next);
      if (callback) return void callback();
      return Promise.resolve();
    },
    clear: (callback?: () => void) => {
      set({});
      if (callback) return void callback();
      return Promise.resolve();
    },
  };
}

/** Replace the stored settings for the story about to render. */
export function seedChromeStorage(localState: StorageState = {}, sessionState: StorageState = {}): void {
  local = { ...localState };
  session = { ...sessionState };
}

export function installChromeMock(): void {
  const chromeMock = {
    storage: {
      local: area(
        () => local,
        (next) => {
          local = next;
        },
      ),
      session: area(
        () => session,
        (next) => {
          session = next;
        },
      ),
    },
    runtime: {
      getManifest: () => ({ version: "1.0.3" }),
      getURL: (path: string) => path,
      lastError: undefined,
      sendMessage: () => Promise.resolve(),
      onMessage: { addListener: () => {} },
    },
    action: {
      setBadgeText: () => {},
      setBadgeBackgroundColor: () => {},
      setTitle: () => {},
      setIcon: () => {},
    },
    // Settings exposes the local-file option only in browsers that can hold a download while its
    // filename is being determined. Storybook represents Chrome, so keep that control reviewable.
    downloads: {
      onDeterminingFilename: { addListener: () => {} },
    },
  };

  (globalThis as { chrome?: unknown }).chrome = chromeMock;
}
