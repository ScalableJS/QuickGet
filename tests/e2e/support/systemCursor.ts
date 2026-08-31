import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Locator, Page } from "@playwright/test";

const run = promisify(execFile);

const CLICLICK = "/opt/homebrew/bin/cliclick";

export interface WindowBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Drives the **real** macOS pointer, so a native window capture shows a cursor that actually
 * travels to what is being clicked.
 *
 * Playwright cannot do this: CDP's `Input.dispatchMouseEvent` injects input into Chromium and
 * never reaches CoreGraphics, so `page.mouse` leaves the system pointer where it was (measured —
 * it did not move a pixel across `mouse.move()` and `click()`). For the in-page beats Playwright's
 * own `screencast` draws a cursor, but the toolbar icon and the action popup live outside the
 * page, and those are exactly the shots that prove the product works.
 *
 * **Never combine this with a drawn cursor in the same frame.** `-capture_cursor 1` records the
 * system pointer, so a DOM overlay on top would put two cursors on screen.
 */
export class SystemCursor {
  constructor(
    private readonly bounds: WindowBounds,
    private readonly chromeHeight: number,
  ) {}

  /**
   * Measures the window and the height of Chrome's own UI, so page coordinates can be mapped to
   * screen coordinates.
   *
   * `chromeHeight` is derived, never hardcoded: it changes with the bookmarks bar, Chrome version
   * and OS. Here it came out at 87px, but that is an observation, not a constant.
   */
  static async measure(page: Page, bounds: WindowBounds): Promise<SystemCursor> {
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    return new SystemCursor(bounds, bounds.height - viewportHeight);
  }

  /**
   * A cursor aimed at a **different** window — a popup window has its own screen origin, so a
   * cursor measured against the main window would click somewhere else entirely.
   *
   * Both the origin and the chrome height are read from the window itself (`screenX`/`screenY`
   * against `outerHeight`/`innerHeight`) rather than assumed: a popup window has no address bar,
   * so its chrome is a different height from the main window's.
   */
  static async forWindow(page: Page): Promise<SystemCursor> {
    const frame = await page.evaluate(() => ({
      left: window.screenX,
      top: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight,
      chrome: window.outerHeight - window.innerHeight,
    }));

    return new SystemCursor(
      { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
      frame.chrome,
    );
  }

  /**
   * Where a locator's centre sits on the physical screen.
   *
   * Scrolls it into view first. Playwright does this implicitly before its own clicks, but the
   * system pointer knows nothing about the DOM: an element below the fold yields a screen point
   * outside the window, and the click lands on whatever is actually there. That silently produced
   * a "checkbox did not change state" failure — the control sat at y=624 in a ~570px-tall popup,
   * so the pointer was aimed 60px below the window.
   */
  async pointFor(locator: Locator): Promise<{ x: number; y: number }> {
    await locator.scrollIntoViewIfNeeded();

    const box = await locator.boundingBox();
    if (!box) throw new Error("Element has no bounding box — cannot aim the system cursor at it");

    const point = {
      x: this.bounds.left + box.x + box.width / 2,
      y: this.bounds.top + this.chromeHeight + box.y + box.height / 2,
    };

    const bottom = this.bounds.top + this.bounds.height;
    if (point.y < this.bounds.top || point.y > bottom) {
      throw new Error(
        `Target is outside the window after scrolling (y=${Math.round(point.y)}, ` +
          `window ${Math.round(this.bounds.top)}–${Math.round(bottom)}). The click would miss.`,
      );
    }

    return point;
  }

  /**
   * Glides to a point. `easing` maps to cliclick's `-e`, which spreads the movement over time
   * rather than teleporting — a jump cut reads as a glitch on video.
   */
  async moveTo(point: { x: number; y: number }, easing = 400): Promise<void> {
    await run(CLICLICK, ["-e", String(easing), `m:${Math.round(point.x)},${Math.round(point.y)}`]);
  }

  /** Glides to the element, then presses. Returns the point, for a caller that wants to assert it. */
  async click(locator: Locator, easing = 400): Promise<{ x: number; y: number }> {
    const point = await this.pointFor(locator);
    await this.moveTo(point, easing);
    await run(CLICLICK, [`c:${Math.round(point.x)},${Math.round(point.y)}`]);
    return point;
  }

  /** Clicks a raw screen point — for targets outside the page, such as the toolbar icon. */
  async clickPoint(point: { x: number; y: number }, easing = 400): Promise<void> {
    await this.moveTo(point, easing);
    await run(CLICLICK, [`c:${Math.round(point.x)},${Math.round(point.y)}`]);
  }

  /**
   * Parks the pointer outside the captured rectangle, so it does not sit in frame during a beat
   * where nothing should be pointed at.
   */
  async park(): Promise<void> {
    await this.moveTo({ x: this.bounds.left + this.bounds.width + 200, y: this.bounds.top + 40 }, 0);
  }

  /** Current pointer position, as macOS reports it. Useful for asserting a move actually happened. */
  static async position(): Promise<{ x: number; y: number }> {
    const { stdout } = await run(CLICLICK, ["p:."]);
    const [x, y] = stdout.trim().split(",").map(Number);
    return { x, y };
  }

  /** Whether cliclick is present and permitted to move the pointer. */
  static async isAvailable(): Promise<boolean> {
    try {
      await run(CLICLICK, ["p:."]);
      return true;
    } catch {
      return false;
    }
  }
}
