/** Addresses of the site's pages. Tiny and dependency-free, so the map bundle can use it too. */

/** Paths of the same page in both languages, for hreflang and the language links. */
export const PAGES = {
  home: { en: '/', ru: '/ru' },
  about: { en: '/about', ru: '/ru/about' },
  terms: { en: '/terms', ru: '/ru/terms' },
} as const;

export type PageKey = keyof typeof PAGES;

/** A plot's own page; `id` is "x-y" of its top-left pixel. */
export const plotPath = (id: string) => `/plot/${id}`;
