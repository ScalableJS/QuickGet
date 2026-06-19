import { mount } from "svelte";

import CreateUrls from "./CreateUrls.svelte";
import { uploadTorrent } from "./torrentUpload.js";

interface InitializeUploadOptions {
  onUploadSuccess?: () => void;
  onDuplicate?: (fileName: string) => void;
  onLog?: (message: string) => void;
}

export interface UploadFeature {
  triggerFilePicker: () => void;
  toggleUrlPanel: () => void;
  reset: () => void;
}

function getFileInput(): HTMLInputElement | null {
  return document.getElementById("torrentFileInput") as HTMLInputElement | null;
}

function getUrlPanel(): HTMLElement | null {
  return document.getElementById("add-urls-panel");
}

export function initializeUpload(options: InitializeUploadOptions = {}): UploadFeature {
  const log = options.onLog ?? ((_message: string) => {});
  const fileInput = getFileInput();

  const urlPanel = getUrlPanel();
  if (urlPanel) {
    urlPanel.replaceChildren();
    mount(CreateUrls, {
      target: urlPanel,
      props: {
        onLog: log,
        onSuccess: () => {
          urlPanel.classList.add("hidden");
          options.onUploadSuccess?.();
        },
      },
    });
  }

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const upload = uploadTorrent(file, {
      log,
      onSuccess: () => {
        options.onUploadSuccess?.();
      },
      onDuplicate: (name) => {
        options.onDuplicate?.(name);
      },
    });

    upload.finally(() => {
      if (fileInput) fileInput.value = "";
    });
  });

  return {
    triggerFilePicker: () => {
      fileInput?.click();
    },
    toggleUrlPanel: () => {
      getUrlPanel()?.classList.toggle("hidden");
    },
    reset: () => {
      if (fileInput) fileInput.value = "";
    },
  };
}
