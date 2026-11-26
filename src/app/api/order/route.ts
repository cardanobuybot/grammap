import { jsonError, rateLimited } from '@/lib/api';
import { loadContents } from '@/lib/content';
import { areaProblem } from '@/lib/geometry';
import { CONTENT_HASH_RE, buildBuyComment, buildUpdateComment } from '@/lib/protocol';
import { getServerConfig, limitsOf } from '@/lib/server-config';
import { getState } from '@/lib/state';
import { commentPayload, friendlyOf } from '@/lib/ton';
import type { OrderRequest, OrderResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const isCoord = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 100_000;

/**
 * Prepares the transfer a wallet has to sign: where to, how much and the comment that
 * tells the indexer what is being bought. Nothing is reserved — the first payment to
 * reach the chain gets the area.
 */
export async function POST(request: Request) {
  if (rateLimited(request, 'order', 30, 60_000)) return jsonError(429, 'rate_limited');
  const cfg = getServerConfig();
  if (!cfg.treasury) return jsonError(409, 'sales_closed');

  let body: OrderRequest;
  try {
    body = (await request.json()) as OrderRequest;
  } catch {
    return jsonError(400, 'bad_request');
  }
  if (!body || !isCoord(body.x) || !isCoord(body.y)) return jsonError(400, 'bad_request');

  const content = body.content ?? null;
  if (content !== null && (typeof content !== 'string' || !CONTENT_HASH_RE.test(content))) {
    return jsonError(400, 'bad_request');
  }

  try {
    const { state } = await getState(5_000);
    if (content && !(await loadContents([content])).has(content)) return jsonError(400, 'content_missing');

    let amount: bigint;
    let comment: string;
    if (body.kind === 'buy') {
      if (!isCoord(body.w) || !isCoord(body.h)) return jsonError(400, 'bad_request');
      const rect = { x: body.x, y: body.y, w: body.w, h: body.h };
      const problem = areaProblem(rect, limitsOf(cfg), state.plots);
      if (problem) return jsonError(409, problem);
      amount = cfg.pricePerPixel * BigInt(rect.w * rect.h);
      comment = buildBuyComment(rect.x, rect.y, rect.w, rect.h, content);
    } else if (body.kind === 'update') {
      if (!state.plots.some((p) => p.x === body.x && p.y === body.y)) return jsonError(404, 'no_plot');
      amount = cfg.editFee;
      comment = buildUpdateComment(body.x, body.y, content);
    } else {
      return jsonError(400, 'bad_request');
    }

    const order: OrderResponse = {
      to: friendlyOf(cfg.treasury),
      amount: amount.toString(),
      payload: commentPayload(comment),
      comment,
      validUntil: Math.floor(Date.now() / 1000) + 600,
      network: cfg.network,
    };
    return Response.json(order, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[grammap] /api/order:', (e as Error).message);
    return jsonError(503, 'unavailable');
  }
}
