/**
 * Progress indicator UI component
 * Minimal DOM element for showing download progress
 */

export interface ProgressOptions {
  position?: "fixed" | "absolute";
  bottom?: string;
  right?: string;
}

const DEFAULT_OPTIONS: Required<ProgressOptions> = {
  position: "fixed",
  bottom: "10px",
  right: "10px",
};

/**
 * Create or update progress indicator element
 */
export function updateProgressIndicator(
  progress: number,
  options?: ProgressOptions
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const percent = Math.max(0, Math.min(100, Math.round(progress || 0)));

  let container = document.getElementById("progress-indicator");

  if (!container) {
    container = document.createElement("div");
    container.id = "progress-indicator";
    Object.assign(container.style, {
      position: opts.position,
      bottom: opts.bottom,
      right: opts.right,
      width: "120px",
      height: "16px",
      border: "1px solid #999",
      borderRadius: "4px",
      background: "#eee",
      overflow: "hidden",
      zIndex: "9999",
      fontSize: "11px",
      lineHeight: "16px",
      textAlign: "center",
      color: "#000",
      fontFamily: "system-ui, -apple-system, sans-serif",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    });

    const bar = document.createElement("div");
    bar.className = "progress-bar";
    Object.assign(bar.style, {
      height: "100%",
      width: "0%",
      background: "#4CAF50",
      transition: "width 0.3s ease",
    });
    container.appendChild(bar);
    document.body.appendChild(container);
  }

  const bar = container.querySelector(".progress-bar") as HTMLElement | null;
  if (bar) {
    bar.style.width = `${percent}%`;
    bar.style.background = percent < 100 ? "#4CAF50" : "#2196F3";
  }

  container.innerText = `${percent}%`;
  container.title = percent ? `Downloading: ${percent}%` : "";
}

/**
 * Hide and remove progress indicator
 */
export function hideProgressIndicator(): void {
  const container = document.getElementById("progress-indicator");
  if (container) {
    container.style.opacity = "0";
    container.style.transition = "opacity 0.3s ease";
    setTimeout(() => {
      container?.remove();
    }, 300);
  }
}

/**
 * Clear progress indicator and reset
 */
export function clearProgressIndicator(): void {
  const container = document.getElementById("progress-indicator");
  if (container) {
    container.remove();
  }
}
