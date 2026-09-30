import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../styles/demo.css';

export const metadata: Metadata = {
  title: 'Visual DXP — Experience Builder',
  description:
    'Build website workflows visually, test them live, and export standalone JavaScript.',
  icons: {
    icon: '/visual-dxp-symbol.png',
  },
};

export const viewport: Viewport = { themeColor: '#f7f9f8' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
