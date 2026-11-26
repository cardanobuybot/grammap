'use client';

import { THEME, TonConnectUIProvider } from '@tonconnect/ui-react';
import { useEffect } from 'react';
import { I18nProvider, useI18n, type Lang } from '@/lib/i18n';
import { telegramAppLink } from '@/lib/telegram';
import Shell from './Shell';

export interface AppProps {
  /** Language of the address the map was opened on (/ru). The visitor's own choice still wins. */
  lang?: Lang;
  /** Plot to open on, for the map at /plot/x-y. */
  plot?: string;
}

function Connected({ plot }: { plot?: string }) {
  const { lang } = useI18n();
  return (
    <TonConnectUIProvider
      // Wallets read this file to show who is asking to connect; it is served for whatever host the visitor is on.
      manifestUrl={`${window.location.origin}/tonconnect-manifest.json`}
      analytics={{ mode: 'off' }}
      language={lang}
      // In the Telegram Mini App, a wallet app sends the user back here after signing.
      actionsConfiguration={{ twaReturnUrl: telegramAppLink() }}
      uiPreferences={{
        theme: THEME.DARK,
        borderRadius: 's',
        colorsSet: {
          [THEME.DARK]: {
            accent: '#ff6b2c',
            background: { primary: '#0a2247', secondary: '#0e3371', segment: '#124089', tint: '#124089' },
          },
        },
      }}
    >
      <Shell initialPlot={plot} />
    </TonConnectUIProvider>
  );
}

/** Browser-only root: TON Connect needs `window`, so this never renders on the server. */
export default function App({ lang, plot }: AppProps) {
  // The page under the map is its text version for crawlers and browsers without JavaScript.
  // With the map running it is out of sight, so it must be out of reach of the keyboard and screen readers too.
  useEffect(() => {
    const text = document.getElementById('text-version');
    text?.setAttribute('inert', '');
    return () => text?.removeAttribute('inert');
  }, []);

  return (
    <I18nProvider routeLang={lang}>
      <Connected plot={plot} />
    </I18nProvider>
  );
}
