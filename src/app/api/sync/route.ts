import { jsonError, mapResponse, rateLimited } from '@/lib/api';
import { getServerConfig } from '@/lib/server-config';
import { getState } from '@/lib/state';

export const dynamic = 'force-dynamic';

/** Asks the chain for new payments right now. Called by a buyer waiting for confirmation. */
export async function POST(request: Request) {
  if (rateLimited(request, 'sync', 40, 60_000)) return jsonError(429, 'rate_limited');
  const cfg = getServerConfig();
  try {
    const { state, stale } = await getState(3_000);
    return Response.json(mapResponse(cfg, state, stale), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[grammap] /api/sync:', (e as Error).message);
    return jsonError(503, 'unavailable');
  }
}
