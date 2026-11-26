import type { MetadataRoute } from 'next';
import { SITE_NAME, siteContent } from '@/lib/seo-content';
import { getServerConfig, toPublicConfig } from '@/lib/server-config';

/** Lets phones and desktops install the map as an app. */
export default function manifest(): MetadataRoute.Manifest {
  const c = siteContent('en', toPublicConfig(getServerConfig()));
  return {
    name: c.homeH1,
    short_name: SITE_NAME,
    description: c.homeDescription,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#071a38',
    theme_color: '#071a38',
    categories: ['business', 'finance'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
