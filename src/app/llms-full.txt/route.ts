import { loadPageData } from '@/lib/page-data';
import { llmsFullTxt } from '@/lib/seo';

// The numbers in the file are at most five minutes old.
export const revalidate = 300;

/** Everything the site says about itself, as one Markdown file for language models. */
export async function GET() {
  const { config, plots } = await loadPageData();
  return new Response(llmsFullTxt(config, plots), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
