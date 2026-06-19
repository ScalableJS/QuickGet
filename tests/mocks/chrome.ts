import { vi } from "vitest";

type StorageState = Record<string, unknown>;

let storageState: StorageState = {};
let sessionStorageState: StorageState = {};

const storageGet = vi.fn((keys: unknown, callback: (items: StorageState) => void) => {
  if (keys == null) {
    callback({ ...storageState });
    return;
  }

  if (typeof keys === "string") {
    callback({ [keys]: storageState[keys] });
    return;
  }

  if (Array.isArray(keys)) {
    const result = Object.fromEntries(keys.map((key) => [key, storageState[key]]));
    callback(result);
    return;
  }

  const defaults = typeof keys === "object" && keys !== null ? (keys as StorageState) : {};
  callback({ ...defaults, ...storageState });
});

const storageSet = vi.fn((items: StorageState, callback?: () => void) => {
  storageState = { ...storageState, ...items };
  callback?.();
});

const storageRemove = vi.fn((keys: string | string[], callback?: () => void) => {
  if (typeof keys === "string") {
    delete storageState[keys];
  } else if (Array.isArray(keys)) {
    for (const key of keys) {
      delete storageState[key];
    }
  }
  callback?.();
});

const storageClear = vi.fn((callback?: () => void) => {
  storageState = {};
  callback?.();
});

const sessionStorageGet = vi.fn((keys: unknown, callback: (items: StorageState) => void) => {
  if (keys == null) {
    callback({ ...sessionStorageState });
    return;
  }

  if (typeof keys === "string") {
    callback({ [keys]: sessionStorageState[keys] });
    return;
  }

  if (Array.isArray(keys)) {
    const result = Object.fromEntries(keys.map((key) => [key, sessionStorageState[key]]));
    callback(result);
    return;
  }

  const defaults = typeof keys === "object" && keys !== null ? (keys as StorageState) : {};
  callback({ ...defaults, ...sessionStorageState });
});

const sessionStorageSet = vi.fn((items: StorageState, callback?: () => void) => {
  sessionStorageState = { ...sessionStorageState, ...items };
  callback?.();
});

const sessionStorageRemove = vi.fn((keys: string | string[], callback?: () => void) => {
  if (typeof keys === "string") {
    delete sessionStorageState[keys];
  } else if (Array.isArray(keys)) {
    for (const key of keys) {
      delete sessionStorageState[key];
    }
  }
  callback?.();
});

const sessionStorageClear = vi.fn((callback?: () => void) => {
  sessionStorageState = {};
  callback?.();
});

const actionSetBadgeText = vi.fn();
const actionSetBadgeBackgroundColor = vi.fn();
const actionSetTitle = vi.fn();
const actionSetIcon = vi.fn();
const runtimeOnInstalledAddListener = vi.fn();
const contextMenusOnClickedAddListener = vi.fn();
const alarmsOnAlarmAddListener = vi.fn();

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
