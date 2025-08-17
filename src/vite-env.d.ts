/// <reference types="vite/client" />

interface Window {
  BUILD_VERSION?: string;
}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
