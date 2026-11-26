import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/jura';
import '@fontsource-variable/golos-text';
import './globals.css';

const SITE = 'https://grammap.app';
const DESCRIPTION =
  'A sheet of one million pixels on TON. Buy an area with GRAM from your wallet and put your picture and link on it.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'GramMap — pixel map on TON',
  description: DESCRIPTION,
  applicationName: 'GramMap',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'GramMap',
    title: 'GramMap — pixel map on TON',
    description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'GramMap: a blueprint sheet of pixels' }],
  },
  twitter: { card: 'summary_large_image', title: 'GramMap — pixel map on TON', description: DESCRIPTION, images: ['/og.png'] },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/icon-180.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The map handles pinch itself; page zoom would fight it.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#071a38',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
