/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_PATH: string
  readonly VITE_WS_RECONNECT_INTERVAL: string
  readonly VITE_WS_MAX_RECONNECT_ATTEMPTS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}