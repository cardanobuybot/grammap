'use client';

import dynamic from 'next/dynamic';
import type { AppProps } from './App';

const App = dynamic<AppProps>(() => import('./App'), {
  ssr: false,
  loading: () => <div className="app app--boot" aria-busy="true" />,
});

export function ClientRoot(props: AppProps) {
  return <App {...props} />;
}
