import { expect, it } from 'vitest';
import { installSandboxStorage } from '../src/lib/preview/sandboxStorage';

function sandbox() {
  const win = {} as Window;
  for (const name of ['localStorage', 'sessionStorage'])
    Object.defineProperty(win, name, {
      configurable: true,
      get() {
        throw new DOMException('Opaque origin', 'SecurityError');
      },
    });
  return win;
}

it('provides isolated in-memory storage for an opaque document', () => {
  const first = sandbox();
  const second = sandbox();
  installSandboxStorage(first);
  installSandboxStorage(second);
  first.localStorage.setItem('recent-games', '[1,2]');
  first.sessionStorage.setItem('nuxt:reload', '{"path":"/"}');
  expect(first.localStorage.length).toBe(1);
  expect(first.localStorage.key(0)).toBe('recent-games');
  expect(first.localStorage.key(1)).toBeNull();
  expect(first.localStorage.getItem('recent-games')).toBe('[1,2]');
  expect(first.sessionStorage.getItem('recent-games')).toBeNull();
  expect(second.localStorage.getItem('recent-games')).toBeNull();
  installSandboxStorage(first);
  expect(first.localStorage.getItem('recent-games')).toBe('[1,2]');
  first.localStorage.removeItem('recent-games');
  expect(first.localStorage.length).toBe(0);
  first.sessionStorage.clear();
  expect(first.sessionStorage.getItem('nuxt:reload')).toBeNull();
});

it('does not replace accessible browser storage', () => {
  const storage = { length: 0 } as Storage;
  const win = { localStorage: storage, sessionStorage: storage } as Window;
  installSandboxStorage(win);
  expect(win.localStorage).toBe(storage);
  expect(win.sessionStorage).toBe(storage);
});
