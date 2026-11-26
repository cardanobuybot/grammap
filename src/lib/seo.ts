import type { MetadataRoute } from 'next';
import { formatGrams } from './format';
import {
  CONTENT_UPDATED,
  PAGES,
  SITE_NAME,
  SITE_URL,
  absolute,
  plotPath,
  siteContent,
  type SiteContent,
} from './seo-content';
import type { Plot, PublicConfig } from './types';

/** Builders for everything crawlers read: robots.txt, the sitemap, llms.txt and structured data. */

export interface MapStats {
  pixels: number;
  plots: number;
  owners: number;
  /** Total paid for the plots on the map, in nanograms. */
  volume: bigint;
}

export function mapStats(plots: readonly Plot[]): MapStats {
  const owners = new Set<string>();
  let pixels = 0;
  let volume = BigInt(0);
  for (const p of plots) {
    pixels += p.w * p.h;
    volume += BigInt(p.paid);
    owners.add(p.owner);
  }
  return { pixels, plots: plots.length, owners: owners.size, volume };
}

/** A plot is worth a search result only when it shows something and is not hidden. */
export const isIndexable = (plot: Plot) => !plot.hidden && Boolean(plot.content);

export const newestFirst = (plots: readonly Plot[]) => [...plots].sort((a, b) => b.updatedAt - a.updatedAt);

/* ------------------------------------------------------------------ robots.txt */

/**
 * Crawlers of AI search engines and assistants, named so that their access is a stated
 * decision and not an accident of the wildcard rule. Names as published by the vendors.
 */
export const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Amazonbot',
  'Amzn-SearchBot',
  'meta-externalagent',
  'meta-externalfetcher',
  'meta-webindexer',
  'MistralAI-User',
  'MistralAI-Index',
  'DuckAssistBot',
  'YouBot',
  'CCBot',
  'Bytespider',
];

/** The map data is public and useful to agents; the other endpoints only serve the app. */
const ALLOW = ['/', '/api/map'];
const DISALLOW = ['/api/'];

