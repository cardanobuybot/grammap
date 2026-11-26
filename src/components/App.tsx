'use client';

import { THEME, TonConnectUIProvider } from '@tonconnect/ui-react';
import { I18nProvider, useI18n } from '@/lib/i18n';
import Shell from './Shell';

function Connected() {
  const { lang } = useI18n();
  return (
    <TonConnectUIProvider
      // Wallets read this file to show who is asking to connect; it is served for whatever host the visitor is on.
      manifestUrl={`${window.location.origin}/tonconnect-manifest.json`}
      analytics={{ mode: 'off' }}
      language={lang}
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
      <Shell />
    </TonConnectUIProvider>
  );
}

/** Browser-only root: TON Connect needs `window`, so this never renders on the server. */
export default function App() {
  return (
    <I18nProvider>
      <Connected />
    </I18nProvider>
  );
}
