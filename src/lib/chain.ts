import { readFile } from 'node:fs/promises';
import { decodeComment } from './ton';
import type { ChainTx, Network } from './types';

/**
 * Reads incoming treasury transactions from public TON indexers.
 * toncenter is tried first, tonapi second; both return the same normalised shape.
 */

export interface FetchParams {
  network: Network;
  /** Raw treasury address. */
  address: string;
  /** Only transactions with a larger logical time are returned. */
  afterLt: string;
  /** Transactions older than this are returned neutralised (they only move the cursor). */
  genesisUtime: number;
  toncenterKey: string | null;
  tonapiKey: string | null;
  maxPages?: number;
}

const PAGE = 100;
const RAW_ADDRESS_RE = /^-?\d+:[0-9a-f]{64}$/;

type Json = Record<string, unknown>;

interface Page {
  txs: ChainTx[];
  /** True when the provider may hold more transactions after this page. */
  more: boolean;
}

function obj(v: unknown): Json | null {
  return v && typeof v === 'object' ? (v as Json) : null;
}

function rawAddress(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.toLowerCase();
  return RAW_ADDRESS_RE.test(s) ? s : null;
}

function nanoString(v: unknown): string {
  try {
    if (typeof v === 'string' && /^\d+$/.test(v)) return v;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return BigInt(Math.trunc(v)).toString();
  } catch {
    /* fall through */
  }
  return '0';
}

function inert(hash: string, lt: string, utime: number): ChainTx {
  return { hash, lt, utime, from: null, value: '0', comment: null, credited: false };
}

function isCredited(from: string | null, bounced: unknown, bounce: unknown, aborted: boolean): boolean {
  // An aborted transaction returns a bounceable transfer to its sender;
  // a non-bounceable one stays on the account either way.
  return Boolean(from) && bounced !== true && (!aborted || bounce === false);
}

export function fromToncenter(t: Json): ChainTx | null {
  if (typeof t.hash !== 'string' || t.lt == null) return null;
  const hash = Buffer.from(t.hash, 'base64').toString('hex');
  const lt = String(t.lt);
  const utime = Number(t.now) || 0;
  const m = obj(t.in_msg);
  if (!m) return inert(hash, lt, utime);
  const from = rawAddress(m.source);
  const content = obj(m.message_content);
  const decoded = obj(content?.decoded);
  const comment =
    decodeComment(typeof content?.body === 'string' ? content.body : null, 'base64') ??
    (typeof decoded?.comment === 'string' ? decoded.comment : null);
  const aborted = obj(t.description)?.aborted === true;
  return {
    hash,
    lt,
    utime,
    from,
    value: nanoString(m.value),
    comment,
    credited: isCredited(from, m.bounced, m.bounce, aborted),
  };
}

export function fromTonapi(t: Json): ChainTx | null {
  if (typeof t.hash !== 'string' || t.lt == null) return null;
  const hash = t.hash.toLowerCase();
  const lt = nanoString(t.lt);
  const utime = Number(t.utime) || 0;
  const m = obj(t.in_msg);
  if (!m || m.msg_type !== 'int_msg') return inert(hash, lt, utime);
  const from = rawAddress(obj(m.source)?.address);
  const decodedBody = obj(m.decoded_body);
  const comment =
    decodeComment(typeof m.raw_body === 'string' ? m.raw_body : null, 'hex') ??
    (typeof decodedBody?.text === 'string' ? decodedBody.text : null);
  return {
    hash,
    lt,
    utime,
    from,
    value: nanoString(m.value),
    comment,
    credited: isCredited(from, m.bounced, m.bounce, t.aborted === true),
  };
}

async function getJson(url: string, headers: Record<string, string>): Promise<Json> {
  // No cache option on purpose. Next.js never caches a fetch unless asked to, so every call
  // reaches the indexer; but 'no-store' would also turn the statically built pages that read
  // the map (/, /plot/X-Y, …) into errors when they are rebuilt in the background.
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return (await res.json()) as Json;
}

