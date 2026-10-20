import {
  BRANDING_BUTTON_VARIANTS,
  BRANDING_PROTOCOL,
  BRANDING_SAMPLE_LIMIT,
  BRANDING_STYLE_KEYS,
  BRANDING_TYPOGRAPHY_KEYS,
  BRANDING_VARIANT_LIMIT,
  type BrandingButtonSample,
  type BrandingColorSample,
  type BrandingProfile,
  type BrandingStyle,
  type BrandingStyleSample,
} from './branding';

const BUTTON_SELECTOR =
  'button, [role="button"], input[type="submit"], input[type="button"], a[class*="btn"], a[class*="button"]';
const EXCLUDED =
  '[data-visual-dxp-picker], [data-visual-dxp-popover], [data-visual-dxp-overlay], script, style, template, noscript';

function hasColor(color: string | undefined): color is string {
  return (
    !!color &&
    color !== 'transparent' &&
    !/^(?:rgba\([^)]*,|[^)]*\/)\s*0(?:\.0+)?%?\s*\)$/.test(color)
  );
}

/** Unknown color syntaxes stay in the palette but cannot support a contrast inference. */
function luminance(color: string | undefined): number | undefined {
  if (!color) return undefined;
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(
    color,
  );
  if (!match || (match[4] !== undefined && Number(match[4]) !== 1)) return undefined;
  const rgb = match.slice(1, 4).map((part) => {
    const channel = Number(part) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string | undefined, b: string | undefined): number | undefined {
  const left = luminance(a);
  const right = luminance(b);
  return left === undefined || right === undefined
    ? undefined
    : (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

/** Extract rendered styles only: no HTML, form values, or page copy is transported. */
export function extractBrandingProfile(doc: Document, win: Window): BrandingProfile {
  const styles = new WeakMap<Element, CSSStyleDeclaration>();
  const computed = (element: Element) => {
    let style = styles.get(element);
    if (!style) {
      style = win.getComputedStyle(element);
      styles.set(element, style);
    }
    return style;
  };
  const visible = (element: Element) => {
    if (element.closest(EXCLUDED) || !element.getClientRects().length) return false;
    for (let current: Element | null = element; current; current = current.parentElement) {
      const style = computed(current);
      if (
        current.hasAttribute('hidden') ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.contentVisibility === 'hidden' ||
        Number.parseFloat(style.opacity) === 0
      )
        return false;
    }
    return true;
  };
  const readStyle = (element: Element, keys: readonly (keyof BrandingStyle)[]): BrandingStyle => {
    const style: BrandingStyle = {};
    for (const key of keys) {
      const value = computed(element)[key];
      if (value && value.length <= 300) style[key] = value;
    }
    return style;
  };
  const group = <T extends BrandingStyleSample>(groups: Map<string, T>, sample: T): T => {
    const key = JSON.stringify('variant' in sample ? [sample.style, sample.variant] : sample.style);
    const existing = groups.get(key);
    if (existing) {
      existing.sampleCount++;
      return existing;
    }
    groups.set(key, sample);
    return sample;
  };
  // Explicit tie breaks make output independent of engine sort stability.
  const ranked = <T extends BrandingStyleSample>(groups: Map<string, T>) =>
    [...groups.values()].sort(
      (a, b) =>
        b.sampleCount - a.sampleCount ||
        JSON.stringify(a.style).localeCompare(JSON.stringify(b.style), 'en'),
    );
  const sampleCounts = new Map<string, number>();
  const takeSample = (category: string) => {
    const count = sampleCounts.get(category) ?? 0;
    if (count >= BRANDING_SAMPLE_LIMIT) return false;
    sampleCounts.set(category, count + 1);
    return true;
  };
  const typographyGroups = new Map<string, Map<string, BrandingStyleSample>>();
  const paragraphs = new Map<string, BrandingStyleSample>();
  const flowingProse = new Map<string, BrandingStyleSample>();
  const buttons = new Map<string, BrandingButtonSample>();
  const links = new Map<string, BrandingStyleSample>();
  const palette = new Map<keyof BrandingProfile['colors'], Map<string, BrandingColorSample>>();
  const textColors = new Map<string, BrandingColorSample>();
  const addColor = (
    role: keyof BrandingProfile['colors'],
    value: string | undefined,
    inferred = false,
  ) => {
    if (!hasColor(value) || value.length > 300 || !takeSample(`color:${role}`)) return;
    let colors = palette.get(role);
    if (!colors) {
      colors = new Map();
      palette.set(role, colors);
    }
    const existing = colors.get(value);
    if (existing) existing.sampleCount++;
    else
      colors.set(value, { value, sampleCount: 1, roleSource: inferred ? 'inferred' : 'observed' });
  };
  const background = (element: Element | null): string | undefined => {
    for (let current = element; current; current = current.parentElement) {
      const value = computed(current).backgroundColor;
      if (luminance(value) !== undefined) return value;
      // Do not pretend a translucent/unsupported background is opaque.
      if (hasColor(value)) return undefined;
    }
    return undefined;
  };
  const prominent: { sample: BrandingButtonSample; score: number }[] = [];
  const walker = doc.createTreeWalker(doc.documentElement, 1);
  let inspected = 0;
  let sampled = 0;
  let node: Node | null = doc.documentElement;
  // Bound traversal independently of category quotas so navigation cannot starve headings or CTAs.
  while (node && inspected++ < 2000) {
    const element = node as Element;
    node = walker.nextNode();
    if (!visible(element)) continue;
    sampled++;
    const style = computed(element);
    const tag = element.tagName.toLowerCase();
    const isButton = element.matches(BUTTON_SELECTOR);
    const isLink = tag === 'a' && element.hasAttribute('href') && !isButton;
    // Inspect only whether direct text is present; never retain its content.
    let hasText = false;
    let checkedChildren = 0;
    for (
      let child = element.firstChild;
      child && checkedChildren++ < BRANDING_SAMPLE_LIMIT;
      child = child.nextSibling
    ) {
      if (child.nodeType === 3 && /\S/.test(child.nodeValue ?? '')) {
        hasText = true;
        break;
      }
    }
    const caption =
      element.matches('small, figcaption, caption') ||
      (hasText && !!element.closest('small, figcaption, caption'));
    const role = /^h[1-6]$/.test(tag)
      ? tag
      : caption
        ? 'caption'
        : hasText &&
            !isButton &&
            !isLink &&
            !element.closest(
              `${BUTTON_SELECTOR}, a[href], svg, h1, h2, h3, h4, h5, h6, label, select, textarea`,
            )
          ? 'body'
          : undefined;
    if (role) {
      const sample = { style: readStyle(element, BRANDING_TYPOGRAPHY_KEYS), sampleCount: 1 };
      if (Object.keys(sample.style).length) {
        let groups = typographyGroups.get(role);
        if (!groups) {
          groups = new Map();
          typographyGroups.set(role, groups);
        }
        if (takeSample(`typography:${role}`)) group(groups, sample);
        if (
          role === 'body' &&
          element.matches('p, li, dd, dt, blockquote, [role="paragraph"]') &&
          takeSample('prose')
        ) {
          group(paragraphs, { ...sample, sampleCount: 1 });
          const size = Number.parseFloat(style.fontSize);
          const lineHeight = Number.parseFloat(style.lineHeight);
          if (size > 0 && lineHeight >= size * 1.3)
            group(flowingProse, { ...sample, sampleCount: 1 });
        }
      }
    }
    if (tag === 'html' || tag === 'body') addColor('pageBackground', style.backgroundColor);
    else if (!isButton && !isLink) addColor('surfaceBackground', style.backgroundColor);
    // Count each distinct border color once per element, including asymmetric borders.
    const borderColors = new Set<string>();
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      if (
        Number.parseFloat(style[`border${side}Width`]) > 0 &&
        !['none', 'hidden'].includes(style[`border${side}Style`]) &&
        hasColor(style[`border${side}Color`])
      ) {
        borderColors.add(style[`border${side}Color`]);
      }
    }
    for (const color of borderColors) addColor('border', color);
    if (
      hasText &&
      hasColor(style.color) &&
      !element.closest(`${BUTTON_SELECTOR}, a[href], svg, label, select, textarea`) &&
      takeSample('textColors')
    ) {
      const existing = textColors.get(style.color);
      if (existing) existing.sampleCount++;
      else
        textColors.set(style.color, { value: style.color, sampleCount: 1, roleSource: 'inferred' });
    }
    if (isLink && takeSample('links')) {
      group(links, { style: readStyle(element, BRANDING_STYLE_KEYS), sampleCount: 1 });
      if (style.color !== computed(doc.body).color) addColor('accent', style.color, true);
    }
    if (!isButton || !takeSample('buttons')) continue;
    const buttonStyle = readStyle(element, BRANDING_STYLE_KEYS);
    const backdrop = background(element.parentElement);
    const fillContrast = contrast(style.backgroundColor, backdrop);
    const hasFill = hasColor(style.backgroundColor) && style.backgroundColor !== backdrop;
    const variant = hasFill
      ? 'filled'
      : style.backgroundImage && style.backgroundImage !== 'none'
        ? 'unknown'
        : borderColors.size
          ? 'outline'
          : 'text';
    const sample = group(buttons, {
      style: buttonStyle,
      sampleCount: 1,
      variant,
      role: 'unknown',
      evidence: [],
    });
    if (hasFill) addColor('accent', style.backgroundColor, true);
    else if (style.color !== computed(doc.body).color) addColor('accent', style.color, true);
    const rect = element.getBoundingClientRect();
    const inMain = !!element.closest('main, [role="main"]');
    // Contrast, target size and main-content placement must agree. No copy/class-name hints.
    if (
      inMain &&
      fillContrast !== undefined &&
      fillContrast >= 2 &&
      (contrast(style.color, style.backgroundColor) ?? 0) >= 3 &&
      rect.width >= 64 &&
      rect.height >= 28 &&
      rect.width * rect.height >= 1800
    ) {
      prominent.push({ sample, score: Math.min(rect.width * rect.height, 30000) * fillContrast });
    }
  }
  // A tie between similarly prominent targets leaves the CTA role unknown, even for one style.
  prominent.sort((a, b) => b.score - a.score);
  if (prominent[0] && (!prominent[1] || prominent[0].score >= prominent[1].score * 1.5)) {
    prominent[0].sample.role = 'likely-primary';
    prominent[0].sample.evidence = ['contrasting-fill', 'large-target', 'main-content'];
  }
  const prose = flowingProse.size ? flowingProse : paragraphs;
  if (prose.size) {
    // Prefer rendered paragraphs over navigation, badges and footer labels. Where
    // line-height identifies flowing prose, smaller text is a useful caption sample.
    const sizes = [...prose.values()]
      .map((sample) => Number.parseFloat(sample.style.fontSize ?? ''))
      .filter((size) => size > 0);
    const captionThreshold = sizes.length ? Math.min(...sizes) * 0.85 : 0;
    for (const sample of typographyGroups.get('body')?.values() ?? []) {
      if (Number.parseFloat(sample.style.fontSize ?? '') >= captionThreshold) continue;
      if (!(Number.parseFloat(sample.style.fontSize ?? '') > 0)) continue;
      let captions = typographyGroups.get('caption');
      if (!captions) {
        captions = new Map();
        typographyGroups.set('caption', captions);
      }
      // These groups already count rendered elements; don't count grouping itself.
      const signature = JSON.stringify(sample.style);
      const existing = captions.get(signature);
      if (existing)
        existing.sampleCount = Math.min(
          BRANDING_SAMPLE_LIMIT,
          existing.sampleCount + sample.sampleCount,
        );
      else captions.set(signature, sample);
    }
    typographyGroups.set('body', prose);
  }
  if (!typographyGroups.has('body') && doc.body && visible(doc.body)) {
    const style = readStyle(doc.body, BRANDING_TYPOGRAPHY_KEYS);
    if (Object.keys(style).length)
      typographyGroups.set('body', new Map([['body', { style, sampleCount: 1 }]]));
  }
  const colorsRanked = (colors: Map<string, BrandingColorSample>) =>
    [...colors.values()].sort(
      (a, b) => b.sampleCount - a.sampleCount || a.value.localeCompare(b.value, 'en'),
    );
  const pageColor = background(doc.body);
  const mainColor = textColors.has(computed(doc.body).color)
    ? computed(doc.body).color
    : colorsRanked(textColors)[0]?.value;
  const mainContrast = contrast(mainColor, pageColor);
  for (const color of textColors.values()) {
    const ratio = contrast(color.value, pageColor);
    const muted =
      color.value !== mainColor &&
      ratio !== undefined &&
      mainContrast !== undefined &&
      ratio >= 1.5 &&
      ratio < mainContrast / 1.5;
    const role = muted ? 'mutedText' : 'text';
    let colors = palette.get(role);
    if (!colors) {
      colors = new Map();
      palette.set(role, colors);
    }
    colors.set(color.value, color);
  }
  const profile: BrandingProfile = {
    version: 2,
    websiteUrl: win.location.href,
    capturedAt: new Date().toISOString(),
    viewport: { width: win.innerWidth, height: win.innerHeight },
    colors: {},
    typography: {},
    buttons: [],
    links: ranked(links).slice(0, 2),
  };
  for (const [role, colors] of palette) {
    const samples = colorsRanked(colors);
    // Preserve the observed main-text color even if small labels are more frequent.
    if (role === 'text')
      samples.sort((a, b) => Number(b.value === mainColor) - Number(a.value === mainColor));
    profile.colors[role] = samples.slice(0, 3);
  }
  for (const role of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'caption'] as const) {
    const groups = typographyGroups.get(role);
    if (groups) profile.typography[role] = ranked(groups).slice(0, 2);
  }
  const candidates = ranked(buttons);
  const chosen = new Set<BrandingButtonSample>();
  const primary = candidates.find((button) => button.role === 'likely-primary');
  if (primary) chosen.add(primary);
  for (const variant of BRANDING_BUTTON_VARIANTS) {
    const representative = candidates.find((button) => button.variant === variant);
    if (representative) chosen.add(representative);
  }
  for (const candidate of candidates) {
    if (chosen.size >= BRANDING_VARIANT_LIMIT) break;
    chosen.add(candidate);
  }
  profile.buttons = [...chosen];
  if (!sampled) throw new Error('No rendered branding samples.');
  return profile;
}

export function installBrandingBridge(parentOrigin: string, targetUrl?: string) {
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
        if (targetUrl) profile.websiteUrl = targetUrl;
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
