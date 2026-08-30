type StatusType = "success" | "error" | "info";

const statusClasses = {
  success: "border-[var(--status-success-border)] bg-[var(--status-success-bg)]",
  error: "border-[var(--status-error-border)] bg-[var(--status-error-bg)]",
  info: "border-[var(--status-info-border)] bg-[var(--status-info-bg)]",
} satisfies Record<StatusType, string>;

const basePillClasses =
  "status-pill inline-flex items-center border border-solid rounded-[var(--radius)] px-[var(--spacing-md)] py-[var(--spacing-xs)]";

let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

function getStatusElements() {
  const bar = document.querySelector(".status-bar");
  const pill = document.getElementById("status");
  const message = document.getElementById("status-message");
  return { bar, pill, message };
}

export function showStatus(message: string, type: StatusType = "info", options?: { autoHideMs?: number }): void {
  const { bar, pill, message: messageElement } = getStatusElements();
  if (!bar || !pill || !messageElement) return;

  // An error interrupts; a confirmation waits its turn. Both are announced — the container is
  // already a live region, but a single politeness level would either nag or bury the errors.
  pill.setAttribute("aria-live", type === "error" ? "assertive" : "polite");

  messageElement.textContent = message;

  if (message) {
    pill.className = `${basePillClasses} ${statusClasses[type]}`;
    bar.classList.remove("hidden");
    bar.classList.add("flex", "visible");
  } else {
    pill.className = `${basePillClasses} hidden`;
    bar.classList.add("hidden");
    bar.classList.remove("flex", "visible");
  }

  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }

  if (options?.autoHideMs) {
    autoHideTimer = setTimeout(() => {
      clearStatus();
    }, options.autoHideMs);
  }
}

export function clearStatus(): void {
  const { bar, pill, message } = getStatusElements();
  if (!bar || !pill || !message) return;

  pill.className = `${basePillClasses} hidden`;
  message.textContent = "";
  bar.classList.add("hidden");
  bar.classList.remove("flex", "visible");

  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}
