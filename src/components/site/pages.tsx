import type { Metadata } from 'next';
import Link from 'next/link';
import { formatGrams, hostOf } from '@/lib/format';
import { loadPageData } from '@/lib/page-data';
import { aboutJsonLd, homeJsonLd, mapStats, newestFirst, plotJsonLd } from '@/lib/seo';
import { PAGES, SITE_NAME, plotPath, siteContent, type SeoLang, type SiteContent } from '@/lib/seo-content';
import { getServerConfig, toPublicConfig } from '@/lib/server-config';
import { OG_IMAGE, pageMetadata } from '@/lib/site-metadata';
import { friendlyOf } from '@/lib/ton';
import type { Plot, PublicConfig } from '@/lib/types';
import { DocFooter, DocHeader, Facts, JsonLd, MapFrame, Steps } from './parts';
import { TermsText, termsHead } from './terms';

/** The pages themselves. Each address in src/app is a thin wrapper around one of these. */

const content = (lang: SeoLang) => siteContent(lang, toPublicConfig(getServerConfig()));

const explorer = (config: PublicConfig, address: string) =>
  `https://${config.network === 'testnet' ? 'testnet.' : ''}tonviewer.com/${address}`;

/** The newest plots get a line each in the text version of the map. */
const HOME_PLOTS = 200;

/* ------------------------------------------------------------------ the map */

export function homeMetadata(lang: SeoLang): Metadata {
  const c = content(lang);
  return pageMetadata('home', lang, c.homeTitle, c.homeDescription);
}

function PlotList({ c, plots }: { c: SiteContent; plots: readonly Plot[] }) {
  const stats = mapStats(plots);
  const n = (v: number) => new Intl.NumberFormat(c.lang === 'ru' ? 'ru-RU' : 'en-US').format(v);
  if (plots.length === 0) return <p>{c.ui.plotsEmpty}</p>;
  return (
    <>
      <p>{c.ui.soldLine(n(stats.pixels), n(stats.plots), n(stats.owners))}</p>
      <ul className="doc__plots">
        {newestFirst(plots)
          .slice(0, HOME_PLOTS)
          .map((p) => (
            <li key={p.id}>
              <Link href={plotPath(p.id)}>{(!p.hidden && p.content?.title) || c.ui.untitled(p.x, p.y)}</Link>
              <span>{c.ui.plotLine(p.w, p.h, p.x, p.y)}</span>
            </li>
          ))}
      </ul>
    </>
  );
}

export async function HomePage({ lang }: { lang: SeoLang }) {
  const { config, plots } = await loadPageData();
  const c = siteContent(lang, config);
  const buying = c.sections.find((s) => s.id === 'buy');
  return (
    <MapFrame lang={lang === 'ru' ? 'ru' : undefined}>
      <JsonLd data={homeJsonLd(c)} />
      <div className="doc">
        <DocHeader c={c} page="home" />
        <main>
          <h1>{c.homeH1}</h1>
          <p className="doc__lead">{c.lead}</p>
          <noscript>
            <p className="doc__note">{c.ui.needsJs}</p>
          </noscript>

          <h2>{c.factsHeading}</h2>
          <Facts facts={c.facts} />

          {buying?.steps ? (
            <>
              <h2>{buying.heading}</h2>
              <Steps steps={buying.steps} />
            </>
          ) : null}
          <p>
            <Link href={PAGES.about[lang]}>{c.aboutTitle}</Link>
          </p>

          {plots ? (
            <>
              <h2>{c.ui.plotsHeading}</h2>
              <PlotList c={c} plots={plots} />
            </>
          ) : null}
        </main>
        <DocFooter c={c} page="home" />
      </div>
    </MapFrame>
  );
}

/* ------------------------------------------------------------------ about */

export function aboutMetadata(lang: SeoLang): Metadata {
  const c = content(lang);
  return pageMetadata('about', lang, c.aboutTitle, c.aboutDescription);
}

