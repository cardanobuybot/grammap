/**
 * Payment comments. Everything that changes the map is a transfer to the treasury
 * whose text comment says what the sender wants:
 *
 *   gm:b:X:Y:W:H[:CONTENT]   buy the W×H area whose top-left pixel is X,Y
 *   gm:u:X:Y:CONTENT         change the picture and link of the plot at X,Y ("0" clears it)
 *   gm:h:X:Y  /  gm:s:X:Y    moderator: hide / show the content of the plot covering X,Y
 *
 * CONTENT is the 24-character hash returned by /api/drafts.
 */

export const CONTENT_HASH_RE = /^[0-9a-f]{24}$/;

export type Command =
  | { kind: 'buy'; x: number; y: number; w: number; h: number; content: string | null }
  | { kind: 'update'; x: number; y: number; content: string | null }
  | { kind: 'hide'; x: number; y: number }
  | { kind: 'show'; x: number; y: number };

export type ParsedComment =
  | { type: 'command'; command: Command }
  /** Starts with our prefix but cannot be read. Worth listing for a refund. */
  | { type: 'malformed' }
  /** An unrelated transfer. */
  | { type: 'foreign' };

const BUY_RE = /^gm:b:(\d{1,5}):(\d{1,5}):(\d{1,5}):(\d{1,5})(?::([0-9a-f]{24}))?$/;
const UPDATE_RE = /^gm:u:(\d{1,5}):(\d{1,5}):([0-9a-f]{24}|0)$/;
const MOD_RE = /^gm:([hs]):(\d{1,5}):(\d{1,5})$/;

export function buildBuyComment(x: number, y: number, w: number, h: number, content?: string | null): string {
  return `gm:b:${x}:${y}:${w}:${h}${content ? `:${content}` : ''}`;
}

export function buildUpdateComment(x: number, y: number, content: string | null): string {
  return `gm:u:${x}:${y}:${content ?? '0'}`;
}

export function parseComment(raw: string | null | undefined): ParsedComment {
  if (!raw) return { type: 'foreign' };
  const text = raw.trim().toLowerCase();
  if (!text.startsWith('gm:')) return { type: 'foreign' };

  let m = BUY_RE.exec(text);
  if (m) {
    return {
      type: 'command',
      command: { kind: 'buy', x: +m[1], y: +m[2], w: +m[3], h: +m[4], content: m[5] ?? null },
    };
  }
  m = UPDATE_RE.exec(text);
  if (m) {
    return {
      type: 'command',
      command: { kind: 'update', x: +m[1], y: +m[2], content: m[3] === '0' ? null : m[3] },
    };
  }
  m = MOD_RE.exec(text);
  if (m) {
    return { type: 'command', command: { kind: m[1] === 'h' ? 'hide' : 'show', x: +m[2], y: +m[3] } };
  }
  return { type: 'malformed' };
}

/** Content hashes mentioned by a batch of comments, so they can be loaded before indexing. */
export function contentHashesIn(comments: Iterable<string | null>): string[] {
  const out = new Set<string>();
  for (const c of comments) {
    const p = parseComment(c);
    if (p.type !== 'command') continue;
    const cmd = p.command;
    if ((cmd.kind === 'buy' || cmd.kind === 'update') && cmd.content) out.add(cmd.content);
  }
  return [...out];
}
