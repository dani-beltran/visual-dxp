import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const bridge = readFileSync('public/bridge.js', 'utf8');
const prefix = '[Visual DXP picker bridge]';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function run(headers: Record<string, string>, parentOrigin = 'https://editor.example') {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const fetch = vi.fn().mockResolvedValue({ ok: true, headers: new Headers(headers) });
  const host = { location: { href: 'https://host.example/page' }, fetch, parent: {} };
  host.parent = host;
  const document = {
    currentScript: {
      getAttribute: (name: string) => (name === 'data-parent-origin' ? parentOrigin : null),
    },
  };
  new Function('window', 'document', bridge)(host, document);
  return { info, warn, fetch };
}

describe('bridge embedding diagnostics on direct host visits', () => {
  it.each<Record<string, string>>([
    { 'x-frame-options': 'DENY' },
    { 'x-frame-options': 'sameorigin' },
    { 'content-security-policy': "frame-ancestors 'none'" },
    { 'content-security-policy': "frame-ancestors 'self'" },
    { 'content-security-policy': 'frame-ancestors https://other.example' },
    { 'content-security-policy': 'frame-ancestors https://editor.example:8443' },
    { 'content-security-policy': 'frame-ancestors http://editor.example:80' },
    { 'content-security-policy': 'frame-ancestors https://*.editor.example' },
    { 'content-security-policy': "frame-ancestors *, frame-ancestors 'none'" },
    { 'content-security-policy': 'frame-ancestors' },
  ])('warns about blocking response headers: %j', async (headers) => {
    const { warn } = run(headers);
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(prefix, expect.stringContaining('appears blocked'), {
        parentOrigin: 'https://editor.example',
      }),
    );
  });

  it.each<Record<string, string>>([
    {},
    { 'content-security-policy': "default-src 'none'" },
    { 'content-security-policy-report-only': "frame-ancestors 'none'" },
    { 'content-security-policy': 'frame-ancestors https://editor.example' },
    { 'content-security-policy': 'frame-ancestors https://*.example' },
    { 'content-security-policy': 'frame-ancestors https://editor.example:*' },
    { 'content-security-policy': 'frame-ancestors https:' },
    { 'content-security-policy': 'frame-ancestors http://editor.example' },
    { 'content-security-policy': 'frame-ancestors https://editor.example:00443' },
    { 'content-security-policy': 'frame-ancestors editor.example' },
    { 'content-security-policy': "frame-ancestors 'none' https://editor.example" },
    { 'content-security-policy': "frame-ancestors *; frame-ancestors 'none'" },
    { 'content-security-policy': 'frame-ancestors *', 'x-frame-options': 'DENY' },
    { 'content-security-policy': "frame-ancestors *; script-src 'none', frame-ancestors https:" },
  ])('does not flag policies allowing the editor: %j', async (headers) => {
    const { info, warn, fetch } = run(headers);
    await vi.waitFor(() =>
      expect(info).toHaveBeenCalledWith(prefix, expect.stringContaining('no restriction')),
    );
    expect(warn).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      'https://host.example/page',
      expect.objectContaining({
        method: 'HEAD',
        mode: 'same-origin',
        credentials: 'same-origin',
        redirect: 'error',
      }),
    );
  });

  it.each<Record<string, string>>([
    { 'content-security-policy': "frame-ancestors 'self'" },
    { 'x-frame-options': 'SAMEORIGIN' },
  ])('allows the same host origin: %j', async (headers) => {
    const { info, warn } = run(headers, 'https://host.example');
    await vi.waitFor(() =>
      expect(info).toHaveBeenCalledWith(prefix, expect.stringContaining('no restriction')),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('reports unsupported source syntax as unknown', async () => {
    const { warn } = run({
      'content-security-policy': 'frame-ancestors https://editor.example/path',
    });
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(prefix, expect.stringContaining('Unable to verify')),
    );
  });

  it.each(['network', 'http', 'timeout'])(
    'reports a failed %s check as unknown',
    async (failure) => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const fetch = vi.fn((_url: string, options: RequestInit) => {
        if (failure === 'network') return Promise.reject(new Error('blocked'));
        if (failure === 'http') return Promise.resolve({ ok: false });
        return new Promise((_resolve, reject) => {
          options.signal!.addEventListener('abort', () => reject(new Error('aborted')));
        });
      });
      const host = { location: { href: 'https://host.example/page' }, fetch, parent: {} };
      host.parent = host;
      new Function('window', 'document', bridge)(host, {
        currentScript: {
          getAttribute: (name: string) =>
            name === 'data-parent-origin' ? 'https://editor.example' : null,
        },
      });
      await vi.advanceTimersByTimeAsync(5000);
      expect(warn).toHaveBeenCalledWith(prefix, expect.stringContaining('Unable to verify'));
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
