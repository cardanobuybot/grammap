import type { Metadata } from 'next';
import { NotFoundPage } from '@/components/site/pages';

export const metadata: Metadata = {
  title: 'Page not found — GramMap',
  robots: { index: false, follow: false },
};

/** Shown when a page of this group says "not found", for example a plot that nobody has bought. */
export default function NotFound() {
  return <NotFoundPage />;
}
