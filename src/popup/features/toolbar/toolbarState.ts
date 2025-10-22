interface ToolbarElements {
  play: HTMLButtonElement | null;
  stop: HTMLButtonElement | null;
  remove: HTMLButtonElement | null;
  add: HTMLButtonElement | null;
  settings: HTMLButtonElement | null;
  pause: HTMLButtonElement | null;
}

let elements: ToolbarElements | null = null;

function resolveElements(): ToolbarElements {
  if (!elements) {
    elements = {
      play: document.getElementById("toolbar-play") as HTMLButtonElement | null,
      stop: document.getElementById("toolbar-stop") as HTMLButtonElement | null,
      remove: document.getElementById("toolbar-remove") as HTMLButtonElement | null,
      add: document.getElementById("toolbar-add") as HTMLButtonElement | null,
      settings: document.getElementById("toolbar-settings") as HTMLButtonElement | null,
      pause: document.getElementById("toolbar-pause") as HTMLButtonElement | null,
    };
  }
  return elements;
}

export function getToolbarElements(): ToolbarElements {
  return resolveElements();
}

export function setSelectionState(hasSelection: boolean): void {
  const { play, stop, remove, pause } = resolveElements();
  const disabled = !hasSelection;
  [play, stop, pause, remove].forEach((button) => {
    if (!button) return;
    button.disabled = disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
  });
}

export function setAutoRefreshState(running: boolean): void {
  const { play, stop, pause } = resolveElements();
  if (pause) {
    pause.disabled = !running;
    pause.setAttribute("aria-disabled", pause.disabled ? "true" : "false");
  }
  if (play) {
    play.disabled = false;
    play.setAttribute("aria-disabled", "false");
  }
  if (stop) {
    stop.disabled = !running;
    stop.setAttribute("aria-disabled", stop.disabled ? "true" : "false");
  }
}

export function setSettingsButtonState(expanded: boolean): void {
  const { settings } = resolveElements();
  if (!settings) return;
  settings.setAttribute("aria-pressed", expanded ? "true" : "false");
  settings.setAttribute("aria-expanded", expanded ? "true" : "false");
}
