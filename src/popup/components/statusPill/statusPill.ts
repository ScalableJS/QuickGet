type StatusType = "success" | "error" | "info";
type StatusOwner = "direct" | "poll";

const statusClasses = {
  success: "border-[var(--status-success-border)] bg-[var(--status-success-bg)]",
  error: "border-[var(--status-error-border)] bg-[var(--status-error-bg)]",
  info: "border-[var(--status-info-border)] bg-[var(--status-info-bg)]",
} satisfies Record<StatusType, string>;

const basePillClasses = "status-pill inline-flex items-center border border-solid rounded-[var(--radius)] px-4 py-1";

let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
let visibleStatus: { message: string; type: StatusType; owner: StatusOwner } | null = null;
let dismissedPollMessage: string | null = null;
let directStatusRevision = 0;

function getStatusElements() {
  const bar = document.querySelector(".status-bar");
  const pill = document.getElementById("status");
  const message = document.getElementById("status-message");
  const dismiss = document.getElementById("status-dismiss");
  return { bar, pill, message, dismiss };
}

export function showStatus(
  message: string,
  type: StatusType = "info",
  options?: { autoHideMs?: number; owner?: StatusOwner },
): number {
  const owner = options?.owner ?? "direct";
  if (owner === "direct") directStatusRevision += 1;

  if (owner === "poll" && dismissedPollMessage && dismissedPollMessage !== message) {
    dismissedPollMessage = null;
  }
  if (owner === "poll" && dismissedPollMessage === message) return directStatusRevision;
  if (owner === "poll" && visibleStatus?.owner === "direct") return directStatusRevision;
  if (
    owner === "poll" &&
    visibleStatus?.owner === "poll" &&
    visibleStatus.message === message &&
    visibleStatus.type === type
  ) {
    return directStatusRevision;
  }

  const { bar, pill, message: messageElement, dismiss } = getStatusElements();
  if (!bar || !pill || !messageElement) return directStatusRevision;

  // An error interrupts; a confirmation waits its turn. Both are announced — the container is
  // already a live region, but a single politeness level would either nag or bury the errors.
  pill.setAttribute("aria-live", type === "error" ? "assertive" : "polite");

  messageElement.textContent = message;

  if (message) {
    visibleStatus = { message, type, owner };
    pill.className = `${basePillClasses} ${statusClasses[type]}`;
    bar.classList.remove("hidden");
    bar.classList.add("flex", "visible");
    dismiss?.classList.toggle("hidden", Boolean(options?.autoHideMs));
    if (dismiss) dismiss.onclick = () => dismissStatus();
  } else {
    visibleStatus = null;
    pill.className = `${basePillClasses} hidden`;
    bar.classList.add("hidden");
    bar.classList.remove("flex", "visible");
    dismiss?.classList.add("hidden");
  }

  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }

  if (options?.autoHideMs) {
    autoHideTimer = setTimeout(() => {
      clearStatus({ owner });
    }, options.autoHideMs);
  }

  return directStatusRevision;
}

export function isCurrentDirectStatus(receipt: number): boolean {
  return receipt === directStatusRevision;
}

export function clearStatus(options?: { owner?: StatusOwner }): void {
  if (options?.owner === "poll") dismissedPollMessage = null;
  if (options?.owner && visibleStatus?.owner !== options.owner) return;

  const { bar, pill, message, dismiss } = getStatusElements();
  if (!bar || !pill || !message) return;

  visibleStatus = null;
  pill.className = `${basePillClasses} hidden`;
  message.textContent = "";
  bar.classList.add("hidden");
  bar.classList.remove("flex", "visible");
  dismiss?.classList.add("hidden");

  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

export function dismissStatus(): void {
  if (visibleStatus?.owner === "poll") dismissedPollMessage = visibleStatus.message;
  clearStatus();
}
