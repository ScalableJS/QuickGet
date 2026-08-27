import { vi } from "vitest";

type StorageState = Record<string, unknown>;

let storageState: StorageState = {};
let sessionStorageState: StorageState = {};

/**
 * Chrome 120+ (the extension's minimum) supports both the callback and the
 * Promise form of storage methods. The mock mirrors that: when a callback is
 * passed it is invoked (legacy style); when it is omitted a Promise resolving
 * to the same value is returned (modern style used by newer code paths).
 */
function readState(state: StorageState, keys: unknown): StorageState {
  if (keys == null) return { ...state };
  if (typeof keys === "string") return { [keys]: state[keys] };
  if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, state[key]]));
  const defaults = typeof keys === "object" && keys !== null ? (keys as StorageState) : {};
  return { ...defaults, ...state };
}

function makeGet(getState: () => StorageState) {
  return vi.fn((keys: unknown, callback?: (items: StorageState) => void) => {
    const result = readState(getState(), keys);
    if (callback) {
      callback(result);
      return;
    }
    return Promise.resolve(result);
  });
}

function deleteKeys(state: StorageState, keys: string | string[]): void {
  for (const key of typeof keys === "string" ? [keys] : keys) {
    delete state[key];
  }
}

const storageGet = makeGet(() => storageState);

const storageSet = vi.fn((items: StorageState, callback?: () => void) => {
  storageState = { ...storageState, ...items };
  if (callback) {
    callback();
    return;
  }
  return Promise.resolve();
});

const storageRemove = vi.fn((keys: string | string[], callback?: () => void) => {
  deleteKeys(storageState, keys);
  if (callback) {
    callback();
    return;
  }
  return Promise.resolve();
});

const storageClear = vi.fn((callback?: () => void) => {
  storageState = {};
  if (callback) {
    callback();
    return;
  }
  return Promise.resolve();
});

const sessionStorageGet = makeGet(() => sessionStorageState);

const sessionStorageSet = vi.fn((items: StorageState, callback?: () => void) => {
  sessionStorageState = { ...sessionStorageState, ...items };
  if (callback) {
    callback();
    return;
  }
  return Promise.resolve();
});

const sessionStorageRemove = vi.fn((keys: string | string[], callback?: () => void) => {
  deleteKeys(sessionStorageState, keys);
  if (callback) {
    callback();
    return;
  }
  return Promise.resolve();
});

const sessionStorageClear = vi.fn((callback?: () => void) => {
  sessionStorageState = {};
  if (callback) {
    callback();
    return;
  }
  return Promise.resolve();
});

const actionSetBadgeText = vi.fn();
const actionSetBadgeBackgroundColor = vi.fn();
const actionSetTitle = vi.fn();
const actionSetIcon = vi.fn();
const runtimeOnInstalledAddListener = vi.fn();
const contextMenusOnClickedAddListener = vi.fn();
const alarmsOnAlarmAddListener = vi.fn();

/**
 * The download-interception mocks track *when* each call happened, not just that it
 * happened: the ordering of cancel/pause/resume around the NAS hand-off is the contract
 * under test, and it is asserted via `mock.invocationCallOrder`.
 */
const downloadsCancel = vi.fn((_id: number) => Promise.resolve());
const downloadsPause = vi.fn((_id: number) => Promise.resolve());
const downloadsResume = vi.fn((_id: number) => Promise.resolve());
const downloadsErase = vi.fn((_query: unknown) => Promise.resolve([]));
const downloadsSearch = vi.fn((_query: unknown) => Promise.resolve([] as chrome.downloads.DownloadItem[]));
const downloadsOnCreatedAddListener = vi.fn();
const downloadsOnChangedAddListener = vi.fn();

const notificationsCreate = vi.fn();
const notificationsClear = vi.fn();
const notificationsOnButtonClickedAddListener = vi.fn();
const notificationsOnClosedAddListener = vi.fn();

