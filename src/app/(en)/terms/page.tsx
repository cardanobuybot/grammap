import { TermsPage, termsMetadata } from '@/components/site/pages';

export const generateMetadata = () => termsMetadata('en');

export default function Page() {
  return <TermsPage lang="en" />;
}
