/** True when running inside the Tauri webview; false in a plain browser (vite dev) and in tests. */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
