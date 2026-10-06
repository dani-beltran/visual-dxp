// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WebsiteConnectionCheck } from '../src/components/WebsiteConnectionCheck/WebsiteConnectionCheck';
import { BRANDING_PROTOCOL, readBrandingProfile } from '../src/lib/branding';
import { brandingProfile } from './helpers/branding';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function connect(url: string) {
  await act(async () => root.render(<WebsiteConnectionCheck key={url} url={url} />));
  await act(async () => vi.advanceTimersByTimeAsync(500));
  const frame = host.querySelector('iframe')!;
  const source = frame.contentWindow!;
  const post = vi.spyOn(source, 'postMessage').mockImplementation(() => {});
  await act(async () => frame.dispatchEvent(new Event('load')));
  const init = post.mock.calls.at(-1)![0];
  const receive = async (data: object, sender = source, origin = 'null') => {
    await act(async () =>
      window.dispatchEvent(new MessageEvent('message', { source: sender, origin, data })),
    );
  };
  await receive({ ...init, type: 'ready' });
  return { frame, source, init, receive };
}

it('keeps the iframe until branding arrives and ignores invalid or unrelated messages', async () => {
  const url = 'https://connection.example/';
  const { frame, source, init, receive } = await connect(url);
  expect(frame.style.width).toBe('1440px');
  expect(frame.hidden).toBe(false);
  expect(host.textContent).toContain('Reading website branding');
  const data = {
    protocol: BRANDING_PROTOCOL,
    type: 'profile',
    channel: init.channel,
    profile: brandingProfile(url),
  };
  await receive(data, window);
  await receive(data, source, 'https://connection.example');
  await receive({ ...data, channel: 'wrong' });
  await receive({ ...data, profile: {} });
  expect(host.querySelector('iframe')).toBe(frame);
  expect(readBrandingProfile(url)).toBeUndefined();
  await receive(data);
  expect(host.querySelector('iframe')).toBeNull();
  expect(readBrandingProfile(url)).toEqual(brandingProfile(url));
});

it('reports an old bridge separately from a failed connection and does not hang', async () => {
  await connect('https://old-bridge.example/');
  await act(async () => vi.advanceTimersByTimeAsync(8000));
  expect(host.querySelector('iframe')).toBeNull();
  expect(host.textContent).toContain('branding could not be read');
  expect(host.querySelector('.dxp-website-setup')).toBeNull();
});

it('rejects a profile from a previous target after a URL change', async () => {
  const first = await connect('https://previous.example/');
  const second = await connect('https://next.example/');
  await first.receive({
    protocol: BRANDING_PROTOCOL,
    type: 'profile',
    channel: first.init.channel,
    profile: brandingProfile('https://previous.example/'),
  });
  expect(host.querySelector('iframe')).toBe(second.frame);
  expect(readBrandingProfile('https://next.example/')).toBeUndefined();
  await second.receive({
    protocol: BRANDING_PROTOCOL,
    type: 'profile',
    channel: second.init.channel,
    profile: brandingProfile('https://next.example/'),
  });
  expect(readBrandingProfile('https://next.example/')).toBeDefined();
});

it('reports storage failure while keeping the profile available for this session', async () => {
  const url = 'https://blocked-storage.example/';
  const { init, receive } = await connect(url);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Quota');
  });
  await receive({
    protocol: BRANDING_PROTOCOL,
    type: 'profile',
    channel: init.channel,
    profile: brandingProfile(url),
  });
  expect(host.textContent).toContain('could not be saved');
  expect(host.querySelector('iframe')).toBeNull();
  expect(readBrandingProfile(url)).toBeDefined();
});

it('runs the bundled bridge with origin checks, cancellation, and rendered-style extraction', async () => {
  const frame = document.createElement('iframe');
  host.append(frame);
  const target = frame.contentWindow!;
  const doc = frame.contentDocument!;
  doc.body.innerHTML = '<button style="background:rgb(255, 0, 0)">Buy</button>';
  vi.spyOn(doc.body, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(doc.querySelector('button')!, 'getClientRects').mockReturnValue([
    {},
  ] as unknown as DOMRectList);
  vi.spyOn(doc, 'currentScript', 'get').mockReturnValue({
    getAttribute: () => window.location.origin,
  } as unknown as HTMLScriptElement);
  let finishFonts!: () => void;
  Object.defineProperty(doc, 'fonts', {
    configurable: true,
    value: {
      ready: new Promise<void>((resolve) => {
        finishFonts = resolve;
      }),
    },
  });
  const post = vi.spyOn(target.parent, 'postMessage').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  new Function('window', 'document', readFileSync('public/bridge.js', 'utf8'))(target, doc);
  const send = (
    channel: string,
    type = 'extract',
    origin = window.location.origin,
    source = target.parent,
  ) =>
    target.dispatchEvent(
      new MessageEvent('message', {
        origin,
        source,
        data: { protocol: BRANDING_PROTOCOL, type, channel },
      }),
    );
  send('bad-origin', 'extract', 'https://attacker.example');
  send('bad-source', 'extract', window.location.origin, target);
  send('cancelled');
  send('cancelled', 'stop');
  send('active');
  send('active');
  finishFonts();
  await vi.advanceTimersByTimeAsync(3000);
  const profiles = post.mock.calls.map(([data]) => data).filter((data) => data.type === 'profile');
  expect(post.mock.calls).toEqual(
    expect.arrayContaining([
      [expect.objectContaining({ type: 'profile' }), window.location.origin],
    ]),
  );
  expect(profiles).toHaveLength(1);
  expect(profiles[0].channel).toBe('active');
  expect(profiles[0].profile.colors.primary).toBe('rgb(255, 0, 0)');
  expect(post.mock.calls.at(-1)![1]).toBe(window.location.origin);
});
