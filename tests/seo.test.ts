import { describe, expect, it } from 'vitest';
import { changedPlotUrls } from '@/lib/indexnow';
import {
  AI_AGENTS,
  aboutJsonLd,
  homeJsonLd,
  isIndexable,
  jsonLdText,
  llmsFullTxt,
  llmsTxt,
  mapStats,
  plotJsonLd,
  robotsFile,
  sitemapEntries,
} from '@/lib/seo';
import { PAGES, SITE_URL, absolute, siteContent } from '@/lib/seo-content';
import type { Plot, PublicConfig } from '@/lib/types';

const config: PublicConfig = {
  network: 'mainnet',
  gridW: 1000,
  gridH: 1000,
  pricePerPixel: '2500000000',
  editFee: '300000000',
  maxSide: 200,
  maxArea: 10000,
  reserved: [],
  treasury: 'UQ-treasury',
  salesOpen: true,
  telegramUrl: null,
};

const ALICE = '0:' + 'a'.repeat(64);
const BOB = '0:' + 'b'.repeat(64);

function plot(x: number, y: number, w: number, h: number, extra: Partial<Plot> = {}): Plot {
  return {
    id: `${x}-${y}`,
    x,
    y,
    w,
    h,
    owner: ALICE,
    lt: '1',
    hash: 'h',
    utime: 1_800_000_000,
    paid: (BigInt(w * h) * BigInt(2_500_000_000)).toString(),
    content: { title: `Plot at ${x}`, url: 'https://example.com/', image: null },
    contentHash: '1'.repeat(24),
    hidden: false,
    updatedAt: 1_800_000_000,
    ...extra,
  };
}

const shown = plot(10, 20, 10, 10, { updatedAt: 1_800_000_500 });
const empty = plot(100, 100, 5, 5, { content: null, contentHash: null, owner: BOB });
const hidden = plot(200, 200, 4, 4, { hidden: true, content: { title: 'Taken down', url: null, image: null } });
const plots = [shown, empty, hidden];

