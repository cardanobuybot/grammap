import { after } from 'next/server';
import { mapResponse } from '@/lib/api';
import { emptyState } from '@/lib/indexer';
import { getServerConfig } from '@/lib/server-config';
import { peekState, syncNow } from '@/lib/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = getServerConfig();
  try {
    // Answer with what is known and catch up with the chain after the response is sent:
    // a slow indexer must not hold up the map.
    const { state, fresh, stale } = await peekState(15_000);
    if (!fresh) {
      after(() =>
        syncNow().catch((e) => {
          console.error('[grammap] background sync failed:', (e as Error).message);
        }),
      );
    }
    return Response.json(mapResponse(cfg, state, stale), {
      headers: {
        // The CDN answers bursts of visitors; a fresh purchase reaches everyone within seconds.
        'Cache-Control': stale ? 'no-store' : 'public, max-age=0, s-maxage=5, stale-while-revalidate=30',
      },
    });
  } catch (e) {
    console.error('[grammap] /api/map:', (e as Error).message);
    // Still send the settings so the sheet can be drawn; the map shows as unavailable.
    return Response.json(mapResponse(cfg, emptyState(cfg.network, cfg.treasury ?? ''), true), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