const runtimeGetURL = vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`);

/** A `DownloadItem` with only the fields the interception path reads. */
export function createDownloadItem(overrides: Partial<chrome.downloads.DownloadItem> = {}): chrome.downloads.DownloadItem {
  return {
    id: 1,
    url: "https://tracker.example.com/file.torrent",
    finalUrl: "https://tracker.example.com/file.torrent",
    filename: "file.torrent",
    mime: "application/x-bittorrent",
    ...overrides,
  } as chrome.downloads.DownloadItem;
}

export function seedChromeStorage(items: StorageState): void {
  storageState = { ...items };
}

export function getChromeStorageSnapshot(): StorageState {
  return { ...storageState };
}

export function seedChromeSessionStorage(items: StorageState): void {
  sessionStorageState = { ...items };
}

export function getChromeSessionStorageSnapshot(): StorageState {
  return { ...sessionStorageState };
}

export function resetChromeMockState(): void {
  storageState = {};
  sessionStorageState = {};

  storageGet.mockClear();
  storageSet.mockClear();
  storageRemove.mockClear();
  storageClear.mockClear();

  sessionStorageGet.mockClear();
  sessionStorageSet.mockClear();
  sessionStorageRemove.mockClear();
  sessionStorageClear.mockClear();

  actionSetBadgeText.mockClear();
  actionSetBadgeBackgroundColor.mockClear();
  actionSetTitle.mockClear();
  actionSetIcon.mockClear();

  runtimeOnInstalledAddListener.mockClear();
  contextMenusOnClickedAddListener.mockClear();
  alarmsOnAlarmAddListener.mockClear();

  downloadsCancel.mockClear();
  downloadsPause.mockClear();
  downloadsResume.mockClear();
  downloadsErase.mockClear();
  downloadsSearch.mockClear();
  downloadsOnCreatedAddListener.mockClear();
  downloadsOnChangedAddListener.mockClear();

  notificationsCreate.mockClear();
  notificationsClear.mockClear();
  notificationsOnButtonClickedAddListener.mockClear();
  notificationsOnClosedAddListener.mockClear();
  runtimeGetURL.mockClear();
}

export function getChromeDownloadsMock() {
  return {
    cancel: downloadsCancel,
    pause: downloadsPause,
    resume: downloadsResume,
    search: downloadsSearch,
    onCreatedAddListener: downloadsOnCreatedAddListener,
  };
}

export function getChromeNotificationsMock() {
  return { create: notificationsCreate, clear: notificationsClear };
}

export function installChromeMock(): typeof chrome {
  const chromeMock = {
    storage: {
      local: {
        get: storageGet,
        set: storageSet,
        remove: storageRemove,
        clear: storageClear,
      },
      session: {
        get: sessionStorageGet,
        set: sessionStorageSet,
        remove: sessionStorageRemove,
        clear: sessionStorageClear,
      },
    },
    action: {
      setBadgeText: actionSetBadgeText,
      setBadgeBackgroundColor: actionSetBadgeBackgroundColor,
      setTitle: actionSetTitle,
      setIcon: actionSetIcon,
    },
    runtime: {
      onInstalled: {
        addListener: runtimeOnInstalledAddListener,
      },
      getURL: runtimeGetURL,
    },
    downloads: {
      cancel: downloadsCancel,
      pause: downloadsPause,
      resume: downloadsResume,
      erase: downloadsErase,
      search: downloadsSearch,
      onCreated: {
        addListener: downloadsOnCreatedAddListener,
      },
      onChanged: {
        addListener: downloadsOnChangedAddListener,
      },
    },
    notifications: {
      create: notificationsCreate,
      clear: notificationsClear,
      onButtonClicked: {
        addListener: notificationsOnButtonClickedAddListener,
      },
      onClosed: {
        addListener: notificationsOnClosedAddListener,
      },
    },
    contextMenus: {
      onClicked: {
        addListener: contextMenusOnClickedAddListener,
      },
    },
    alarms: {
      onAlarm: {
        addListener: alarmsOnAlarmAddListener,
      },
    },
  } as unknown as typeof chrome;

  vi.stubGlobal("chrome", chromeMock);
  return chromeMock;
}
