import { readFile } from 'node:fs/promises';
import { isBlobConfigured, safeLocalPath } from '@/lib/store';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  json: 'application/json',
};

/** Serves files from the local development store. Not available in production. */
export async function GET(_request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (process.env.VERCEL || isBlobConfigured()) return new Response('Not found', { status: 404 });
  const { path } = await ctx.params;
  const ext = path[path.length - 1]?.split('.').pop() ?? '';
  if (!TYPES[ext]) return new Response('Not found', { status: 404 });
  try {
    const data = await readFile(safeLocalPath(path.join('/')));
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': TYPES[ext], 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
