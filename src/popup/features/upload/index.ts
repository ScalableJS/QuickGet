import { uploadTorrent } from "./torrentUpload.js";

interface InitializeUploadOptions {
  onUploadSuccess?: () => void;
  onDuplicate?: (fileName: string) => void;
  onLog?: (message: string) => void;
}

export interface UploadFeature {
  triggerFilePicker: () => void;
  reset: () => void;
}

function getFileInput(): HTMLInputElement | null {
  return document.getElementById("torrentFileInput") as HTMLInputElement | null;
}

export function initializeUpload(options: InitializeUploadOptions = {}): UploadFeature {
  const log = options.onLog ?? ((message: string) => console.debug(`[Upload] ${message}`));
  const fileInput = getFileInput();

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
    reset: () => {
      if (fileInput) fileInput.value = "";
    },
  };
}
