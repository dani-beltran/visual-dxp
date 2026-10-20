/** Bounded, data-only branding context shared by the bridge, editor and AI server. */
export const BRANDING_PROTOCOL = 'visual-dxp:branding';
// Keep the storage slot so existing captures can be migrated on read.
export const BRANDING_STORAGE_KEY = 'visual-dxp:branding:v1';
export const BRANDING_SAMPLE_LIMIT = 300;
export const BRANDING_VARIANT_LIMIT = 5;
export const BRANDING_TYPOGRAPHY_KEYS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textTransform',
  'textDecoration',
  'textDecorationLine',
] as const;
export const BRANDING_STYLE_KEYS = [
  'color',
  'backgroundColor',
  ...BRANDING_TYPOGRAPHY_KEYS,
  'borderRadius',
  'borderColor',
  'borderWidth',
  'borderStyle',
  'padding',
  'boxShadow',
] as const;
export const BRANDING_TYPOGRAPHY_ROLES = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'body',
  'caption',
] as const;
export const BRANDING_COLOR_ROLES = [
  'pageBackground',
  'surfaceBackground',
  'text',
  'mutedText',
  'border',
  'accent',
] as const;
export const BRANDING_BUTTON_VARIANTS = ['filled', 'outline', 'text', 'unknown'] as const;
export const BRANDING_CTA_EVIDENCE = ['contrasting-fill', 'large-target', 'main-content'] as const;
export type BrandingStyle = Partial<Record<(typeof BRANDING_STYLE_KEYS)[number], string>>;
export interface BrandingStyleSample {
  style: BrandingStyle;
  sampleCount: number;
}
export interface BrandingButtonSample extends BrandingStyleSample {
  variant: (typeof BRANDING_BUTTON_VARIANTS)[number];
  role: 'likely-primary' | 'unknown';
  /** Bounded visual evidence for the inferred role; frequency alone is never evidence. */
  evidence: (typeof BRANDING_CTA_EVIDENCE)[number][];
}
export interface BrandingColorSample {
  /** Always a rendered value, never a generated color. */
  value: string;
  sampleCount: number;
  /** Whether association with this role is directly observed or heuristic. */
  roleSource: 'observed' | 'inferred';
}
export interface BrandingProfile {
  version: 2;
  websiteUrl: string;
  capturedAt: string;
  viewport: { width: number; height: number };
  colors: Partial<Record<(typeof BRANDING_COLOR_ROLES)[number], BrandingColorSample[]>>;
  typography: Partial<Record<(typeof BRANDING_TYPOGRAPHY_ROLES)[number], BrandingStyleSample[]>>;
  buttons: BrandingButtonSample[];
  links: BrandingStyleSample[];
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
    typeof item === 'string' && item.trim().length > 0 && item.length <= max ? item : fail();
  const number = (item: unknown, max: number): number =>
    typeof item === 'number' && Number.isInteger(item) && item > 0 && item <= max ? item : fail();
  const choice = <T extends string>(item: unknown, choices: readonly T[]): T =>
    choices.includes(item as T) ? (item as T) : fail();
  const array = <T>(item: unknown, max: number, parse: (entry: unknown) => T): T[] =>
    Array.isArray(item) && item.length <= max ? item.map(parse) : fail();
  const sample = (item: unknown, keys: readonly (keyof BrandingStyle)[]): BrandingStyleSample => {
    const element = object(item);
    const style = object(element.style);
    const parsed: BrandingStyle = {};
    for (const key of keys) {
      if (style[key] !== undefined) parsed[key] = text(style[key]);
    }
    if (!Object.keys(parsed).length) fail();
    return { style: parsed, sampleCount: number(element.sampleCount, BRANDING_SAMPLE_LIMIT) };
  };
  const input = object(value);
  if (input.version !== 1 && input.version !== 2) fail();
  const url = text(input.websiteUrl, 4000);
  if (websiteUrl !== undefined && url !== websiteUrl) fail();
  const capturedAt = text(input.capturedAt, 40);
  if (!Number.isFinite(Date.parse(capturedAt))) fail();
  const viewport = object(input.viewport);
  const colors = object(input.colors);
  const result: BrandingProfile = {
    version: 2,
    websiteUrl: url,
    capturedAt,
    viewport: { width: number(viewport.width, 10000), height: number(viewport.height, 10000) },
    colors: {},
    typography: {},
    buttons: [],
    links: [],
  };
  if (input.version === 1) {
    const elements = object(input.elements);
    // Validate old fields too, but don't preserve the old frequency-based primary claim
    // or assign a heading level that the old bridge never recorded.
    for (const role of ['background', 'text', 'primary', 'link']) {
      if (colors[role] !== undefined) text(colors[role]);
    }
    for (const role of ['body', 'heading', 'button', 'link']) {
      if (elements[role] === undefined) continue;
      const legacy = sample(elements[role], BRANDING_STYLE_KEYS);
      if (role === 'body' && BRANDING_TYPOGRAPHY_KEYS.some((key) => legacy.style[key]))
        result.typography.body = [sample(elements[role], BRANDING_TYPOGRAPHY_KEYS)];
      if (role === 'button')
        result.buttons = [{ ...legacy, variant: 'unknown', role: 'unknown', evidence: [] }];
      if (role === 'link') result.links = [legacy];
      if (role === 'body') {
        for (const [key, colorRole] of [
          ['backgroundColor', 'pageBackground'],
          ['color', 'text'],
        ] as const) {
          if (legacy.style[key])
            result.colors[colorRole] = [
              {
                value: legacy.style[key],
                sampleCount: legacy.sampleCount,
                roleSource: colorRole === 'text' ? 'inferred' : 'observed',
              },
            ];
        }
      }
    }
    // Heading-only legacy captures have no reliable mapping; recapture instead.
  } else {
    const typography = object(input.typography);
    for (const role of BRANDING_TYPOGRAPHY_ROLES) {
      if (typography[role] !== undefined) {
        const samples = array(typography[role], 2, (entry) =>
          sample(entry, BRANDING_TYPOGRAPHY_KEYS),
        );
        if (!samples.length) fail();
        result.typography[role] = samples;
      }
    }
    for (const role of BRANDING_COLOR_ROLES) {
      if (colors[role] === undefined) continue;
      const samples = array(colors[role], 3, (entry): BrandingColorSample => {
        const color = object(entry);
        return {
          value: text(color.value),
          sampleCount: number(color.sampleCount, BRANDING_SAMPLE_LIMIT),
          roleSource: choice(color.roleSource, ['observed', 'inferred']),
        };
      });
      if (!samples.length) fail();
      result.colors[role] = samples;
    }
    result.buttons = array(input.buttons, BRANDING_VARIANT_LIMIT, (entry): BrandingButtonSample => {
      const button = object(entry);
      const parsed = {
        ...sample(entry, BRANDING_STYLE_KEYS),
        variant: choice(button.variant, BRANDING_BUTTON_VARIANTS),
        role: choice(button.role, ['likely-primary', 'unknown'] as const),
        evidence: array(button.evidence, 3, (item) => choice(item, BRANDING_CTA_EVIDENCE)),
      };
      if (new Set(parsed.evidence).size !== parsed.evidence.length) fail();
      if (
        parsed.role === 'likely-primary'
          ? parsed.evidence.length < 3 || parsed.variant !== 'filled'
          : parsed.evidence.length > 0
      )
        fail();
      return parsed;
    });
    if (result.buttons.filter((button) => button.role === 'likely-primary').length > 1) fail();
    result.links = array(input.links, 2, (entry) => sample(entry, BRANDING_STYLE_KEYS));
  }
  if (
    !Object.keys(result.typography).length &&
    !result.buttons.length &&
    !result.links.length &&
    !Object.keys(result.colors).length
  )
    fail();
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
