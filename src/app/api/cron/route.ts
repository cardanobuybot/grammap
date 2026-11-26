import { jsonError } from '@/lib/api';
import { announceChanges } from '@/lib/indexnow';
import { syncNow } from '@/lib/state';

export const dynamic = 'force-dynamic';

/**
 * Daily housekeeping: indexes payments even if nobody opened the map, then tells the search
 * engines which pages are new or changed.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return jsonError(401, 'unauthorized');
  try {
    const state = await syncNow();
    // Announcing is a courtesy to the search engines; the run is a success without it.
    const indexNow = await announceChanges(state.plots).catch((e: Error) => {
      console.error('[grammap] IndexNow:', e.message);
      return { submitted: 0, failed: true };
    });
    return Response.json({ ok: true, plots: state.plots.length, lastLt: state.lastLt, indexNow });
  } catch (e) {
    console.error('[grammap] /api/cron:', (e as Error).message);
    return jsonError(503, 'unavailable');
  }
}
