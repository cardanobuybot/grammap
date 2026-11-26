export const dynamic = 'force-dynamic';

/**
 * TON Connect manifest. Wallets fetch it to show who is asking to connect, so the
 * addresses in it must match the site the visitor is actually on.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      url: origin,
      name: 'GramMap',
      iconUrl: `${origin}/icon-180.png`,
      termsOfUseUrl: `${origin}/terms`,
      privacyPolicyUrl: `${origin}/terms#privacy`,
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
}
