import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The site may be framed by Telegram (Mini App on the web client) and by nobody else.
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
          },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // Data for the app, not pages: crawlers may fetch it (the map needs /api/map to draw), but it has no place in search results.
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/tonconnect-manifest.json', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    ];
  },
};

export default nextConfig;
