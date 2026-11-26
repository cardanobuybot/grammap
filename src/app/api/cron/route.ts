import { jsonError } from '@/lib/api';
import { syncNow } from '@/lib/state';

export const dynamic = 'force-dynamic';

/** Daily safety net: indexes payments even if nobody opened the map. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return jsonError(401, 'unauthorized');
  try {
    const state = await syncNow();
    return Response.json({ ok: true, plots: state.plots.length, lastLt: state.lastLt });
  } catch (e) {
    console.error('[grammap] /api/cron:', (e as Error).message);
    return jsonError(503, 'unavailable');
  }
}
