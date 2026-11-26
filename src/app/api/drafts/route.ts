import { jsonError, rateLimited } from '@/lib/api';
import { ContentError, saveDraft } from '@/lib/content';
import { getState } from '@/lib/state';
import { StoreNotConfiguredError } from '@/lib/store';

export const dynamic = 'force-dynamic';

const MAX_BODY = 640 * 1024;

/** Stores the picture, title and link a buyer wants to show, and returns the hash to pay with. */
export async function POST(request: Request) {
  if (rateLimited(request, 'drafts', 12, 10 * 60_000)) return jsonError(429, 'rate_limited');
  const length = Number(request.headers.get('content-length') ?? '0');
  if (!length || length > MAX_BODY) return jsonError(413, 'image_too_large');

  let body: { title?: unknown; url?: unknown; image?: unknown; keepImageOf?: { x?: unknown; y?: unknown } };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return jsonError(413, 'image_too_large');
    body = JSON.parse(text);
  } catch {
    return jsonError(400, 'bad_request');
  }
  if (!body || typeof body !== 'object') return jsonError(400, 'bad_request');

  try {
    // An owner editing a plot may keep its picture: look it up here instead of trusting an address from the browser.
    let existingImage: string | null = null;
    const keep = body.keepImageOf;
    if (!body.image && keep && Number.isInteger(keep.x) && Number.isInteger(keep.y)) {
      const { state } = await getState(30_000);
      existingImage = state.plots.find((p) => p.x === keep.x && p.y === keep.y)?.content?.image ?? null;
    }
    const draft = await saveDraft({ title: body.title, url: body.url, image: body.image, existingImage });
    return Response.json(draft, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof ContentError) return jsonError(400, e.code);
    if (e instanceof StoreNotConfiguredError) return jsonError(503, 'storage');
    console.error('[grammap] /api/drafts:', (e as Error).message);
    return jsonError(503, 'unavailable');
  }
}