describe('robots.txt', () => {
  const robots = robotsFile();
  const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];

  it('names the AI crawlers and lets them in', () => {
    const named = rules.flatMap((r) => r.userAgent ?? []);
    for (const agent of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended']) {
      expect(named).toContain(agent);
    }
    expect(named).toContain('*');
    expect(new Set(AI_AGENTS).size).toBe(AI_AGENTS.length);
  });

  it('repeats the full rules in every group, because a crawler reads only its own', () => {
    for (const rule of rules) {
      expect(rule.allow).toEqual(['/', '/api/map']);
      expect(rule.disallow).toEqual(['/api/']);
    }
  });

  it('points to the sitemap', () => {
    expect(robots.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe('sitemap', () => {
  const entries = sitemapEntries(plots);
  const urls = entries.map((e) => e.url);

  it('lists every page in both languages with its alternates', () => {
    for (const page of Object.values(PAGES)) {
      for (const lang of ['en', 'ru'] as const) {
        const entry = entries.find((e) => e.url === absolute(page[lang]));
        expect(entry?.alternates?.languages).toEqual({
          en: absolute(page.en),
          ru: absolute(page.ru),
          'x-default': absolute(page.en),
        });
      }
    }
  });

  it('lists plots that show something, and only those', () => {
    expect(urls).toContain(`${SITE_URL}/plot/10-20`);
    expect(urls).not.toContain(`${SITE_URL}/plot/100-100`);
    expect(urls).not.toContain(`${SITE_URL}/plot/200-200`);
    expect(entries).toHaveLength(6 + 1);
  });

  it('dates the map pages by the newest plot', () => {
    const home = entries.find((e) => e.url === SITE_URL);
    expect(home?.lastModified).toEqual(new Date(1_800_000_500 * 1000));
  });

  it('works for an empty map', () => {
    expect(sitemapEntries([])).toHaveLength(6);
  });
});

describe('llms.txt', () => {
  const now = new Date('2026-11-26T10:00:00Z');
  const brief = llmsTxt(config, plots, now);
  const full = llmsFullTxt(config, plots, now);

  it('opens with the title and a one-paragraph summary', () => {
    const lines = brief.split('\n');
    expect(lines[0]).toBe('# GramMap');
    expect(lines[2].startsWith('> GramMap is a pixel map on the TON blockchain')).toBe(true);
  });

  it('takes prices from the settings, never from the text', () => {
    expect(brief).toContain('- Price: 2.5 GRAM per pixel');
    expect(brief).toContain('- Changing the picture or link: 0.3 GRAM');
    expect(full).toContain('A 10 × 10 area costs 250 GRAM');
  });

  it('reports the live numbers', () => {
    expect(brief).toContain('Sold so far: 141 of 1,000,000 pixels, in 3 plots held by 2 owners (as of 2026-11-26 10:00 UTC)');
  });

  it('says nothing about sales it cannot see', () => {
    expect(llmsTxt(config, null, now)).not.toContain('Sold so far');
    expect(llmsFullTxt(config, null, now)).not.toContain('Latest plots');
  });

  it('links only to pages and data that exist', () => {
    const links = [...brief.matchAll(/\]\((https:[^)]+)\)/g)].map((m) => m[1]);
    expect(links).toEqual([
      SITE_URL,
      `${SITE_URL}/about`,
      `${SITE_URL}/llms-full.txt`,
      `${SITE_URL}/api/map`,
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/terms`,
      `${SITE_URL}/ru/about`,
    ]);
  });

  it('lists shown plots in the full file and keeps hidden content out', () => {
    expect(full).toContain(`- [Plot at 10](${SITE_URL}/plot/10-20): 10 × 10 px at X 10, Y 20`);
    expect(full).not.toContain('Taken down');
    expect(full).not.toContain('/plot/100-100');
  });

  it('keeps an owner\'s title from breaking the Markdown link', () => {
    const tricky = plot(1, 1, 1, 1, { content: { title: 'Sale] (http://evil.example) [x', url: null, image: null } });
    expect(llmsFullTxt(config, [tricky], now)).toContain(`- [Sale (http://evil.example) x](${SITE_URL}/plot/1-1)`);
  });

  it('carries every question and answer in the full file', () => {
    for (const f of siteContent('en', config).faq) {
      expect(full).toContain(`### ${f.q}`);
      expect(full).toContain(f.a);
    }
  });
});

describe('structured data', () => {
  const en = siteContent('en', config);

  it('describes the site on the home page', () => {
    const graph = homeJsonLd(en)['@graph'] as { '@type': string }[];
    expect(graph.map((node) => node['@type'])).toEqual(['Organization', 'WebSite', 'WebApplication']);
  });

  it('marks up the same questions the About page shows', () => {
    const graph = aboutJsonLd(en)['@graph'] as { '@type': string; mainEntity?: { name: string; acceptedAnswer: { text: string } }[] }[];
    const faq = graph.find((node) => node['@type'] === 'FAQPage');
    expect(faq?.mainEntity?.map((q) => q.name)).toEqual(en.faq.map((f) => f.q));
    expect(faq?.mainEntity?.[1].acceptedAnswer.text).toContain('2.5 GRAM per pixel');
  });

  it('leaves the picture of a hidden plot out', () => {
    const picture = { title: 'T', url: null, image: 'https://img.example/a.png' };
    expect(JSON.stringify(plotJsonLd(plot(1, 1, 2, 2, { content: picture }), 'T'))).toContain('img.example');
    expect(JSON.stringify(plotJsonLd(plot(1, 1, 2, 2, { content: picture, hidden: true }), 'Plot 1, 1'))).not.toContain('img.example');
  });

  it('cannot be closed from inside by a title', () => {
    const text = jsonLdText({ name: '</script><script>alert(1)</script>' });
    expect(text).not.toContain('<');
    expect(JSON.parse(text).name).toBe('</script><script>alert(1)</script>');
  });
});

describe('site copy', () => {
  const en = siteContent('en', config);
  const ru = siteContent('ru', config);

  it('says the same things in both languages', () => {
    expect(ru.facts).toHaveLength(en.facts.length);
    expect(ru.faq).toHaveLength(en.faq.length);
    expect(ru.sections.map((s) => s.id)).toEqual(en.sections.map((s) => s.id));
    expect(ru.sections.map((s) => s.steps?.length)).toEqual(en.sections.map((s) => s.steps?.length));
  });

  it('follows the settings in both languages', () => {
    for (const c of [en, ru]) {
      expect(c.homeDescription).toContain('2.5 GRAM');
      expect(c.facts.some((f) => f.value.includes('2.5 GRAM'))).toBe(true);
      expect(c.faq.some((f) => f.a.includes('0.3 GRAM'))).toBe(true);
    }
  });

  it('keeps titles and descriptions within what search results show', () => {
    for (const c of [en, ru]) {
      expect(c.homeTitle.length).toBeLessThanOrEqual(65);
      expect(c.aboutTitle.length).toBeLessThanOrEqual(65);
      expect(c.homeDescription.length).toBeLessThanOrEqual(170);
      expect(c.aboutDescription.length).toBeLessThanOrEqual(170);
    }
  });
});

describe('map numbers', () => {
  it('counts pixels, plots, owners and volume', () => {
    expect(mapStats(plots)).toEqual({ pixels: 141, plots: 3, owners: 2, volume: BigInt(141) * BigInt(2_500_000_000) });
  });

  it('treats a plot as worth indexing only while it shows content', () => {
    expect(isIndexable(shown)).toBe(true);
    expect(isIndexable(empty)).toBe(false);
    expect(isIndexable(hidden)).toBe(false);
  });
});

describe('IndexNow', () => {
  it('announces plots whose content changed inside the window', () => {
    expect(changedPlotUrls(plots, 1_800_000_400)).toEqual([`${SITE_URL}/plot/10-20`]);
    expect(changedPlotUrls(plots, 1_800_000_600)).toEqual([]);
    // Hidden and empty plots are never announced, however new.
    expect(changedPlotUrls(plots, 0)).toEqual([`${SITE_URL}/plot/10-20`]);
  });
});
