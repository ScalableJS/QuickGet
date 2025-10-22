type StatusType = "success" | "error" | "info";

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

  messageElement.textContent = message;

  if (message) {
    pill.className = `status-pill visible status-${type}`;
    bar.classList.add("visible");
  } else {
    pill.className = "status-pill";
    bar.classList.remove("visible");
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

  pill.className = "status-pill";
  message.textContent = "";
  bar.classList.remove("visible");

  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}
