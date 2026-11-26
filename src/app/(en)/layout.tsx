import '@fontsource-variable/jura';
import '@fontsource-variable/golos-text';
import '../globals.css';
import { baseMetadata, docViewport } from '@/lib/site-metadata';

/**
 * English pages. Russian ones live in the (ru) group with a root layout of their own,
 * so that each language is served with the right <html lang>.
 */
export const metadata = baseMetadata();
export const viewport = docViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