export function AboutPage({ lang }: { lang: SeoLang }) {
  const config = toPublicConfig(getServerConfig());
  const c = siteContent(lang, config);
  return (
    <div className="doc">
      <JsonLd data={aboutJsonLd(c)} />
      <DocHeader c={c} page="about" />
      <main>
        <h1>{c.aboutH1}</h1>
        <p className="doc__lead">{c.lead}</p>
        <p>
          <Link className="btn btn--primary" href={PAGES.home[lang]}>
            {c.ui.openMap}
          </Link>
        </p>

        <h2>{c.factsHeading}</h2>
        <Facts facts={c.facts} />

        {c.sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2>{section.heading}</h2>
            {section.steps ? <Steps steps={section.steps} /> : null}
            {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.id === 'payment' && config.treasury ? (
              <p>
                {c.ui.address}:{' '}
                <a
                  className="address address--full"
                  href={explorer(config, config.treasury)}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                >
                  {config.treasury}
                </a>
              </p>
            ) : null}
          </section>
        ))}

        <section id="faq">
          <h2>{c.faqHeading}</h2>
          {c.faq.map((f) => (
            <div key={f.q} className="doc__qa">
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </section>

        <p className="doc__cta">
          <Link className="btn btn--primary" href={PAGES.home[lang]}>
            {c.ui.openMap}
          </Link>
        </p>
      </main>
      <DocFooter c={c} page="about" />
    </div>
  );
}

/* ------------------------------------------------------------------ terms */

export function termsMetadata(lang: SeoLang): Metadata {
  const head = termsHead[lang];
  return pageMetadata('terms', lang, head.title, head.description);
}

export function TermsPage({ lang }: { lang: SeoLang }) {
  const c = content(lang);
  return (
    <div className="doc">
      <DocHeader c={c} page="terms" />
      <main>
        <TermsText lang={lang} />
      </main>
      <DocFooter c={c} page="terms" />
    </div>
  );
}

/* ------------------------------------------------------------------ one plot */

/** What a plot shows to the public: nothing once a moderator has hidden it. */
const shownContent = (plot: Plot) => (plot.hidden ? null : plot.content);

const plotTitle = (plot: Plot, c: SiteContent) => shownContent(plot)?.title ?? c.ui.untitled(plot.x, plot.y);

const plotSummary = (plot: Plot) =>
  `A ${plot.w} × ${plot.h} px plot at X ${plot.x}, Y ${plot.y} on ${SITE_NAME}, the pixel map on the TON blockchain.`;

export function plotMetadata(plot: Plot): Metadata {
  const c = content('en');
  const shown = shownContent(plot);
  const title = `${plotTitle(plot, c)} — ${plot.w} × ${plot.h} px on ${SITE_NAME}`;
  const description = shown?.url ? `${plotSummary(plot)} Links to ${hostOf(shown.url)}.` : plotSummary(plot);
  const path = plotPath(plot.id);
  // An owner's picture is a small square-ish tile, so it goes out as a small card; the site's own picture as a large one.
  const picture = shown?.image ? { url: shown.image, alt: shown.title } : OG_IMAGE;
  return {
    title,
    description,
    alternates: { canonical: path },
    // A plot with nothing on it, or with its content taken down, is no use in search results.
    ...(shown ? {} : { robots: { index: false, follow: true } }),
    openGraph: { type: 'website', url: path, siteName: SITE_NAME, title, description, images: [picture] },
    twitter: { card: shown?.image ? 'summary' : 'summary_large_image', title, description, images: [picture.url] },
  };
}

const boughtOn = (utime: number) =>
  `${new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(utime * 1000))} UTC`;

/** Owner pictures are drawn at a sensible size whatever the shape of the plot. */
function pictureSize(plot: Plot): { width: number; height: number } {
  const scale = 480 / Math.max(plot.w, plot.h);
  return { width: Math.max(1, Math.round(plot.w * scale)), height: Math.max(1, Math.round(plot.h * scale)) };
}

export function PlotPage({ plot, config }: { plot: Plot; config: PublicConfig }) {
  const c = siteContent('en', config);
  const shown = shownContent(plot);
  const title = plotTitle(plot, c);
  const owner = friendlyOf(plot.owner);
  return (
    <MapFrame plot={plot.id}>
      <JsonLd data={plotJsonLd(plot, title)} />
      <div className="doc">
        <DocHeader c={c} page={null} />
        <main>
          <h1>{title}</h1>
          <p className="doc__lead">{plotSummary(plot)}</p>

          {shown?.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- owner pictures live on the blob store
            <img className="doc__picture" src={shown.image} alt={shown.title} {...pictureSize(plot)} />
          ) : null}
          {plot.hidden ? <p>The picture and link of this plot are hidden by a moderator.</p> : null}
          {!plot.hidden && !plot.content ? <p>The owner has not added a picture yet.</p> : null}

          <dl className="facts facts--doc">
            {shown?.url ? (
              <div>
                <dt>Link</dt>
                <dd>
                  {/* Written by the plot owner: search engines are told not to count it as the site's own. */}
                  <a href={shown.url} target="_blank" rel="nofollow ugc noopener noreferrer">
                    {hostOf(shown.url)}
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Size</dt>
              <dd>
                {plot.w} × {plot.h} px ({new Intl.NumberFormat('en-US').format(plot.w * plot.h)} pixels)
              </dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>
                X {plot.x}, Y {plot.y}
              </dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>
                <a className="address address--full" href={explorer(config, owner)} target="_blank" rel="nofollow noopener noreferrer">
                  {owner}
                </a>
              </dd>
            </div>
            <div>
              <dt>Bought</dt>
              <dd>
                <time dateTime={new Date(plot.utime * 1000).toISOString()}>{boughtOn(plot.utime)}</time>
              </dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{formatGrams(plot.paid)} GRAM</dd>
            </div>
          </dl>

          <h2>What is GramMap?</h2>
          <p>{c.lead}</p>
          <p>
            <Link href={PAGES.about.en}>{c.aboutTitle}</Link>
          </p>
        </main>
        <DocFooter c={c} page={null} />
      </div>
    </MapFrame>
  );
}

/* ------------------------------------------------------------------ not found */

export function NotFoundPage() {
  const c = content('en');
  return (
    <div className="doc">
      <DocHeader c={c} page={null} />
      <main>
        <h1>{c.ui.notFoundTitle}</h1>
        <p className="doc__lead">{c.ui.notFoundText}</p>
        <p>
          <Link className="btn btn--primary" href={PAGES.home.en}>
            {c.ui.openMap}
          </Link>
        </p>
      </main>
      <DocFooter c={c} page={null} />
    </div>
  );
}
