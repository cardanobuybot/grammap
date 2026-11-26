import type { Metadata, Viewport } from 'next';
import { PAGES, SITE_NAME, SITE_URL, type PageKey, type SeoLang } from './seo-content';

/** Head tags shared by the pages. Kept apart from the copy so both root layouts use one definition. */

const OG_IMAGE = { url: '/og.png', width: 1200, height: 630, alt: 'GramMap: a blueprint sheet of pixels' };
const LOCALE: Record<SeoLang, string> = { en: 'en_US', ru: 'ru_RU' };

const env = (name: string) => process.env[name]?.trim() || undefined;

/** Everything that is the same on every page. Goes into the root layouts. */
export function baseMetadata(): Metadata {
  const bing = env('BING_SITE_VERIFICATION');
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    // Let search engines and AI answers quote as much of a page as they need, with large picture previews.
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
    },
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: '/icon-180.png',
    },
    // Ownership codes from the webmaster tools, when the site is confirmed by a meta tag.
    verification: {
      google: env('GOOGLE_SITE_VERIFICATION'),
      yandex: env('YANDEX_VERIFICATION'),
      ...(bing ? { other: { 'msvalidate.01': bing } } : {}),
    },
  };
}

/** Title, description, canonical address and language alternates of one of the paired pages. */
export function pageMetadata(page: PageKey, lang: SeoLang, title: string, description: string): Metadata {
  const paths = PAGES[page];
  const other: SeoLang = lang === 'en' ? 'ru' : 'en';
  return {
    title,
    description,
    alternates: {
      canonical: paths[lang],
      languages: { en: paths.en, ru: paths.ru, 'x-default': paths.en },
    },
    openGraph: {
      type: 'website',
      url: paths[lang],
      siteName: SITE_NAME,
      title,
      description,
      locale: LOCALE[lang],
      alternateLocale: [LOCALE[other]],
      images: [OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE.url] },
  };
}

/** Pages of text can be zoomed like any page. */
export const docViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#071a38',
  colorScheme: 'dark',
};

/** The map handles pinch itself; page zoom would fight it. */
export const mapViewport: Viewport = { ...docViewport, maximumScale: 1, userScalable: false };

export { OG_IMAGE };
