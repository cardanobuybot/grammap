import { toPublicConfig, type ServerConfig } from './server-config';
import type { MapResponse, MapState } from './types';

export function mapResponse(cfg: ServerConfig, state: MapState, stale: boolean): MapResponse {
  return {
    config: toPublicConfig(cfg),
    plots: state.plots,
    lastLt: state.lastLt,
    serverTime: Math.floor(Date.now() / 1000),
    stale,
  };
}

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Sliding-window limiter kept in instance memory: a speed bump, not a guarantee. */
const hits = new Map<string, number[]>();

export function rateLimited(request: Request, bucket: string, max: number, windowMs: number): boolean {
  // Local demo seeding only; the switch is ignored on Vercel.
  if (process.env.DISABLE_RATE_LIMIT === '1' && !process.env.VERCEL) return false;
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return false;
}
