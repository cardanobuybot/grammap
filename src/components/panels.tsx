'use client';

import { toUserFriendlyAddress } from '@tonconnect/ui-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, fetchRejected } from '@/lib/client-api';
import { formatDate, formatGrams, formatInt, hostOf, percent, shortAddress } from '@/lib/format';
import { useI18n, type I18nKey, type Lang } from '@/lib/i18n';
import { PAGES, plotPath } from '@/lib/paths';
import type { Plot, PublicConfig, RejectedPayment } from '@/lib/types';
import { IconChevron } from './icons';
import { Sheet } from './Sheet';

export function friendly(raw: string): string {
  try {
    return toUserFriendlyAddress(raw);
  } catch {
    return raw;
  }
}

const explorer = (config: PublicConfig, address: string) =>
  `https://${config.network === 'testnet' ? 'testnet.' : ''}tonviewer.com/${address}`;

function Address({ raw, config }: { raw: string; config: PublicConfig }) {
  const address = friendly(raw);
  return (
    <a className="address" href={explorer(config, address)} target="_blank" rel="noopener noreferrer" title={address}>
      {shortAddress(address)}
    </a>
  );
}

function PlotThumb({ plot }: { plot: Plot }) {
  const image = !plot.hidden ? plot.content?.image : null;
  return (
    <span className="thumb" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- owner pictures live on the blob store */}
      {image ? <img src={image} alt="" loading="lazy" /> : null}
    </span>
  );
}

/* ---------------------------------------------------------------- plot card */

interface PlotPanelProps {
  plot: Plot;
  config: PublicConfig;
  isMine: boolean;
  onEdit(): void;
  onClose(): void;
  onToast(text: string): void;
}

