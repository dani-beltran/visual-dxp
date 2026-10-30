/**
 * Document-local Storage fallback for scripts that assume browser storage exists.
 * Only replace inaccessible storage in an opaque sandbox. Values live in memory
 * for this document, never share editor/upstream data, and disappear on reload.
 */
export function installSandboxStorage(win: Window) {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      void win[name].length;
      continue;
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'SecurityError') continue;
    }
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      key: (index) => [...values.keys()][index] ?? null,
      getItem: (key) => values.get(String(key)) ?? null,
      setItem: (key, value) => {
        values.set(String(key), String(value));
      },
      removeItem: (key) => {
        values.delete(String(key));
      },
      clear: () => values.clear(),
    };
    Object.defineProperty(win, name, { configurable: true, enumerable: true, value: storage });
  }
}
