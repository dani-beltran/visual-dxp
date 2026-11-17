import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './EditorApp.css';

export const metadata: Metadata = {
  title: 'Visual DXP — Experience Builder',
  description:
    'Build website workflows visually, test them live, and export standalone JavaScript.',
  icons: {
    icon: '/visual-dxp-symbol.png',
  },
};

export const viewport: Viewport = { themeColor: '#f7f9f8' };

// Load web fonts from the document, never via @import in bundled CSS: if Google Fonts is
// unreachable (offline, firewall, privacy blocker), the interface uses its fallback fonts
// instead of failing the editor's dynamically loaded CSS chunk.
const fontsUrl =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;550;600;650;700&family=Manrope:wght@400;500;600;650;700;750;800&display=swap';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={fontsUrl} />
      </head>
      <body>{children}</body>
    </html>
  );
}
