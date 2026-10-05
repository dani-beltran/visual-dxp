import type { BrandingProfile } from '../../src/lib/branding';

export function brandingProfile(websiteUrl = 'https://brand.example/'): BrandingProfile {
  return {
    version: 1,
    websiteUrl,
    capturedAt: '2026-10-05T10:00:00.000Z',
    viewport: { width: 1440, height: 900 },
    colors: { primary: 'rgb(38, 116, 86)', text: 'rgb(20, 20, 20)' },
    elements: {
      body: {
        style: { fontFamily: 'Inter, sans-serif', color: 'rgb(20, 20, 20)' },
        sampleCount: 1,
      },
      button: {
        style: { backgroundColor: 'rgb(38, 116, 86)', borderRadius: '6px' },
        sampleCount: 3,
      },
    },
  };
}
