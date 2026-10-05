/** Bounded, data-only branding context shared by the bridge, editor and AI server. */
export const BRANDING_PROTOCOL = 'visual-dxp:branding';
export const BRANDING_STORAGE_KEY = 'visual-dxp:branding:v1';
export const BRANDING_STYLE_KEYS = [
  'color',
  'backgroundColor',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'borderRadius',
  'borderColor',
  'borderWidth',
  'borderStyle',
  'padding',
  'boxShadow',
] as const;
export type BrandingStyle = Partial<Record<(typeof BRANDING_STYLE_KEYS)[number], string>>;
export interface BrandingProfile {
  version: 1;
  websiteUrl: string;
  capturedAt: string;
  viewport: { width: number; height: number };
  colors: { background?: string; text?: string; primary?: string; link?: string };
  elements: Partial<
    Record<
      'body' | 'heading' | 'button' | 'link',
      {
        style: BrandingStyle;
        sampleCount: number;
      }
    >
  >;
}

/** Pick only known fields; never forward arbitrary website data to the model. */
export function parseBrandingProfile(value: unknown, websiteUrl?: string): BrandingProfile {
  const fail = (): never => {
    throw new Error('Invalid website branding profile.');
  };
  const object = (item: unknown): Record<string, unknown> =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : fail();
  const text = (item: unknown, max = 300): string =>
    typeof item === 'string' && item.length > 0 && item.length <= max ? item : fail();
  const number = (item: unknown, max: number): number =>
    typeof item === 'number' && Number.isInteger(item) && item > 0 && item <= max ? item : fail();
  const input = object(value);
  if (input.version !== 1) fail();
  const url = text(input.websiteUrl, 4000);
  if (websiteUrl !== undefined && url !== websiteUrl) fail();
  const capturedAt = text(input.capturedAt, 40);
  if (!Number.isFinite(Date.parse(capturedAt))) fail();
  const viewport = object(input.viewport);
  const colors = object(input.colors);
  const elements = object(input.elements);
  const result: BrandingProfile = {
    version: 1,
    websiteUrl: url,
    capturedAt,
    viewport: { width: number(viewport.width, 10000), height: number(viewport.height, 10000) },
    colors: {},
    elements: {},
  };
  for (const role of ['background', 'text', 'primary', 'link'] as const) {
    if (colors[role] !== undefined) result.colors[role] = text(colors[role]);
  }
  for (const role of ['body', 'heading', 'button', 'link'] as const) {
    if (elements[role] === undefined) continue;
    const element = object(elements[role]);
    const style = object(element.style);
    const parsed: BrandingStyle = {};
    for (const key of BRANDING_STYLE_KEYS) {
      if (style[key] !== undefined) parsed[key] = text(style[key]);
    }
    result.elements[role] = { style: parsed, sampleCount: number(element.sampleCount, 300) };
  }
  if (!Object.keys(result.elements).length) fail();
  return result;
}

function normalizedUrl(url: string): string {
  return new URL(url, window.location.href).href;
}
let sessionProfile: BrandingProfile | undefined;

export function saveBrandingProfile(profile: BrandingProfile, websiteUrl: string): boolean {
  const normalized = parseBrandingProfile({ ...profile, websiteUrl: normalizedUrl(websiteUrl) });
  sessionProfile = normalized;
  try {
    window.localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

/** A profile for another URL must never leak into the current workflow's AI context. */
export function readBrandingProfile(websiteUrl: string): BrandingProfile | undefined {
  try {
    const url = normalizedUrl(websiteUrl);
    let profile: BrandingProfile | undefined;
    try {
      const saved = window.localStorage.getItem(BRANDING_STORAGE_KEY);
      if (saved) profile = parseBrandingProfile(JSON.parse(saved), url);
    } catch {
      /* Storage may be unavailable, invalid or belong to a different website. */
    }
    if (
      sessionProfile?.websiteUrl === url &&
      (!profile || sessionProfile.capturedAt >= profile.capturedAt)
    )
      profile = sessionProfile;
    return profile ? { ...profile, websiteUrl } : undefined;
  } catch {
    return undefined;
  }
}
