'use client';

import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { fetchMap } from '@/lib/client-api';
import { formatGrams, formatInt, shortAddress } from '@/lib/format';
import { areaProblem, plotAt, rectContains } from '@/lib/geometry';
import { useI18n } from '@/lib/i18n';
import type { MapResponse, Plot, Rect } from '@/lib/types';
import { IconMenu, IconMinus, IconPlus, IconSheet, IconTarget, IconWallet, Logo } from './icons';
import { MapCanvas, type Cell, type Cover, type MapHandle } from './MapCanvas';
import { AboutPanel, MenuPanel, MinePanel, PlotPanel, RefundsPanel, StatsPanel, friendly } from './panels';
import { PurchasePanel } from './PurchasePanel';

type Panel =
  | { type: 'plot'; id: string }
  | { type: 'buy'; rect: Rect }
  | { type: 'edit'; id: string }
  | { type: 'menu' | 'stats' | 'about' | 'mine' | 'refunds' }
  | null;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const WIDE = '(min-width: 900px)';
function useWide(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/** How much of the map the interface covers: a side panel on wide screens, a bottom sheet on phones. */
function coverFor(wide: boolean, panelOpen: boolean, selecting: boolean): Cover {
  if (wide) return { right: panelOpen ? 420 : 0, bottom: 0 };
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  return { right: 0, bottom: panelOpen ? Math.round(vh * 0.62) : selecting ? 250 : 150 };
}

interface StepperProps {
  label: string;
  value: number;
  max: number;
  less: string;
  more: string;
  onChange(value: number): void;
}

function Stepper({ label, value, max, less, more, onChange }: StepperProps) {
  return (
    <label className="stepper">
      <span className="field__label">{label}</span>
      <span className="stepper__row">
        <button type="button" aria-label={`${label}: ${less}`} disabled={value <= 1} onClick={() => onChange(value - 1)}>
          <IconMinus width={16} height={16} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
        <button type="button" aria-label={`${label}: ${more}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <IconPlus width={16} height={16} />
        </button>
      </span>
    </label>
  );
}

export default function Shell({ initialPlot }: { initialPlot?: string }) {
  const { t, lang, setLang } = useI18n();
  const [tonConnectUI, setOptions] = useTonConnectUI();
  const rawAddress = useTonAddress(false);
  const mine = rawAddress ? rawAddress.toLowerCase() : null;
  const wide = useWide();

  const [data, setData] = useState<MapResponse | null>(null);
  const [mode, setMode] = useState<'browse' | 'select'>('browse');
  const [selection, setSelection] = useState<Rect | null>(null);
  const [probe, setProbe] = useState<Cell | null>(null);
  const [pointerCell, setPointerCell] = useState<Cell | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const mapRef = useRef<MapHandle>(null);
  const deepLinkDone = useRef(false);

  const config = data?.config ?? null;
  const plots = useMemo(() => data?.plots ?? [], [data]);

  /* ------------------------------------------------------------ data */

  const applyMap = useCallback((next: MapResponse) => {
    // A cached answer can be older than what a buyer already received directly: never go back.
    setData((prev) => (prev && BigInt(prev.lastLt) > BigInt(next.lastLt) ? prev : next));
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchMap()
        .then((d) => alive && applyMap(d))
        .catch(() => {
          /* the next attempt is a few seconds away */
        });
    load();
    // The first answer may predate a sync it triggered on the server: look again shortly.
    const soon = window.setTimeout(load, 7_000);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30_000);
    return () => {
      alive = false;
      window.clearTimeout(soon);
      window.clearInterval(timer);
    };
  }, [applyMap]);

  useEffect(() => {
    setOptions({ language: lang });
  }, [lang, setOptions]);

  // Inside Telegram: tell the client the app is ready and take the full height.
  useEffect(() => {
    const inTelegram = /tgWebApp(Data|Platform|Version)/.test(window.location.hash) || 'TelegramWebviewProxy' in window;
    if (!inTelegram) return;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    script.onload = () => {
      try {
        const app = (window as unknown as { Telegram?: { WebApp?: { ready(): void; expand(): void } } }).Telegram?.WebApp;
        app?.ready();
        app?.expand();
      } catch {
        /* running outside Telegram after all */
      }
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ------------------------------------------------------------ navigation */

  const openPlot = useCallback(
    (plot: Plot) => {
      setMode('browse');
      setSelection(null);
      setProbe(null);
      setPanel({ type: 'plot', id: plot.id });
      mapRef.current?.flyTo(plot, coverFor(wide, true, false));
    },
    [wide],
  );

  // A plot's own address (/plot/120-340) or an older shared link (?p=120-340) opens straight on that plot.
  useEffect(() => {
    if (!data || deepLinkDone.current) return;
    deepLinkDone.current = true;
    const m = /^(\d{1,5})-(\d{1,5})$/.exec(initialPlot ?? new URLSearchParams(window.location.search).get('p') ?? '');
    if (!m) return;
    const cell = { x: +m[1], y: +m[2] };
    if (cell.x >= data.config.gridW || cell.y >= data.config.gridH) return;
    const plot = plotAt(data.plots, cell.x, cell.y);
    // The canvas mounts in the same commit as the data: give it a frame to measure itself.
    window.requestAnimationFrame(() => {
      if (plot) openPlot(plot);
      else {
        setProbe(cell);
        mapRef.current?.flyTo({ ...cell, w: 1, h: 1 });
      }
    });
  }, [data, openPlot, initialPlot]);

  const handleTap = useCallback(
    (cell: Cell, plot: Plot | null) => {
      setFindOpen(false);
      if (plot) {
        setProbe(null);
        setPanel({ type: 'plot', id: plot.id });
        // The card must not hide the plot it describes.
        mapRef.current?.reveal(plot, coverFor(wide, true, false));
        return;
      }
      setPanel((current) => (current?.type === 'plot' ? null : current));
      setProbe(cell);
    },
    [wide],
  );

  const handlePointerCell = useCallback((cell: Cell | null) => {
    setPointerCell((prev) => (prev?.x === cell?.x && prev?.y === cell?.y ? prev : cell));
  }, []);

  const handleSelection = useCallback((rect: Rect) => setSelection(rect), []);

  /* ------------------------------------------------------------ buying */

  const problem = useMemo(
    () => (selection && config ? areaProblem(selection, config, plots) : null),
    [selection, config, plots],
  );

  const startSelect = useCallback(
    (at?: Cell) => {
      if (!config) return;
      const centre = at ?? mapRef.current?.centerCell() ?? { x: config.gridW >> 1, y: config.gridH >> 1 };
      const side = Math.min(10, config.gridW, config.gridH, config.maxSide);
      const around = (cx: number, cy: number): Rect => ({
        x: clamp(cx - (side >> 1), 0, config.gridW - side),
        y: clamp(cy - (side >> 1), 0, config.gridH - side),
        w: side,
        h: side,
      });
      // Offer a ready 10×10 area: here if it is free, otherwise the nearest free spot around.
      let pick: Rect | null = null;
      search: for (let ring = 0; ring <= 8; ring++) {
        for (let dy = -ring; dy <= ring; dy++) {
          for (let dx = -ring; dx <= ring; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const candidate = around(centre.x + dx * (side + 2), centre.y + dy * (side + 2));
            if (!areaProblem(candidate, config, plots)) {
              pick = candidate;
              break search;
            }
          }
        }
      }
      // "Buy here" must include the pixel that was tapped.
      if (at && !areaProblem({ ...at, w: 1, h: 1 }, config, plots) && (!pick || !rectContains(pick, at.x, at.y))) {
        pick = { ...at, w: 1, h: 1 };
      }
      setSelection(pick);
      setMode('select');
      setPanel(null);
      setProbe(null);
      setFindOpen(false);
      if (pick) mapRef.current?.flyTo(pick, coverFor(wide, false, true));
    },
    [config, plots, wide],
  );

  const cancelSelect = useCallback(() => {
    setMode('browse');
    setSelection(null);
    setPanel((current) => (current?.type === 'buy' ? null : current));
  }, []);

  /** The area is bought: stop drawing the selection over it. The confirmation stays open. */
  const endSelect = useCallback(() => {
    setMode('browse');
    setSelection(null);
  }, []);

  const resize = (patch: Partial<Rect>) => {
    if (!selection || !config) return;
    const w = clamp(patch.w ?? selection.w, 1, Math.min(config.maxSide, config.gridW));
    const h = clamp(patch.h ?? selection.h, 1, Math.min(config.maxSide, config.gridH));
    setSelection({
      w,
      h,
      x: clamp(selection.x, 0, config.gridW - w),
      y: clamp(selection.y, 0, config.gridH - h),
    });
  };

  const showBought = useCallback(
    (plotId: string) => {
      const plot = plots.find((p) => p.id === plotId);
      setMode('browse');
      setSelection(null);
      if (plot) openPlot(plot);
      else setPanel(null);
    },
    [plots, openPlot],
  );

  const closePanel = useCallback(() => {
    // Closing the payment window after a successful purchase also leaves selection mode.
    if (panel?.type === 'buy' && plots.some((p) => p.x === panel.rect.x && p.y === panel.rect.y)) {
      setMode('browse');
      setSelection(null);
    }
    setPanel(null);
  }, [panel, plots]);

  const connect = useCallback(() => {
    void tonConnectUI.openModal();
  }, [tonConnectUI]);

  /* ------------------------------------------------------------ find a pixel */

  const [findX, setFindX] = useState('');
  const [findY, setFindY] = useState('');
  const submitFind = (e: FormEvent) => {
    e.preventDefault();
    if (!config) return;
    const x = clamp(Number.parseInt(findX, 10) || 0, 0, config.gridW - 1);
    const y = clamp(Number.parseInt(findY, 10) || 0, 0, config.gridH - 1);
    setFindOpen(false);
    const plot = plotAt(plots, x, y);
    if (plot) openPlot(plot);
    else {
      setPanel((current) => (current?.type === 'plot' ? null : current));
      setProbe({ x, y });
      mapRef.current?.flyTo({ x, y, w: 1, h: 1 });
    }
  };

  /* ------------------------------------------------------------ render */

  const obscured = useMemo(() => coverFor(wide, Boolean(panel), mode === 'select'), [wide, panel, mode]);

  const sold = useMemo(() => plots.reduce((n, p) => n + p.w * p.h, 0), [plots]);
  const myPlots = useMemo(() => (mine ? plots.filter((p) => p.owner === mine) : []), [plots, mine]);
  const address = mine ? friendly(mine) : null;
  const activePlot = panel?.type === 'plot' || panel?.type === 'edit' ? plots.find((p) => p.id === panel.id) : undefined;
  const price = config ? formatGrams(config.pricePerPixel) : '1';
  const total = config ? config.gridW * config.gridH : 0;
  const probeFree = probe && config ? !areaProblem({ ...probe, w: 1, h: 1 }, config, plots) : false;
  const shown = pointerCell ?? probe ?? (selection ? { x: selection.x, y: selection.y } : null);

  return (
    <div className={`app ${panel ? 'app--panel' : ''} ${mode === 'select' ? 'app--select' : ''}`}>
      {config ? (
        <MapCanvas
          ref={mapRef}
          config={config}
          plots={plots}
          mine={mine}
          mode={mode}
          selection={selection}
          selectionOk={!problem}
          activeId={activePlot?.id ?? null}
          probe={probe}
          obscured={obscured}
          plateSub={t('plate.sub', { total: formatInt(total), price })}
          label={t('map.label')}
          onTap={handleTap}
          onSelectionChange={handleSelection}
          onPointerCell={handlePointerCell}
        />
      ) : (
        <div className="map map--loading" aria-hidden />
      )}

      <header className="topbar">
        <div className="brand">
          <Logo />
          <span className="brand__name">GramMap</span>
          <span className="brand__tag">{t('brand.tagline')}</span>
        </div>
        <div className="topbar__actions">
          <button type="button" className="btn btn--bar" onClick={address ? () => setPanel({ type: 'mine' }) : connect}>
            <IconWallet width={18} height={18} />
            {address ? (
              <span>{shortAddress(address)}</span>
            ) : (
              <>
                <span className="long">{t('wallet.connect')}</span>
                <span className="short">{t('wallet.connectShort')}</span>
              </>
            )}
          </button>
          <button type="button" className="icon-btn icon-btn--bar" onClick={() => setPanel({ type: 'menu' })} aria-label={t('menu.title')}>
            <IconMenu />
          </button>
        </div>
      </header>

      <div className="tools">
        <button type="button" className="icon-btn" onClick={() => mapRef.current?.zoomBy(1.8)} aria-label={t('tools.zoomIn')}>
          <IconPlus />
        </button>
        <button type="button" className="icon-btn" onClick={() => mapRef.current?.zoomBy(1 / 1.8)} aria-label={t('tools.zoomOut')}>
          <IconMinus />
        </button>
        <button type="button" className="icon-btn" onClick={() => mapRef.current?.fitAll()} aria-label={t('tools.fit')}>
          <IconSheet />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setFindOpen((v) => !v)}
          aria-label={t('tools.find')}
          aria-expanded={findOpen}
        >
          <IconTarget />
        </button>
        {findOpen ? (
          <form className="find" onSubmit={submitFind}>
            <label>
              X
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={(config?.gridW ?? 1) - 1}
                value={findX}
                onChange={(e) => setFindX(e.target.value)}
                autoFocus
              />
            </label>
            <label>
              Y
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={(config?.gridH ?? 1) - 1}
                value={findY}
                onChange={(e) => setFindY(e.target.value)}
              />
            </label>
            <button type="submit" className="btn btn--small btn--primary">
              {t('find.go')}
            </button>
          </form>
        ) : null}
      </div>

      {/* The title block: status of the sheet and the main action, like the corner of a drawing. */}
      <section className="block">
        {!config ? (
          <p className="block__line">{t('block.loading')}</p>
        ) : mode === 'select' ? (
          <>
            {selection ? (
              <>
                <div className="block__cells">
                  <span>
                    X {selection.x}, Y {selection.y}
                  </span>
                  <span className="block__price">
                    {formatGrams(BigInt(config.pricePerPixel) * BigInt(selection.w * selection.h))} GRAM
                  </span>
                </div>
                <div className="steppers">
                  <Stepper
                    label={t('select.width')}
                    value={selection.w}
                    max={Math.min(config.maxSide, config.gridW)}
                    less={t('select.less')}
                    more={t('select.more')}
                    onChange={(w) => resize({ w })}
                  />
                  <Stepper
                    label={t('select.height')}
                    value={selection.h}
                    max={Math.min(config.maxSide, config.gridH)}
                    less={t('select.less')}
                    more={t('select.more')}
                    onChange={(h) => resize({ h })}
                  />
                </div>
                <p className={`block__line ${problem ? 'block__line--alert' : ''}`}>
                  {problem ? t(`problem.${problem}`, { side: config.maxSide, area: formatInt(config.maxArea) }) : t('select.free')}
                </p>
              </>
            ) : (
              <p className="block__line">{t(coarsePointer() ? 'select.hintTouch' : 'select.hint')}</p>
            )}
            <div className="row">
              <button type="button" className="btn" onClick={cancelSelect}>
                {t('select.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--grow"
                disabled={!selection || Boolean(problem)}
                onClick={() => selection && setPanel({ type: 'buy', rect: selection })}
              >
                {t('select.continue')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="block__cells">
              <span>{shown ? `X ${shown.x}, Y ${shown.y}` : `${config.gridW} × ${config.gridH} px`}</span>
              <span>{t('block.sold', { n: formatInt(sold), total: formatInt(total) })}</span>
            </div>
            {data?.stale ? <p className="block__line block__line--alert">{t('block.stale')}</p> : null}
            {probe && probeFree ? (
              <div className="row row--between">
                <p className="block__line">{t('probe.free', { x: probe.x, y: probe.y })}</p>
                {config.salesOpen ? (
                  <button type="button" className="btn btn--small" onClick={() => startSelect(probe)}>
                    {t('probe.buyHere')}
                  </button>
                ) : null}
              </div>
            ) : null}
            <button type="button" className="btn btn--primary btn--cta" disabled={!config.salesOpen} onClick={() => startSelect()}>
              <span>{config.salesOpen ? t('cta.buy') : t('cta.closed')}</span>
              <span className="btn__aside">{t('cta.price', { price })}</span>
            </button>
          </>
        )}
      </section>

      {config && panel?.type === 'plot' && activePlot ? (
        <PlotPanel
          key={activePlot.id}
          plot={activePlot}
          config={config}
          isMine={mine !== null && activePlot.owner === mine}
          onEdit={() => setPanel({ type: 'edit', id: activePlot.id })}
          onClose={closePanel}
          onToast={setToast}
        />
      ) : null}
      {config && panel?.type === 'buy' ? (
        <PurchasePanel
          kind="buy"
          rect={panel.rect}
          config={config}
          mine={mine}
          onMap={applyMap}
          onApplied={endSelect}
          onShow={showBought}
          onClose={closePanel}
        />
      ) : null}
      {config && panel?.type === 'edit' && activePlot ? (
        <PurchasePanel
          key={`edit-${activePlot.id}`}
          kind="edit"
          rect={activePlot}
          plot={activePlot}
          config={config}
          mine={mine}
          onMap={applyMap}
          onShow={showBought}
          onClose={() => setPanel({ type: 'plot', id: activePlot.id })}
        />
      ) : null}
      {config && panel?.type === 'menu' ? (
        <MenuPanel
          config={config}
          address={address}
          mineCount={myPlots.length}
          lang={lang}
          onLang={setLang}
          onOpen={(type) => setPanel({ type })}
          onConnect={connect}
          onDisconnect={() => void tonConnectUI.disconnect()}
          onClose={closePanel}
        />
      ) : null}
      {config && panel?.type === 'stats' ? (
        <StatsPanel plots={plots} config={config} onOpenPlot={openPlot} onClose={closePanel} />
      ) : null}
      {config && panel?.type === 'about' ? <AboutPanel config={config} onClose={closePanel} /> : null}
      {config && panel?.type === 'refunds' ? <RefundsPanel config={config} onClose={closePanel} /> : null}
      {config && panel?.type === 'mine' ? (
        <MinePanel plots={myPlots} connected={Boolean(mine)} onConnect={connect} onOpenPlot={openPlot} onClose={closePanel} />
      ) : null}

      {toast ? (
        <p className="toast" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
