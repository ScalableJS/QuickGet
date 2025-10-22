/**
 * DOM update utilities using MorphDOM
 * Provides efficient DOM patching with morphdom
 */

import morphdom from "morphdom";

export interface MorphdomOptions {
  childrenOnly?: boolean;
  onBeforeElUpdated?: (fromEl: Element, toEl: Element) => boolean;
}

/**
 * Create a temporary container with HTML content
 */
function createTempNode(html: string): HTMLElement {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp;
}

/**
 * Update a DOM node with new HTML using morphdom
 * Preserves input values and event listeners
 */
export function morphDOMUpdate(
  targetNode: Element | string,
  newHtml: string,
  options: MorphdomOptions = {}
): void {
  const target =
    typeof targetNode === "string"
      ? document.getElementById(targetNode)
      : targetNode;

  if (!target) {
    console.warn("Target node not found for morphdom update");
    return;
  }

  // Create temporary node with new HTML
  const tempNode = createTempNode(newHtml);

  // Default options
  const defaultOptions: MorphdomOptions = {
    childrenOnly: true,
    onBeforeElUpdated: (fromEl: Element, toEl: Element) => {
      // Preserve input values and states
      if (
        fromEl instanceof HTMLInputElement &&
        toEl instanceof HTMLInputElement
      ) {
        toEl.value = fromEl.value;
        toEl.checked = fromEl.checked;
      }

      // Preserve textarea values
      if (
        fromEl instanceof HTMLTextAreaElement &&
        toEl instanceof HTMLTextAreaElement
      ) {
        toEl.value = fromEl.value;
      }

      // Preserve select selections
      if (
        fromEl instanceof HTMLSelectElement &&
        toEl instanceof HTMLSelectElement
      ) {
        toEl.value = fromEl.value;
      }

      return true;
    },
  };

  // Merge provided options with defaults
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    onBeforeElUpdated: (fromEl: Element, toEl: Element) => {
      // Call custom handler if provided
      const customResult = options.onBeforeElUpdated?.(fromEl, toEl) ?? true;
      // Call default handler
      const defaultResult =
        defaultOptions.onBeforeElUpdated?.(fromEl, toEl) ?? true;
      return customResult && defaultResult;
    },
  };

  // Apply morphdom update
  morphdom(target, tempNode, mergedOptions as any);
}

/**
 * Replace list children using morphdom
 */
export function morphDOMUpdateList(
  listElement: Element | string,
  newHtml: string
): void {
  morphDOMUpdate(listElement, newHtml, { childrenOnly: true });
}

/**
 * Batch multiple DOM updates
 */
export function morphDOMBatch(updates: Array<[Element | string, string]>): void {
  updates.forEach(([node, html]) => {
    morphDOMUpdate(node, html);
  });
}