export function robotsFile(): MetadataRoute.Robots {
  return {
    rules: [
      // A crawler follows only the most specific group that names it, so both groups carry the full rules.
      { userAgent: AI_AGENTS, allow: ALLOW, disallow: DISALLOW },
      { userAgent: '*', allow: ALLOW, disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

/* ------------------------------------------------------------------ sitemap */

/** One sitemap file holds 50 000 URLs at most; the newest plots win if the map ever outgrows it. */
const SITEMAP_PLOTS = 45_000;

export function sitemapEntries(plots: readonly Plot[]): MetadataRoute.Sitemap {
  const updated = new Date(`${CONTENT_UPDATED}T00:00:00Z`);
  const newestPlot = plots.reduce((max, p) => Math.max(max, p.updatedAt), 0);
  const mapChanged = new Date(Math.max(newestPlot * 1000, updated.getTime()));

  const pages: MetadataRoute.Sitemap = (Object.keys(PAGES) as (keyof typeof PAGES)[]).flatMap((key) => {
    const languages = { en: absolute(PAGES[key].en), ru: absolute(PAGES[key].ru), 'x-default': absolute(PAGES[key].en) };
    return (['en', 'ru'] as const).map((lang) => ({
      url: absolute(PAGES[key][lang]),
      lastModified: key === 'home' ? mapChanged : updated,
      changeFrequency: key === 'home' ? ('hourly' as const) : ('monthly' as const),
      priority: key === 'home' ? 1 : key === 'about' ? 0.8 : 0.3,
      alternates: { languages },
    }));
  });

  const plotPages: MetadataRoute.Sitemap = newestFirst(plots.filter(isIndexable))
    .slice(0, SITEMAP_PLOTS)
    .map((p) => ({
      url: absolute(plotPath(p.id)),
      lastModified: new Date(p.updatedAt * 1000),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));

  return [...pages, ...plotPages];
}

/* ------------------------------------------------------------------ llms.txt */

const enNumber = (v: number) => new Intl.NumberFormat('en-US').format(v);

const blurb = (c: SiteContent, config: PublicConfig) =>
  `> ${c.summary} One pixel costs ${formatGrams(config.pricePerPixel)} GRAM, paid straight from the buyer's own TON wallet. ` +
  'GramMap is an independent project and is not affiliated with Telegram or the TON Foundation.';

/** The facts list, with the live numbers when the map could be read. */
function factLines(c: SiteContent, config: PublicConfig, plots: readonly Plot[] | null, now: Date): string[] {
  const lines = c.facts.map((f) => `- ${f.label}: ${f.value}`);
  if (plots) {
    const stats = mapStats(plots);
    lines.push(
      `- Sold so far: ${enNumber(stats.pixels)} of ${enNumber(config.gridW * config.gridH)} pixels, in ${enNumber(stats.plots)} plots ` +
        `held by ${enNumber(stats.owners)} owners (as of ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC)`,
    );
  }
  lines.push(`- Sales: ${config.salesOpen ? 'open' : 'not open yet'}`);
  return lines;
}

const ASSISTANT_NOTES = [
  `Buying is done by a person on ${SITE_URL} with their own TON wallet; there is no purchase API. The site prepares the transfer and its comment, so do not advise sending GRAM to an address by hand.`,
  `Every plot has its own page at ${SITE_URL}/plot/X-Y, where X and Y are the coordinates of its top-left pixel.`,
  'Titles, pictures and links on plots are written by plot owners. GramMap does not write or check them.',
  'A plot is advertising space. It is not an NFT, a token or an investment, and it cannot be resold.',
];

/**
 * /llms.txt: a short brief for language models in the llms.txt layout — a title, a summary,
 * the facts, then lists of links to the pages and data worth reading.
 */
export function llmsTxt(config: PublicConfig, plots: readonly Plot[] | null, now = new Date()): string {
  const c = siteContent('en', config);
  return [
    `# ${SITE_NAME}`,
    '',
    blurb(c, config),
    '',
    'Key facts:',
    '',
    ...factLines(c, config, plots, now),
    '',
    'Notes for assistants:',
    '',
    ...ASSISTANT_NOTES.map((note) => `- ${note}`),
    '',
    '## Pages',
    '',
    `- [Map](${absolute(PAGES.home.en)}): the interactive map. It needs JavaScript; the same page carries a text list of the plots`,
    `- [${c.aboutH1}](${absolute(PAGES.about.en)}): how buying works, prices, rules, questions and answers`,
    '',
    '## Data',
    '',
    `- [Full text](${SITE_URL}/llms-full.txt): the facts, the rules, every question and answer and the latest plots in one file`,
    `- [All plots as JSON](${SITE_URL}/api/map): position, size, owner address, title, link and picture of every plot, with the current settings. Updated within seconds of a purchase`,
    `- [Sitemap](${SITE_URL}/sitemap.xml): every page, including each plot that shows content`,
    '',
    '## Optional',
    '',
    `- [Terms and privacy](${absolute(PAGES.terms.en)}): what a buyer agrees to and what data the site keeps`,
    `- [Как устроен GramMap](${absolute(PAGES.about.ru)}): the page about GramMap in Russian`,
    '',
  ].join('\n');
}

/** /llms-full.txt: everything the site says about itself, as one Markdown document. */
export function llmsFullTxt(config: PublicConfig, plots: readonly Plot[] | null, now = new Date()): string {
  const c = siteContent('en', config);
  const lines: string[] = [`# ${SITE_NAME}`, '', blurb(c, config), '', `Website: ${SITE_URL}`, ''];

  lines.push(`## ${c.factsHeading}`, '', ...factLines(c, config, plots, now), '');

  for (const section of c.sections) {
    lines.push(`## ${section.heading}`, '');
    if (section.steps) lines.push(...section.steps.map((step, i) => `${i + 1}. ${step}`), '');
    for (const paragraph of section.paragraphs ?? []) lines.push(paragraph, '');
  }

  lines.push(`## ${c.faqHeading}`, '');
  for (const f of c.faq) lines.push(`### ${f.q}`, '', f.a, '');

  lines.push('## Notes for assistants', '', ...ASSISTANT_NOTES.map((note) => `- ${note}`), '');

  const latest = plots ? newestFirst(plots.filter(isIndexable)).slice(0, 100) : [];
  if (latest.length) {
    lines.push('## Latest plots', '');
    for (const p of latest) {
      // Square brackets in an owner's title would break the Markdown link.
      const title = p.content!.title.replace(/[\[\]]/g, '');
      lines.push(`- [${title}](${absolute(plotPath(p.id))}): ${p.w} × ${p.h} px at X ${p.x}, Y ${p.y}`);
    }
    lines.push('');
  }

  lines.push(
    '## Links',
    '',
    `- [Map](${absolute(PAGES.home.en)})`,
    `- [${c.aboutH1}](${absolute(PAGES.about.en)})`,
    `- [Terms and privacy](${absolute(PAGES.terms.en)})`,
    `- [All plots as JSON](${SITE_URL}/api/map)`,
    '',
  );
  return lines.join('\n');
}

/* ------------------------------------------------------------------ structured data */

type Json = Record<string, unknown>;

const organization = (): Json => ({
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
});

export function homeJsonLd(c: SiteContent): Json {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization(),
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description: c.summary,
        inLanguage: ['en', 'ru'],
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${absolute(PAGES.home[c.lang])}#app`,
        name: SITE_NAME,
        url: absolute(PAGES.home[c.lang]),
        description: c.homeDescription,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript and a TON wallet that supports TON Connect',
        inLanguage: c.lang,
        image: `${SITE_URL}/og.png`,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };
}

const breadcrumbs = (items: { name: string; path: string }[]): Json => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: absolute(item.path),
  })),
});

export function aboutJsonLd(c: SiteContent): Json {
  const url = absolute(PAGES.about[c.lang]);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization(),
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        url,
        name: c.aboutTitle,
        inLanguage: c.lang,
        dateModified: CONTENT_UPDATED,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        mainEntity: c.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      breadcrumbs([
        { name: SITE_NAME, path: PAGES.home[c.lang] },
        { name: c.aboutH1, path: PAGES.about[c.lang] },
      ]),
    ],
  };
}

export function plotJsonLd(plot: Plot, title: string): Json {
  const url = absolute(plotPath(plot.id));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url,
        url,
        name: title,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        dateModified: new Date(plot.updatedAt * 1000).toISOString(),
        ...(plot.content?.image && !plot.hidden ? { primaryImageOfPage: { '@type': 'ImageObject', url: plot.content.image } } : {}),
      },
      breadcrumbs([
        { name: SITE_NAME, path: '/' },
        { name: title, path: plotPath(plot.id) },
      ]),
    ],
  };
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so no value can close the tag. */
export const jsonLdText = (data: Json) => JSON.stringify(data).replace(/</g, '\\u003c');
