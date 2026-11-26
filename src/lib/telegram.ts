/**
 * GramMap as the Mini App of the Telegram bot @grammap_app. Outside Telegram nothing here
 * does anything: Telegram's script is loaded only when Telegram opened the page.
 */

export const TELEGRAM_BOT = 'grammap_app';

/** Opens the Mini App; with a plot id, straight on that plot. */
export function telegramAppLink(plotId?: string): `https://${string}` {
  return `https://t.me/${TELEGRAM_BOT}?startapp${plotId ? `=${plotId}` : ''}`;
}

/** The parts of window.Telegram.WebApp that GramMap uses. */
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  openTelegramLink(url: string): void;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
}

interface Where {
  hash: string;
  search: string;
}

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';
/** Telegram keeps the launch data here once its script has read it, so a reload still counts. */
const SAVED_LAUNCH = '__telegram__initParams';
/** The colour of the map's surroundings, for Telegram's own header and background. */
const INK = '#071a38';

const hashParams = (where: Where) => new URLSearchParams(where.hash.replace(/^#/, ''));

/** Telegram passes its launch data in the address of the page it opens. */
export function launchedByTelegram(where: Where, saved = false): boolean {
  const hash = hashParams(where);
  return saved || hash.has('tgWebAppData') || hash.has('tgWebAppPlatform') || /[?&]tgWebAppStartParam=/.test(where.search);
}

/** The `startapp` value of the link that opened the Mini App. */
export function telegramStartParam(where: Where): string | null {
  const fromQuery = new URLSearchParams(where.search).get('tgWebAppStartParam');
  if (fromQuery) return fromQuery;
  const data = hashParams(where).get('tgWebAppData');
  return data ? new URLSearchParams(data).get('start_param') : null;
}

/** A start parameter that names a plot: "450-470", like the plot's own address. */
export function plotFromStartParam(param: string | null): string | null {
  return param && /^\d{1,4}-\d{1,4}$/.test(param) ? param : null;
}

function savedLaunch(): boolean {
  try {
    return window.sessionStorage.getItem(SAVED_LAUNCH) !== null;
  } catch {
    return false;
  }
}

const current = () => (window as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;

function loadScript(): Promise<void> {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

function setUp(app: TelegramWebApp) {
  const call = (fn: () => void) => {
    try {
      fn();
    } catch {
      /* an older Telegram without this method */
    }
  };
  call(() => app.ready());
  call(() => app.expand());
  // Dragging the map down must move the map, not close the app.
  if (app.isVersionAtLeast('7.7')) call(() => app.disableVerticalSwipes?.());
  if (app.isVersionAtLeast('6.1')) {
    call(() => app.setHeaderColor?.(INK));
    call(() => app.setBackgroundColor?.(INK));
  }
  if (app.isVersionAtLeast('7.10')) call(() => app.setBottomBarColor?.(INK));
}

let pending: Promise<TelegramWebApp | null> | null = null;

/** The Mini App API, set up for the map; null outside Telegram. Loads Telegram's script once. */
export function telegram(): Promise<TelegramWebApp | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  pending ??= (async () => {
    if (!launchedByTelegram(window.location, savedLaunch())) return null;
    if (!current()) await loadScript();
    const app = current();
    // Telegram's script also runs in ordinary browsers; there it has no launch data.
    if (!app?.initData) return null;
    setUp(app);
    return app;
  })();
  return pending;
}

/** Opens Telegram's "share to a chat" screen with a link that opens the plot in the Mini App. */
export function shareInTelegram(app: TelegramWebApp, plotId: string, text: string) {
  const url = encodeURIComponent(telegramAppLink(plotId));
  app.openTelegramLink(`https://t.me/share/url?url=${url}&text=${encodeURIComponent(text)}`);
}
