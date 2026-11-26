import { ClientRoot } from '@/components/ClientRoot';

export default function Page() {
  return (
    <main>
      {/* Read by search engines and by anyone without JavaScript; the map replaces it visually. */}
      <div className="visually-hidden">
        <h1>GramMap — pixel map on TON</h1>
        <p>
          A sheet of one million pixels on The Open Network. Buy an area with GRAM from your TON wallet and put your
          picture and link on it.
        </p>
      </div>
      <ClientRoot />
    </main>
  );
}
