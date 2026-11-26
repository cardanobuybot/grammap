import { jsonError } from '@/lib/api';
import { getState } from '@/lib/state';

export const dynamic = 'force-dynamic';

/** Payments that arrived but could not be applied, newest first. Public on-chain data. */
export async function GET() {
  try {
    const { state } = await getState(30_000);
    return Response.json(
      { rejected: [...state.rejected].reverse() },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15' } },
    );
  } catch (e) {
    console.error('[grammap] /api/rejected:', (e as Error).message);
    return jsonError(503, 'unavailable');
  }
}
