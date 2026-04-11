/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOBILE_APK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
