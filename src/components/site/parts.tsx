import Link from 'next/link';
import type { ReactNode } from 'react';
import { ClientRoot } from '@/components/ClientRoot';
import { Logo } from '@/components/icons';
import { jsonLdText } from '@/lib/seo';
import {
  CONTENT_UPDATED,
  PAGES,
  SITE_NAME,
  otherLang,
  type Fact,
  type PageKey,
  type SeoLang,
  type SiteContent,
} from '@/lib/seo-content';

/** Building blocks of the server-rendered pages: the ones search engines and assistants read. */

/** Structured data for search engines and assistants. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}

interface ChromeProps {
  c: SiteContent;
  /** Which of the paired pages this is; null for pages that exist in one language only. */
  page: PageKey | null;
}

export function DocHeader({ c, page }: ChromeProps) {
  const other = otherLang(c.lang);
  return (
    <header className="doc__head">
      <Link className="brand" href={PAGES.home[c.lang]}>
        <Logo />
        <span className="brand__name">{SITE_NAME}</span>
      </Link>
      {page ? (
        <Link className="doc__lang" href={PAGES[page][other]} hrefLang={other} lang={other}>
          {c.ui.otherLanguage}
        </Link>
      ) : null}
    </header>
  );
}

function updatedOn(lang: SeoLang): string {
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${CONTENT_UPDATED}T00:00:00Z`));
}

/** The foot of every page is drawn like the title block of a drawing: four cells, four destinations. */
export function DocFooter({ c, page }: ChromeProps) {
  const other = otherLang(c.lang);
  const current = (key: PageKey) => (page === key ? ('page' as const) : undefined);
  return (
    <footer className="doc__foot">
      <nav className="titleblock" aria-label={c.ui.navLabel}>
        <Link href={PAGES.home[c.lang]} aria-current={current('home')}>
          {c.ui.home}
        </Link>
        <Link href={PAGES.about[c.lang]} aria-current={current('about')}>
          {c.ui.about}
        </Link>
        <Link href={PAGES.terms[c.lang]} aria-current={current('terms')}>
          {c.ui.terms}
        </Link>
        <Link href={PAGES[page ?? 'home'][other]} hrefLang={other} lang={other}>
          {c.ui.otherLanguage}
        </Link>
      </nav>
      {page === 'about' || page === 'terms' ? (
        <p className="doc__meta">
          {c.ui.updated}: <time dateTime={CONTENT_UPDATED}>{updatedOn(c.lang)}</time>
        </p>
      ) : null}
    </footer>
  );
}

export function Facts({ facts }: { facts: readonly Fact[] }) {
  return (
    <dl className="facts facts--doc">
      {facts.map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Steps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="doc__steps">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

interface MapFrameProps {
  /** The text version of what the map shows on this address. */
  children: ReactNode;
  /** Language of the address (/ru), used unless the visitor has chosen one. */
  lang?: 'ru';
  /** Plot to open the map on. */
  plot?: string;
}

/**
 * A page that is the map. The text version is rendered on the server and is what crawlers,
 * assistants and browsers without JavaScript get; the map loads on top of it.
 */
export function MapFrame({ children, lang, plot }: MapFrameProps) {
  return (
    <>
      <div id="text-version" className="text-layer">
        {children}
      </div>
      {/* Without JavaScript the map never loads: take its empty sheet away so the text can be read. */}
      <noscript>
        <style>{'.app--boot{display:none}'}</style>
      </noscript>
      <ClientRoot lang={lang} plot={plot} />
    </>
  );
}
