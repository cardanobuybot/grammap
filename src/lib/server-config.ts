import { friendlyOf, gramsToNano, normalizeRaw } from './ton';
import type { IndexerLimits } from './indexer';
import type { Network, PublicConfig, Rect } from './types';

/** 2026-11-26T00:00:00Z — transfers older than the project are never indexed. */
const DEFAULT_GENESIS_UTIME = 1795651200;

export interface ServerConfig {
  network: Network;
  /** Raw treasury address, or null while it is not configured (sales closed). */
  treasury: string | null;
  admins: string[];
  gridW: number;
  gridH: number;
  maxSide: number;
  maxArea: number;
  pricePerPixel: bigint;
  editFee: bigint;
  genesisUtime: number;
  reserved: Rect[];
  toncenterKey: string | null;
  tonapiKey: string | null;
  telegramUrl: string | null;
}

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function httpsUrlEnv(name: string): string | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The centre of the sheet carries the map's own title and cannot be bought. */
function titlePlate(gridW: number, gridH: number): Rect[] {
  if (process.env.TITLE_PLATE === '0' || gridW < 300 || gridH < 200) return [];
  const w = 120;
  const h = 40;
  return [{ x: Math.floor((gridW - w) / 2), y: Math.floor((gridH - h) / 2), w, h }];
}

export function getServerConfig(): ServerConfig {
  const network: Network = process.env.TON_NETWORK === 'testnet' ? 'testnet' : 'mainnet';
  const treasury = normalizeRaw(process.env.TREASURY_ADDRESS);
  const extraAdmins = (process.env.ADMIN_ADDRESSES ?? '')
    .split(',')
    .map((s) => normalizeRaw(s))
    .filter((s): s is string => Boolean(s));
  const gridW = intEnv('GRID_W', 1000, 10, 5000);
  const gridH = intEnv('GRID_H', 1000, 10, 5000);

  return {
    network,
    treasury,
    admins: [...new Set([...(treasury ? [treasury] : []), ...extraAdmins])],
    gridW,
    gridH,
    maxSide: intEnv('MAX_SIDE', 200, 1, 5000),
    maxArea: intEnv('MAX_AREA', 10000, 1, 25_000_000),
    pricePerPixel: gramsToNano(process.env.PRICE_PER_PIXEL) ?? BigInt(1_000_000_000),
    editFee: gramsToNano(process.env.EDIT_FEE) ?? BigInt(100_000_000),
    genesisUtime: intEnv('GENESIS_UTIME', DEFAULT_GENESIS_UTIME, 0, 4_000_000_000),
    reserved: titlePlate(gridW, gridH),
    toncenterKey: process.env.TONCENTER_API_KEY?.trim() || null,
    tonapiKey: process.env.TONAPI_KEY?.trim() || null,
    telegramUrl: httpsUrlEnv('TELEGRAM_URL'),
  };
}

export function limitsOf(cfg: ServerConfig): IndexerLimits {
  return {
    gridW: cfg.gridW,
    gridH: cfg.gridH,
    maxSide: cfg.maxSide,
    maxArea: cfg.maxArea,
    reserved: cfg.reserved,
    pricePerPixel: cfg.pricePerPixel,
    editFee: cfg.editFee,
    admins: cfg.admins,
  };
}

export function toPublicConfig(cfg: ServerConfig): PublicConfig {
  return {
    network: cfg.network,
    gridW: cfg.gridW,
    gridH: cfg.gridH,
    pricePerPixel: cfg.pricePerPixel.toString(),
    editFee: cfg.editFee.toString(),
    maxSide: cfg.maxSide,
    maxArea: cfg.maxArea,
    reserved: cfg.reserved,
    treasury: cfg.treasury ? friendlyOf(cfg.treasury) : null,
    salesOpen: Boolean(cfg.treasury),
    telegramUrl: cfg.telegramUrl,
  };
}
