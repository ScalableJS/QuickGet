import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findAnchor, getMagnetUri, initMagnetInterception, isEligibleClick, showFeedback } from "./magnet.js";

function createClickEvent(
  init: MouseEventInit & { isTrusted?: boolean; composedPath?: EventTarget[] } = {},
): MouseEvent {
  const event = new MouseEvent("click", init);
  const isTrusted = init.isTrusted ?? true;
  const path = init.composedPath;
  return new Proxy(event, {
    get(target, prop, receiver) {
      if (prop === "isTrusted") return isTrusted;
      if (prop === "composedPath" && path !== undefined) return () => path;
      const val = Reflect.get(target, prop, receiver);
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}

describe("magnet content script", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  describe("isEligibleClick", () => {
    it("accepts trusted primary left-clicks with no modifiers", () => {
      const event = createClickEvent({
        button: 0,
        cancelable: true,
        isTrusted: true,
      });

      expect(isEligibleClick(event)).toBe(true);
    });

    it("rejects untrusted (synthetic) events", () => {
      const event = createClickEvent({
        button: 0,
        cancelable: true,
        isTrusted: false,
      });

      expect(isEligibleClick(event)).toBe(false);
    });

    it("rejects non-primary mouse buttons", () => {
      for (const button of [1, 2, 3]) {
        const event = createClickEvent({ button, cancelable: true, isTrusted: true });
        expect(isEligibleClick(event)).toBe(false);
      }
    });

    it("rejects uncancelable events", () => {
      const event = createClickEvent({ button: 0, cancelable: false, isTrusted: true });
      expect(isEligibleClick(event)).toBe(false);
    });

    it("rejects already-prevented events", () => {
      const event = createClickEvent({ button: 0, cancelable: true, isTrusted: true });
      event.preventDefault();
      expect(isEligibleClick(event)).toBe(false);
    });

    it("rejects modified clicks (Ctrl, Cmd, Shift, Alt)", () => {
      const modifiers = [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }];

      for (const mod of modifiers) {
        const event = createClickEvent({ button: 0, cancelable: true, isTrusted: true, ...mod });
        expect(isEligibleClick(event)).toBe(false);
      }
    });
  });

  describe("findAnchor", () => {
    it("finds the anchor directly when clicked", () => {
      const a = document.createElement("a");
      a.href = "magnet:?xt=urn:btih:123";
      document.body.appendChild(a);

      const event = createClickEvent({
        composedPath: [a, document.body, document, window],
      });

      expect(findAnchor(event)).toBe(a);
    });

    it("walks up composedPath when a nested element is clicked", () => {
      const a = document.createElement("a");
      a.href = "magnet:?xt=urn:btih:123";
      const span = document.createElement("span");
      const icon = document.createElement("i");
      span.appendChild(icon);
      a.appendChild(span);
      document.body.appendChild(a);

      const event = createClickEvent({
        composedPath: [icon, span, a, document.body, document, window],
      });

      expect(findAnchor(event)).toBe(a);
    });

    it("returns null if no anchor is present in the path", () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const event = createClickEvent({
        composedPath: [div, document.body, document, window],
      });

      expect(findAnchor(event)).toBeNull();
    });

    it("ignores anchor elements without an href attribute", () => {
      const a = document.createElement("a");
      document.body.appendChild(a);

      const event = createClickEvent({
        composedPath: [a, document.body, document, window],
      });

      expect(findAnchor(event)).toBeNull();
    });
  });

  describe("getMagnetUri", () => {
    it("returns the magnet URI for an eligible click on a magnet anchor", () => {
      const a = document.createElement("a");
      a.href = "magnet:?xt=urn:btih:abcdef123456&dn=Ubuntu";
      document.body.appendChild(a);

      const event = createClickEvent({
        button: 0,
        cancelable: true,
        isTrusted: true,
        composedPath: [a, document.body],
      });

      expect(getMagnetUri(event)).toBe("magnet:?xt=urn:btih:abcdef123456&dn=Ubuntu");
    });

    it("returns null for HTTP/HTTPS anchors", () => {
      const a = document.createElement("a");
      a.href = "https://example.com/file.torrent";
      document.body.appendChild(a);

      const event = createClickEvent({
        button: 0,
        cancelable: true,
        isTrusted: true,
        composedPath: [a, document.body],
      });

      expect(getMagnetUri(event)).toBeNull();
    });

    it("returns null if the click is ineligible (e.g. middle click)", () => {
      const a = document.createElement("a");
      a.href = "magnet:?xt=urn:btih:123";
      document.body.appendChild(a);

      const event = createClickEvent({
        button: 1,
        cancelable: true,
        isTrusted: true,
        composedPath: [a, document.body],
      });

      expect(getMagnetUri(event)).toBeNull();
    });
  });

  describe("showFeedback", () => {
    it("creates an isolated shadow host container and renders toast", () => {
      showFeedback("loading", "Sending magnet to QNAP...");

      const host = document.getElementById("quickget-feedback-host");
      expect(host).not.toBeNull();
      expect(host?.shadowRoot).not.toBeNull();
      expect(host?.shadowRoot?.textContent).toContain("Sending magnet to QNAP...");
    });

    it("renders error state with Open locally action", () => {
      showFeedback("error", "NAS offline", {
        magnetUri: "magnet:?xt=urn:btih:999",
      });

      const host = document.getElementById("quickget-feedback-host");
      const shadow = host?.shadowRoot;
      expect(shadow?.textContent).toContain("NAS offline");
      expect(shadow?.getElementById("qg-open-local")).not.toBeNull();
    });
    it("handles toast button interactions (dismiss, retry, open local)", () => {
      const onRetry = vi.fn();
      showFeedback("error", "Failed to connect", {
        magnetUri: "magnet:?xt=urn:btih:xyz",
        onRetry,
      });

      const host = document.getElementById("quickget-feedback-host");
      const shadow = host?.shadowRoot;

      const retryBtn = shadow?.getElementById("qg-retry") as HTMLButtonElement | null;
      expect(retryBtn).not.toBeNull();
      retryBtn?.click();
      expect(onRetry).toHaveBeenCalledTimes(1);

      const dismissBtn = shadow?.getElementById("qg-dismiss") as HTMLButtonElement | null;
      expect(dismissBtn).not.toBeNull();
      dismissBtn?.click();
      expect(document.getElementById("quickget-feedback-host")).toBeNull();
    });

    it("auto-removes success toast after timeout", () => {
      vi.useFakeTimers();
      try {
        showFeedback("success", "Done!");
        expect(document.getElementById("quickget-feedback-host")).not.toBeNull();

        vi.advanceTimersByTime(2600);
        expect(document.getElementById("quickget-feedback-host")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("initMagnetInterception", () => {
    it("attaches click listener when storage has autoCaptureMagnets true", () => {
      const addEventListenerSpy = vi.spyOn(document, "addEventListener");

      const storageListeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = [];
      const mockStorage = {
        local: {
          get: vi.fn((_keys, cb) => cb({ autoCaptureMagnets: true })),
        },
        onChanged: {
          addListener: vi.fn((listener) => storageListeners.push(listener)),
          removeListener: vi.fn(),
        },
      };
      (globalThis as unknown as { chrome: unknown }).chrome = {
        storage: mockStorage,
      };

      const cleanup = initMagnetInterception();

      expect(addEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function), {
        capture: true,
        passive: false,
      });

      cleanup();
    });

    it("intercepts click and dispatches to chrome.runtime.sendMessage", () => {
      let clickHandler: ((event: MouseEvent) => void) | undefined;
      vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
        if (type === "click" && (options as { capture?: boolean })?.capture) {
          clickHandler = listener as (event: MouseEvent) => void;
        }
      });

      const sendMessageMock = vi.fn((_msg, cb) => cb?.({ ok: true }));
      (globalThis as unknown as { chrome: unknown }).chrome = {
        storage: {
          local: { get: vi.fn((_keys, cb) => cb({ autoCaptureMagnets: true })) },
          onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
        },
        runtime: {
          sendMessage: sendMessageMock,
          id: "test-extension-id",
        },
      };

      const cleanup = initMagnetInterception();
      expect(clickHandler).toBeDefined();

      const a = document.createElement("a");
      a.href = "magnet:?xt=urn:btih:112233&dn=Test";
      document.body.appendChild(a);

      const event = createClickEvent({
        button: 0,
        cancelable: true,
        isTrusted: true,
        composedPath: [a, document.body],
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      clickHandler?.(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task:add",
          uri: "magnet:?xt=urn:btih:112233&dn=Test",
        }),
        expect.any(Function),
      );

      cleanup();
    });

    it("reacts live to storage changes without reload", () => {
      const addEventListenerSpy = vi.spyOn(document, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

      let storageListener: ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void) | undefined;
      const mockStorage = {
        local: {
          get: vi.fn((_keys, cb) => cb({ autoCaptureMagnets: false })),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            storageListener = listener;
          }),
          removeListener: vi.fn(),
        },
      };
      (globalThis as unknown as { chrome: unknown }).chrome = {
        storage: mockStorage,
      };

      const cleanup = initMagnetInterception();

      // Initially false, not added
      expect(addEventListenerSpy).not.toHaveBeenCalled();

      // Toggled on
      storageListener?.({ autoCaptureMagnets: { newValue: true, oldValue: false } }, "local");
      expect(addEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function), {
        capture: true,
        passive: false,
      });

      // Toggled off
      storageListener?.({ autoCaptureMagnets: { newValue: false, oldValue: true } }, "local");
      expect(removeEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function), true);

      cleanup();
    });
  });
});
