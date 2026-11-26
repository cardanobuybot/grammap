import { TermsPage, termsMetadata } from '@/components/site/pages';

export const generateMetadata = () => termsMetadata('ru');

export default function Page() {
  return <TermsPage lang="ru" />;
}
