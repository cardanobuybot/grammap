import { HomePage, homeMetadata } from '@/components/site/pages';
import { mapViewport } from '@/lib/site-metadata';

// The text version of the map is rebuilt at most every five minutes.
export const revalidate = 300;
export const viewport = mapViewport;
export const generateMetadata = () => homeMetadata('en');

export default function Page() {
  return <HomePage lang="en" />;
}