async function toncenterPage(p: FetchParams, afterLt: bigint): Promise<Page> {
  const base = p.network === 'testnet' ? 'https://testnet.toncenter.com' : 'https://toncenter.com';
  const q = new URLSearchParams({ account: p.address, limit: String(PAGE), sort: 'asc' });
  if (afterLt > BigInt(0)) q.set('start_lt', (afterLt + BigInt(1)).toString());
  else if (p.genesisUtime > 0) q.set('start_utime', String(p.genesisUtime));
  const json = await getJson(
    `${base}/api/v3/transactions?${q}`,
    p.toncenterKey ? { 'X-API-Key': p.toncenterKey } : {},
  );
  const list = Array.isArray(json.transactions) ? (json.transactions as Json[]) : [];
  const txs: ChainTx[] = [];
  let pending = false;
  for (const t of list) {
    // Never index a transaction the network has not finalised yet.
    if (t.emulated === true || (typeof t.finality === 'string' && t.finality !== 'finalized')) {
      pending = true;
      break;
    }
    const tx = fromToncenter(t);
    if (tx) txs.push(tx);
  }
  return { txs, more: !pending && list.length === PAGE };
}

async function tonapiPage(p: FetchParams, afterLt: bigint): Promise<Page> {
  const base = p.network === 'testnet' ? 'https://testnet.tonapi.io' : 'https://tonapi.io';
  const q = new URLSearchParams({ limit: String(PAGE), sort_order: 'asc' });
  if (afterLt > BigInt(0)) q.set('after_lt', afterLt.toString());
  const json = await getJson(
    `${base}/v2/blockchain/accounts/${encodeURIComponent(p.address)}/transactions?${q}`,
    p.tonapiKey ? { Authorization: `Bearer ${p.tonapiKey}` } : {},
  );
  const list = Array.isArray(json.transactions) ? (json.transactions as Json[]) : [];
  const txs: ChainTx[] = [];
  for (const t of list) {
    const tx = fromTonapi(t);
    if (tx) txs.push(tx);
  }
  return { txs, more: list.length === PAGE };
}

async function mockPage(file: string, afterLt: bigint): Promise<Page> {
  const all = JSON.parse(await readFile(file, 'utf8')) as ChainTx[];
  return { txs: all.filter((t) => BigInt(t.lt) > afterLt), more: false };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function walk(
  p: FetchParams,
  page: (p: FetchParams, afterLt: bigint) => Promise<Page>,
  pauseMs: number,
): Promise<ChainTx[]> {
  const out: ChainTx[] = [];
  let after = BigInt(p.afterLt);
  const maxPages = p.maxPages ?? 5;
  for (let i = 0; i < maxPages; i++) {
    const { txs, more } = await page(p, after);
    for (const tx of txs) {
      if (BigInt(tx.lt) <= after) continue;
      out.push(tx.utime < p.genesisUtime ? inert(tx.hash, tx.lt, tx.utime) : tx);
    }
    if (!more || txs.length === 0) break;
    after = BigInt(txs[txs.length - 1].lt);
    if (pauseMs) await sleep(pauseMs);
  }
  return out;
}

export interface FetchResult {
  txs: ChainTx[];
  provider: 'toncenter' | 'tonapi' | 'mock';
}

export async function fetchTransactions(p: FetchParams): Promise<FetchResult> {
  const mock = process.env.MOCK_CHAIN_FILE;
  if (mock && !process.env.VERCEL) {
    return { txs: await walk(p, (_p, after) => mockPage(mock, after), 0), provider: 'mock' };
  }
  try {
    // Without a key toncenter allows about one request a second.
    return { txs: await walk(p, toncenterPage, p.toncenterKey ? 0 : 1100), provider: 'toncenter' };
  } catch (first) {
    try {
      return { txs: await walk(p, tonapiPage, p.tonapiKey ? 0 : 1100), provider: 'tonapi' };
    } catch (second) {
      throw new Error(`Chain indexers unavailable: ${(first as Error).message}; ${(second as Error).message}`);
    }
  }
}
