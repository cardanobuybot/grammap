import type { MetadataRoute } from 'next';
import { loadPageData } from '@/lib/page-data';
import { sitemapEntries } from '@/lib/seo';

// New plots get into the sitemap within five minutes.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { plots } = await loadPageData();
  return sitemapEntries(plots ?? []);
}
