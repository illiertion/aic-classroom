/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Comma-separated TURN URLs, e.g. turn:turn.example.com:3478?transport=udp */
  readonly VITE_TURN_URL?: string;
  readonly VITE_TURN_USERNAME?: string;
  readonly VITE_TURN_CREDENTIAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
