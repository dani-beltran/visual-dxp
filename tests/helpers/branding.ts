import type { BrandingProfile } from '../../src/lib/branding';

export function brandingProfile(websiteUrl = 'https://brand.example/'): BrandingProfile {
  return {
    version: 2,
    websiteUrl,
    capturedAt: '2026-10-05T10:00:00.000Z',
    viewport: { width: 1440, height: 900 },
    colors: {
      pageBackground: [{ value: 'rgb(250, 250, 250)', sampleCount: 1, roleSource: 'observed' }],
      surfaceBackground: [{ value: 'rgb(255, 255, 255)', sampleCount: 2, roleSource: 'observed' }],
      text: [{ value: 'rgb(20, 20, 20)', sampleCount: 5, roleSource: 'inferred' }],
      mutedText: [{ value: 'rgb(120, 120, 120)', sampleCount: 2, roleSource: 'inferred' }],
      border: [{ value: 'rgb(220, 220, 220)', sampleCount: 3, roleSource: 'observed' }],
      accent: [{ value: 'rgb(38, 116, 86)', sampleCount: 3, roleSource: 'inferred' }],
    },
    typography: {
      body: [{ style: { fontFamily: 'Inter, sans-serif', fontSize: '16px' }, sampleCount: 5 }],
      h1: [
        { style: { fontFamily: 'Georgia', fontSize: '48px', fontWeight: '700' }, sampleCount: 1 },
      ],
      h2: [
        { style: { fontFamily: 'Georgia', fontSize: '32px', fontWeight: '600' }, sampleCount: 2 },
      ],
      caption: [{ style: { fontSize: '12px', letterSpacing: '1px' }, sampleCount: 2 }],
    },
    buttons: [
      {
        style: { backgroundColor: 'rgb(38, 116, 86)', borderRadius: '6px' },
        sampleCount: 1,
        variant: 'filled',
        role: 'likely-primary',
        evidence: ['contrasting-fill', 'large-target', 'main-content'],
      },
      {
        style: { color: 'rgb(38, 116, 86)', borderWidth: '1px' },
        sampleCount: 3,
        variant: 'outline',
        role: 'unknown',
        evidence: [],
      },
      {
        style: { color: 'rgb(38, 116, 86)', borderWidth: '0px' },
        sampleCount: 2,
        variant: 'text',
        role: 'unknown',
        evidence: [],
      },
    ],
    links: [],
  };
}
