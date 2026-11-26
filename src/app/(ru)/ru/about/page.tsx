import { AboutPage, aboutMetadata } from '@/components/site/pages';

export const generateMetadata = () => aboutMetadata('ru');

export default function Page() {
  return <AboutPage lang="ru" />;
}
