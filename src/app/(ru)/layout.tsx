import '@fontsource-variable/jura';
import '@fontsource-variable/golos-text';
import '../globals.css';
import { baseMetadata, docViewport } from '@/lib/site-metadata';

/** Russian pages: the same site under /ru, served with <html lang="ru">. */
export const metadata = baseMetadata();
export const viewport = docViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
