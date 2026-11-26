import { loadPageData } from '@/lib/page-data';
import { llmsTxt } from '@/lib/seo';

// The numbers in the file are at most five minutes old.
export const revalidate = 300;

/** A short brief of the site for language models, in the llms.txt layout. */
export async function GET() {
  const { config, plots } = await loadPageData();
  return new Response(llmsTxt(config, plots), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
