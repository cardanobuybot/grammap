import { isIndexable } from './seo';
import { CONTENT_UPDATED, INDEXNOW_KEY, PAGES, SITE_URL, absolute, plotPath } from './seo-content';
import { getStore } from './store';
import type { Plot } from './types';

/**
 * IndexNow tells Bing, Yandex and the other engines behind it that a page is new or changed,
 * so they fetch it now instead of whenever they next come by. The key is public: the engines
 * check it against /<key>.txt on the site.
 */

const ENDPOINT = 'https://api.indexnow.org/indexnow';
/** The daily run looks a little further back than a day, so nothing falls between two runs. */
const PLOT_WINDOW_S = 26 * 3600;

export async function submitUrls(urls: readonly string[]): Promise<void> {
  if (urls.length === 0) return;
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(SITE_URL).host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: urls.slice(0, 10_000),
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`IndexNow answered ${response.status}`);
}

const pageUrls = () => Object.values(PAGES).flatMap((p) => [absolute(p.en), absolute(p.ru)]);
const homeUrls = () => [absolute(PAGES.home.en), absolute(PAGES.home.ru)];

/** Pages of plots whose content appeared or changed since `sinceUtime`. */
export function changedPlotUrls(plots: readonly Plot[], sinceUtime: number): string[] {
  return plots.filter((p) => isIndexable(p) && p.updatedAt >= sinceUtime).map((p) => absolute(plotPath(p.id)));
}

export interface AnnounceResult {
  /** URLs sent in this run. */
  submitted: number;
  skipped?: 'not_production';
}

/**
 * Announces what changed. The pages of text go out once per version of their copy, the plots
 * once a day; a marker file per announcement keeps repeated runs from sending it again.
 */
export async function announceChanges(plots: readonly Plot[], now = new Date()): Promise<AnnounceResult> {
  if (process.env.VERCEL_ENV !== 'production') return { submitted: 0, skipped: 'not_production' };
  const store = getStore();
  let submitted = 0;

  const send = async (marker: string, urls: () => string[]) => {
    // Create-only: of two runs at the same moment, one gets `false` and stays quiet.
    if (!(await store.createText(marker, now.toISOString()))) return;
    const list = urls();
    try {
      await submitUrls(list);
      submitted += list.length;
    } catch (e) {
      // Not announced after all: let the next run try again.
      await store.remove([marker]).catch(() => {});
      throw e;
    }
  };

  await send(`seo/pages/${CONTENT_UPDATED}.txt`, pageUrls);

  const day = now.toISOString().slice(0, 10);
  const today = `seo/plots/${day}.txt`;
  await send(today, () => {
    const changed = changedPlotUrls(plots, Math.floor(now.getTime() / 1000) - PLOT_WINDOW_S);
    // The home pages list the newest plots, so they changed as well.
    return changed.length ? [...homeUrls(), ...changed] : [];
  });

  const old = (await store.listPaths('seo/plots/')).filter((path) => path !== today);
  if (old.length) await store.remove(old).catch(() => {});

  return { submitted };
}
