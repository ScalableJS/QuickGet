import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  findAnchor,
  getFileSendUrl,
  getMagnetUri,
  initMagnetInterception,
  isEligibleClick,
  resolveTheme,
  setCurrentTheme,
  showFeedback,
} from "./magnet.js";

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

    /**
     * Shift is the "send this one" gesture and must reach the handler; the other three keep
     * their native browser meanings (new tab, new window, download the link).
     */
    it("rejects Ctrl, Cmd and Alt clicks but lets Shift through", () => {
      for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
        const event = createClickEvent({ button: 0, cancelable: true, isTrusted: true, ...mod });
        expect(isEligibleClick(event)).toBe(false);
      }

      const shifted = createClickEvent({ button: 0, cancelable: true, isTrusted: true, shiftKey: true });
      expect(isEligibleClick(shifted)).toBe(true);
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
      expect(host?.style.top).toBe("16px");
      expect(host?.style.right).toBe("20px");
      expect(host?.shadowRoot).not.toBeNull();
      expect(host?.shadowRoot?.textContent).toContain("Sending magnet to QNAP...");
    });

    it("renders single-line error state with dismiss button", () => {
      showFeedback("error", "NAS offline");

      const host = document.getElementById("quickget-feedback-host");
      const shadow = host?.shadowRoot;
      expect(shadow?.textContent).toContain("NAS offline");
      expect(shadow?.getElementById("qg-dismiss")).not.toBeNull();
    });

    it("removes toast on clicking dismiss button", () => {
      showFeedback("error", "Failed to connect");

      const host = document.getElementById("quickget-feedback-host");
      const shadow = host?.shadowRoot;

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

    it("adapts styles to light and dark theme", () => {
      setCurrentTheme("light");
      showFeedback("success", "Light theme message");
      let host = document.getElementById("quickget-feedback-host");
      expect(host?.shadowRoot?.innerHTML).toContain("background: #ffffff");

      setCurrentTheme("dark");
      showFeedback("success", "Dark theme message");
      host = document.getElementById("quickget-feedback-host");
      expect(host?.shadowRoot?.innerHTML).toContain("background: #0f1e32");

      setCurrentTheme("auto");
    });

    it("resolves auto theme from matchMedia", () => {
      expect(resolveTheme("light")).toBe("light");
      expect(resolveTheme("dark")).toBe("dark");
    });
  });

  describe("initMagnetInterception", () => {
    it("attaches the click listener without a torrent setting", () => {
      const addEventListenerSpy = vi.spyOn(document, "addEventListener");

      const storageListeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = [];
      const mockStorage = {
        local: {
          get: vi.fn((_keys, cb) => cb({ interceptFileLinks: false })),
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
          local: { get: vi.fn((_keys, cb) => cb({ interceptFileLinks: false })) },
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

      expect(preventDefaultSpy).toHaveBeenCalledOnce();
      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task:add",
          uri: "magnet:?xt=urn:btih:112233&dn=Test",
        }),
        expect.any(Function),
      );

      cleanup();
    });

    it("Shift-click sends one ordinary file while automatic file interception is off", () => {
      let clickHandler: ((event: MouseEvent) => void) | undefined;
      vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
        if (type === "click" && (options as { capture?: boolean })?.capture) {
          clickHandler = listener as (event: MouseEvent) => void;
        }
      });

      const sendMessageMock = vi.fn((_msg, cb) => cb?.({ ok: true }));
      (globalThis as unknown as { chrome: unknown }).chrome = {
        storage: {
          local: { get: vi.fn((_keys, cb) => cb({ interceptFileLinks: false })) },
          onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
        },
        runtime: {
          sendMessage: sendMessageMock,
          id: "test-extension-id",
        },
      };

      const cleanup = initMagnetInterception();
      const anchor = document.createElement("a");
      anchor.href = "https://example.com/release.zip";
      document.body.appendChild(anchor);
      const event = createClickEvent({
        button: 0,
        cancelable: true,
        isTrusted: true,
        shiftKey: true,
        composedPath: [anchor, document.body],
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      const stopImmediatePropagationSpy = vi.spyOn(event, "stopImmediatePropagation");

      clickHandler?.(event);

      expect(preventDefaultSpy).toHaveBeenCalledOnce();
      expect(stopImmediatePropagationSpy).toHaveBeenCalledOnce();
      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "link:send", url: anchor.href }),
        expect.any(Function),
      );

      cleanup();
    });

    /**
     * The listener is unconditional. The ordinary-file setting changes handler behavior; it
     * never owns registration.
     */
    it("keeps the listener attached whatever the setting says", () => {
      const addEventListenerSpy = vi.spyOn(document, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

      let storageListener: ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void) | undefined;
      const mockStorage = {
        local: {
          get: vi.fn((_keys, cb) => cb({ interceptFileLinks: false })),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            storageListener = listener;
          }),
          removeListener: vi.fn(),
        },
      };
      (globalThis as unknown as { chrome: unknown }).chrome = { storage: mockStorage };

      const cleanup = initMagnetInterception();

      // Attached even though automatic ordinary-file capture is off.
      expect(addEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function), {
        capture: true,
        passive: false,
      });

      storageListener?.({ interceptFileLinks: { newValue: true, oldValue: false } }, "local");
      storageListener?.({ interceptFileLinks: { newValue: false, oldValue: true } }, "local");
      expect(removeEventListenerSpy).not.toHaveBeenCalled();

      cleanup();
      expect(removeEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function), true);
    });
  });
});

