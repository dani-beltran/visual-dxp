import {
  BRANDING_PROTOCOL,
  BRANDING_STYLE_KEYS,
  type BrandingProfile,
  type BrandingStyle,
} from './branding';

/** Extract rendered styles only: no HTML, form values, or page copy is transported. */
export function extractBrandingProfile(doc: Document, win: Window): BrandingProfile {
  const excluded = '[data-visual-dxp-picker], [data-visual-dxp-popover]';
  const visible = (element: Element) => {
    if (element.closest(excluded) || !element.getClientRects().length) return false;
    for (let current: Element | null = element; current; current = current.parentElement) {
      const style = win.getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
        return false;
    }
    return true;
  };
  const sample = (selector: string) => {
    const groups = new Map<string, { style: BrandingStyle; sampleCount: number }>();
    for (const element of Array.from(doc.querySelectorAll(selector)).slice(0, 300)) {
      if (!visible(element)) continue;
      const computed = win.getComputedStyle(element);
      const style: BrandingStyle = {};
      for (const key of BRANDING_STYLE_KEYS) {
        const value = computed[key];
        if (value && value.length <= 300) style[key] = value;
      }
      const signature = JSON.stringify(style);
      const group = groups.get(signature);
      if (group) group.sampleCount++;
      else groups.set(signature, { style, sampleCount: 1 });
    }
    return [...groups.values()].sort((a, b) => b.sampleCount - a.sampleCount)[0];
  };
  const elements: BrandingProfile['elements'] = {};
  for (const [role, selector] of [
    ['body', 'body'],
    ['heading', 'h1, h2'],
    [
      'button',
      'button, [role="button"], input[type="submit"], input[type="button"], a[class*="btn"], a[class*="button"]',
    ],
    ['link', 'a[href]'],
  ] as const) {
    const result = sample(selector);
    if (result) elements[role] = result;
  }
  if (!Object.keys(elements).length) throw new Error('No rendered branding samples.');
  const opaque = (color?: string) =>
    color &&
    color !== 'transparent' &&
    !/^(?:rgba\([^)]*,|[^)]*\/)\s*0(?:\.0+)?%?\s*\)$/.test(color)
      ? color
      : undefined;
  return {
    version: 1,
    websiteUrl: win.location.href,
    capturedAt: new Date().toISOString(),
    viewport: { width: win.innerWidth, height: win.innerHeight },
    elements,
    colors: {
      background:
        opaque(elements.body?.style.backgroundColor) ||
        opaque(win.getComputedStyle(doc.documentElement).backgroundColor),
      text: elements.body?.style.color,
      primary: opaque(elements.button?.style.backgroundColor) || elements.link?.style.color,
      link: elements.link?.style.color,
    },
  };
}

export function installBrandingBridge(parentOrigin: string) {
  if (
    window.parent === window ||
    new URL(parentOrigin).origin !== parentOrigin ||
    !/^https?:$/.test(new URL(parentOrigin).protocol)
  )
    return;
  let pending: { channel: string; cancelled: boolean } | undefined;
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    const data = event.data;
    if (
      data?.protocol !== BRANDING_PROTOCOL ||
      typeof data.channel !== 'string' ||
      !data.channel ||
      data.channel.length > 200
    )
      return;
    if (data.type === 'stop') {
      if (pending && pending.channel === data.channel) {
        pending.cancelled = true;
        pending = undefined;
      }
      return;
    }
    if (data.type !== 'extract' || pending?.channel === data.channel) return;
    if (pending) pending.cancelled = true;
    const request = { channel: data.channel, cancelled: false };
    pending = request;
    void (async () => {
      // A bounded wait also supports pages whose fonts or other resources never finish loading.
      let onLoad: (() => void) | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          (async () => {
            if (document.readyState !== 'complete')
              await new Promise<void>((resolve) => {
                onLoad = resolve;
                window.addEventListener('load', onLoad, { once: true });
              });
            await document.fonts?.ready;
          })(),
          new Promise<void>((resolve) => {
            timeout = setTimeout(resolve, 3000);
          }),
        ]);
        if (request.cancelled) return;
        const profile = extractBrandingProfile(document, window);
        window.parent.postMessage(
          { protocol: BRANDING_PROTOCOL, type: 'profile', channel: request.channel, profile },
          parentOrigin,
        );
      } catch {
        if (!request.cancelled)
          window.parent.postMessage(
            { protocol: BRANDING_PROTOCOL, type: 'error', channel: request.channel },
            parentOrigin,
          );
      } finally {
        clearTimeout(timeout);
        if (onLoad) window.removeEventListener('load', onLoad);
      }
    })();
  });
}
