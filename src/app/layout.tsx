import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../styles/demo.css';

export const metadata: Metadata = {
  title: 'Visual DXP — Experience Builder',
  description:
    'Build website workflows visually, test them live, and export standalone JavaScript.',
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='12' fill='%231c7556'/%3E%3Cpath d='M12 28V12h17v5H17v3h9v5h-9v3z' fill='white'/%3E%3C/svg%3E",
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
