import { describe, expect, it } from 'vitest';
import { launchedByTelegram, plotFromStartParam, telegramAppLink, telegramStartParam } from '@/lib/telegram';

// What Telegram puts in the address of a Mini App it opens (shortened).
const initData = new URLSearchParams({
  query_id: 'AAH',
  user: JSON.stringify({ id: 1, first_name: 'Pasha' }),
  start_param: '450-470',
  auth_date: '1795693000',
  hash: 'abc',
}).toString();
const launchHash = `#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=8.0&tgWebAppPlatform=android`;

describe('Telegram Mini App', () => {
  it('knows when Telegram opened the page', () => {
    expect(launchedByTelegram({ hash: launchHash, search: '' })).toBe(true);
    expect(launchedByTelegram({ hash: '', search: '?tgWebAppStartParam=1-2' })).toBe(true);
    // After a reload inside Telegram, its script has the launch data saved.
    expect(launchedByTelegram({ hash: '', search: '' }, true)).toBe(true);
    expect(launchedByTelegram({ hash: '', search: '' })).toBe(false);
    expect(launchedByTelegram({ hash: '#faq', search: '?p=1-2' })).toBe(false);
  });

  it('reads the start parameter from the query or from the launch data', () => {
    expect(telegramStartParam({ hash: '', search: '?tgWebAppStartParam=12-34' })).toBe('12-34');
    expect(telegramStartParam({ hash: launchHash, search: '' })).toBe('450-470');
    expect(telegramStartParam({ hash: '#tgWebAppPlatform=ios', search: '' })).toBeNull();
    expect(telegramStartParam({ hash: '', search: '' })).toBeNull();
  });

  it('accepts only plot ids as start parameters', () => {
    expect(plotFromStartParam('450-470')).toBe('450-470');
    expect(plotFromStartParam('0-999')).toBe('0-999');
    expect(plotFromStartParam('tonconnect')).toBeNull();
    expect(plotFromStartParam('450-470-1')).toBeNull();
    expect(plotFromStartParam('')).toBeNull();
    expect(plotFromStartParam(null)).toBeNull();
  });

  it('links to the Mini App, optionally on a plot', () => {
    expect(telegramAppLink()).toBe('https://t.me/grammap_app?startapp');
    expect(telegramAppLink('450-470')).toBe('https://t.me/grammap_app?startapp=450-470');
  });
});