export function PlotPanel({ plot, config, isMine, onEdit, onClose, onToast }: PlotPanelProps) {
  const { t, lang } = useI18n();
  const [leaving, setLeaving] = useState(false);
  const content = plot.hidden ? null : plot.content;
  const title = content?.title || t('plot.untitled', { x: plot.x, y: plot.y });
  const ratio = Math.min(3, Math.max(1 / 3, plot.w / plot.h));

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${plotPath(plot.id)}`);
      onToast(t('plot.copied'));
    } catch {
      /* clipboard can be blocked; the address bar still has the link */
    }
  };

  return (
    <Sheet title={title} onClose={onClose}>
      {content?.image ? (
        <div
          className={`plot-image ${plot.w * plot.h <= 64 ? 'plot-image--tiny' : ''}`}
          style={{ aspectRatio: String(ratio), width: `min(100%, ${Math.round(220 * ratio)}px)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- owner pictures live on the blob store */}
          <img src={content.image} alt={title} />
        </div>
      ) : (
        <p className="note">{plot.hidden ? t('plot.hidden') : t('plot.noContent')}</p>
      )}

      {isMine ? <p className="badge">{t('plot.yours')}</p> : null}

      {content?.url ? (
        leaving ? (
          <div className="leave" role="alertdialog" aria-label={t('leave.title')}>
            <p className="leave__title">{t('leave.title')}</p>
            <p className="leave__url">{content.url}</p>
            <p className="leave__text">{t('leave.text')}</p>
            <div className="row">
              <a
                className="btn btn--primary"
                href={content.url}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                onClick={() => setLeaving(false)}
              >
                {t('leave.go', { host: hostOf(content.url) })}
              </a>
              <button type="button" className="btn" onClick={() => setLeaving(false)}>
                {t('leave.stay')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--primary btn--block" onClick={() => setLeaving(true)}>
            {t('plot.open', { host: hostOf(content.url) })}
          </button>
        )
      ) : null}

      <dl className="facts">
        <div>
          <dt>{t('plot.owner')}</dt>
          <dd>
            <Address raw={plot.owner} config={config} />
          </dd>
        </div>
        <div>
          <dt>{t('plot.size')}</dt>
          <dd>
            {plot.w} × {plot.h} px
          </dd>
        </div>
        <div>
          <dt>{t('plot.position')}</dt>
          <dd>
            X {plot.x}, Y {plot.y}
          </dd>
        </div>
        <div>
          <dt>{t('plot.bought')}</dt>
          <dd>{formatDate(plot.utime, lang)}</dd>
        </div>
        <div>
          <dt>{t('plot.paid')}</dt>
          <dd>{formatGrams(plot.paid)} GRAM</dd>
        </div>
      </dl>

      <div className="stack">
        {isMine ? (
          <button type="button" className="btn btn--block" onClick={onEdit}>
            {t('plot.edit')}
          </button>
        ) : null}
        <button type="button" className="btn btn--quiet btn--block" onClick={share}>
          {t('plot.share')}
        </button>
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- statistics */

interface StatsPanelProps {
  plots: Plot[];
  config: PublicConfig;
  onOpenPlot(plot: Plot): void;
  onClose(): void;
}

export function StatsPanel({ plots, config, onOpenPlot, onClose }: StatsPanelProps) {
  const { t } = useI18n();
  const stats = useMemo(() => {
    const perOwner = new Map<string, number>();
    let sold = 0;
    let volume = BigInt(0);
    for (const p of plots) {
      const area = p.w * p.h;
      sold += area;
      volume += BigInt(p.paid);
      perOwner.set(p.owner, (perOwner.get(p.owner) ?? 0) + area);
    }
    return {
      sold,
      volume,
      owners: perOwner.size,
      top: [...perOwner].sort((a, b) => b[1] - a[1]).slice(0, 10),
      recent: [...plots].sort((a, b) => b.utime - a.utime).slice(0, 10),
    };
  }, [plots]);
  const total = config.gridW * config.gridH;

  return (
    <Sheet title={t('menu.stats')} onClose={onClose}>
      <dl className="figures">
        <div>
          <dt>{t('stats.sold')}</dt>
          <dd>{formatInt(stats.sold)}</dd>
        </div>
        <div>
          <dt>{t('stats.share')}</dt>
          <dd>{percent(stats.sold, total)}</dd>
        </div>
        <div>
          <dt>{t('stats.owners')}</dt>
          <dd>{formatInt(stats.owners)}</dd>
        </div>
        <div>
          <dt>{t('stats.volume')}</dt>
          <dd>{formatGrams(stats.volume)} GRAM</dd>
        </div>
      </dl>

      {plots.length === 0 ? (
        <p className="note">{t('stats.empty')}</p>
      ) : (
        <>
          <h3 className="sub">{t('stats.top')}</h3>
          <ol className="list list--ranked">
            {stats.top.map(([owner, px]) => (
              <li key={owner} className="list__row">
                <Address raw={owner} config={config} />
                <span className="num">{t('stats.px', { n: formatInt(px) })}</span>
              </li>
            ))}
          </ol>

          <h3 className="sub">{t('stats.recent')}</h3>
          <ul className="list">
            {stats.recent.map((p) => (
              <li key={p.id}>
                <button type="button" className="list__row list__row--btn" onClick={() => onOpenPlot(p)}>
                  <PlotThumb plot={p} />
                  <span className="list__main">
                    {(!p.hidden && p.content?.title) || t('plot.untitled', { x: p.x, y: p.y })}
                  </span>
                  <span className="num">
                    {p.w} × {p.h}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- my plots */

interface MinePanelProps {
  plots: Plot[];
  connected: boolean;
  onConnect(): void;
  onOpenPlot(plot: Plot): void;
  onClose(): void;
}

export function MinePanel({ plots, connected, onConnect, onOpenPlot, onClose }: MinePanelProps) {
  const { t } = useI18n();
  return (
    <Sheet title={t('menu.mine')} onClose={onClose}>
      {!connected ? (
        <div className="stack">
          <p className="note">{t('mine.connect')}</p>
          <button type="button" className="btn btn--primary btn--block" onClick={onConnect}>
            {t('wallet.connect')}
          </button>
        </div>
      ) : plots.length === 0 ? (
        <p className="note">{t('mine.empty')}</p>
      ) : (
        <ul className="list">
          {plots.map((p) => (
            <li key={p.id}>
              <button type="button" className="list__row list__row--btn" onClick={() => onOpenPlot(p)}>
                <PlotThumb plot={p} />
                <span className="list__main">
                  {p.content?.title || t('plot.untitled', { x: p.x, y: p.y })}
                  <small>
                    X {p.x}, Y {p.y}
                  </small>
                </span>
                <span className="num">
                  {p.w} × {p.h}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- about */

export function AboutPanel({ config, onClose }: { config: PublicConfig; onClose(): void }) {
  const { t, lang } = useI18n();
  const price = formatGrams(config.pricePerPixel);
  const fee = formatGrams(config.editFee);
  return (
    <Sheet title={t('menu.about')} onClose={onClose}>
      <div className="prose">
        <p className="lead">{t('about.lead', { total: formatInt(config.gridW * config.gridH) })}</p>

        <h3>{t('about.how')}</h3>
        <ol>
          <li>{t('about.step1')}</li>
          <li>{t('about.step2')}</li>
          <li>{t('about.step3')}</li>
        </ol>

        <h3>{t('about.price')}</h3>
        <p>{t('about.priceText', { price, fee })}</p>

        <h3>{t('about.pay')}</h3>
        <p>{t('about.payText')}</p>
        <p>{t('about.payWarn')}</p>
        <p>{t('about.payRefund')}</p>
        {config.treasury ? (
          <p>
            {t('about.address')}:{' '}
            <a className="address address--full" href={explorer(config, config.treasury)} target="_blank" rel="noopener noreferrer">
              {config.treasury}
            </a>
          </p>
        ) : null}

        <h3>{t('about.rules')}</h3>
        <p>{t('about.rulesText')}</p>
        <p>{t('about.honest')}</p>
        <p>
          <Link href={PAGES.about[lang]}>{t('about.more')}</Link>
        </p>
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- refunds */

export function RefundsPanel({ config, onClose }: { config: PublicConfig; onClose(): void }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<RejectedPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchRejected()
      .then((r) => alive && setItems(r.rejected))
      .catch((e) => alive && setError(e instanceof ApiError ? e.code : 'unavailable'));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Sheet title={t('menu.refunds')} onClose={onClose}>
      <p className="note">{t('refunds.text')}</p>
      {error ? <p className="alert">{t(`error.${error}` as I18nKey)}</p> : null}
      {items && items.length === 0 ? <p className="note">{t('refunds.empty')}</p> : null}
      {items && items.length > 0 ? (
        <ul className="list">
          {items.map((r) => (
            <li key={r.hash} className="list__row list__row--tall">
              <span className="list__main">
                <Address raw={r.from} config={config} />
                <small>
                  {formatDate(r.utime, lang)}. {t(`reason.${r.reason}` as I18nKey)}
                </small>
              </span>
              <span className="num">{formatGrams(r.value)} GRAM</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- menu */

interface MenuPanelProps {
  config: PublicConfig;
  address: string | null;
  mineCount: number;
  lang: Lang;
  onLang(lang: Lang): void;
  onOpen(panel: 'mine' | 'stats' | 'about' | 'refunds'): void;
  onConnect(): void;
  onDisconnect(): void;
  onClose(): void;
}

export function MenuPanel(props: MenuPanelProps) {
  const { t } = useI18n();
  const { config, address, mineCount, lang } = props;
  const item = (key: 'mine' | 'stats' | 'about' | 'refunds', label: string, extra?: string) => (
    <li>
      <button type="button" className="list__row list__row--btn" onClick={() => props.onOpen(key)}>
        <span className="list__main">{label}</span>
        {extra ? <span className="num">{extra}</span> : null}
        <IconChevron />
      </button>
    </li>
  );

  return (
    <Sheet title={t('menu.title')} onClose={props.onClose}>
      {address ? (
        <p className="wallet-line">
          <a className="address address--full" href={explorer(config, address)} target="_blank" rel="noopener noreferrer">
            {address}
          </a>
        </p>
      ) : (
        <button type="button" className="btn btn--primary btn--block" onClick={props.onConnect}>
          {t('wallet.connect')}
        </button>
      )}

      <ul className="list list--menu">
        {item('mine', t('menu.mine'), address ? String(mineCount) : undefined)}
        {item('stats', t('menu.stats'))}
        {item('about', t('menu.about'))}
        {item('refunds', t('menu.refunds'))}
      </ul>

      <div className="field">
        <span className="field__label" id="lang-label">
          {t('menu.language')}
        </span>
        <div className="segmented" role="group" aria-labelledby="lang-label">
          {(['en', 'ru'] as const).map((code) => (
            <button
              key={code}
              type="button"
              className={lang === code ? 'is-on' : ''}
              aria-pressed={lang === code}
              onClick={() => props.onLang(code)}
            >
              {code === 'en' ? 'English' : 'Русский'}
            </button>
          ))}
        </div>
      </div>

      <div className="stack">
        {config.telegramUrl ? (
          <a className="btn btn--block" href={config.telegramUrl} target="_blank" rel="noopener noreferrer">
            {t('menu.telegram')}
          </a>
        ) : null}
        {address ? (
          <button type="button" className="btn btn--quiet btn--block" onClick={props.onDisconnect}>
            {t('menu.disconnect')}
          </button>
        ) : null}
        <Link className="link" href={PAGES.terms[lang]}>
          {t('menu.terms')}
        </Link>
      </div>
    </Sheet>
  );
}
