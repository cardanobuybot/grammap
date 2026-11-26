'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => <div className="app app--boot" aria-busy="true" />,
});

export function ClientRoot() {
  return <App />;
}
