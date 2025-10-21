/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QNAP_LOGIN?: string;
  readonly VITE_QNAP_PASSWORD?: string;
  readonly VITE_QNAP_TEMP_DIR?: string;
  readonly VITE_QNAP_DEST_DIR?: string;
  readonly VITE_QNAP_SECURE?: string;
  readonly VITE_QNAP_ADDRESS?: string;
  readonly VITE_QNAP_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