/**
 * A plain click on an ordinary file link, when the file switch is on (RES-5). The decision has to
 * be made synchronously — `preventDefault()` cannot wait for a network round trip — so everything
 * here is readable off the anchor and the URL, and nothing inspects a response.
 */
describe("getFileSendUrl", () => {
  function clickOn(
    href: string,
    options: { download?: string | null; init?: MouseEventInit & { isTrusted?: boolean } } = {},
  ): MouseEvent {
    const anchor = document.createElement("a");
    anchor.href = href;
    if (options.download != null) anchor.setAttribute("download", options.download);
    document.body.appendChild(anchor);
    return createClickEvent({
      button: 0,
      cancelable: true,
      isTrusted: true,
      composedPath: [anchor, document.body, document, window],
      ...options.init,
    });
  }

  it("claims a known file extension", () => {
    expect(getFileSendUrl(clickOn("https://example.com/ubuntu.iso"))).toBe("https://example.com/ubuntu.iso");
    expect(getFileSendUrl(clickOn("https://example.com/clip.mkv"))).toBe("https://example.com/clip.mkv");
  });

  it("claims an extensionless link when the page itself calls it a download", () => {
    // The `download` attribute is the page saying outright that this is a file, which is a
    // stronger signal than any guess we could make from the URL.
    expect(getFileSendUrl(clickOn("https://example.com/get", { download: "build.bin" }))).toBe(
      "https://example.com/get",
    );
  });

  it("leaves an extensionless link without that attribute alone", () => {
    expect(getFileSendUrl(clickOn("https://example.com/get"))).toBeNull();
  });

  it("does not confuse a query string with a file name", () => {
    expect(getFileSendUrl(clickOn("https://example.com/movie.mkv?token=abc"))).toBe(
      "https://example.com/movie.mkv?token=abc",
    );
    expect(getFileSendUrl(clickOn("https://example.com/page?file=movie.mkv"))).toBeNull();
  });

  it("never claims a torrent — that path has its own downloads API transaction", () => {
    expect(getFileSendUrl(clickOn("https://tracker.example.com/ubuntu.torrent"))).toBeNull();
    expect(getFileSendUrl(clickOn("https://tracker.example.com/dl.php?id=12345"))).toBeNull();
    // Even when the page labels it a download.
    expect(getFileSendUrl(clickOn("https://tracker.example.com/ubuntu.torrent", { download: "x.torrent" }))).toBeNull();
  });

  it("leaves pages and PDFs alone", () => {
    expect(getFileSendUrl(clickOn("https://example.com/article.html"))).toBeNull();
    expect(getFileSendUrl(clickOn("https://example.com/manual.pdf"))).toBeNull();
  });

  it("uses the same classifier for Shift opt-in", () => {
    expect(getFileSendUrl(clickOn("https://example.com/ubuntu.iso", { init: { shiftKey: true } }))).toBe(
      "https://example.com/ubuntu.iso",
    );
  });

  it("ignores modified and non-primary clicks, leaving the browser's own behaviour intact", () => {
    const href = "https://example.com/ubuntu.iso";
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { button: 1 }]) {
      expect(getFileSendUrl(clickOn(href, { init }))).toBeNull();
    }
  });

  it("ignores synthetic clicks, so a page cannot make the extension send links", () => {
    expect(getFileSendUrl(clickOn("https://example.com/ubuntu.iso", { init: { isTrusted: false } }))).toBeNull();
  });
});
