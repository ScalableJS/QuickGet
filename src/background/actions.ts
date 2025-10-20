/**
 * Badge and action updates
 * Manages extension icon badge and title
 */

/**
 * Update badge with progress percentage
 */
export function updateBadge(progress: number): void {
  const text = progress > 0 && progress < 100 ? `${progress}%` : "";

  chrome.action.setBadgeText({ text });

  if (progress > 0 && progress < 100) {
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // Green
  } else if (progress === 100) {
    chrome.action.setBadgeBackgroundColor({ color: "#2196F3" }); // Blue
  }
}

/**
 * Clear badge
 */
export function clearBadge(): void {
  chrome.action.setBadgeText({ text: "" });
}

/**
 * Set action title
 */
export function setActionTitle(title: string): void {
  chrome.action.setTitle({ title });
}
