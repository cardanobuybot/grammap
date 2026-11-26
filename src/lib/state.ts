import { fetchTransactions } from './chain';
import { loadContents } from './content';
import { applyTransactions, emptyState, mapChanged } from './indexer';
import { contentHashesIn } from './protocol';
import { getServerConfig, limitsOf, type ServerConfig } from './server-config';
import { getStore } from './store';
import type { MapState } from './types';

/**
 * The map state is a cache of what the chain says. It is only ever advanced by applying
 * new treasury transactions, and the indexer is deterministic, so every server instance
 * that has seen the chain up to the same transaction holds the same state.
 *
 * Each saved state is its own write-once file named after the last transaction it includes.
 * Two instances saving the same version write the same bytes, so whoever comes second
 * simply finds the file already there. No locks, no overwrites.
 */

interface Memory {
  key: string;
  state: MapState;
  /** When this instance last asked the chain for news. */
  syncedAt: number;
  /** Transactions applied since the last save that changed nothing on the map. */
  unsavedTxs: number;
  /** Versions this instance saved, oldest first, for clean-up. */
  written: string[];
}

const g = globalThis as typeof globalThis & {
  __grammapMemory?: Memory;
  __grammapSync?: Promise<MapState> | null;
  /** When a sync last failed on this instance. */
  __grammapSyncFailedAt?: number;
};

const KEEP_VERSIONS = 4;
/** Unrelated transfers only move the cursor; save it anyway once this many have piled up. */
const SAVE_CURSOR_AFTER = 80;
const VERSION_RE = /\/(\d{24})\.json$/;

function stateDir(cfg: ServerConfig): string {
  const id = (cfg.treasury ?? 'none').replace(/[^0-9a-f]/g, '').slice(0, 16);
  return `state/${cfg.network}-${id}/`;
}

/** Zero-padded so that alphabetical order is chain order. */
const versionPath = (dir: string, lastLt: string) => `${dir}${lastLt.padStart(24, '0')}.json`;

function parseState(text: string, cfg: ServerConfig): MapState {
  const s = JSON.parse(text) as MapState;
  if (s.v !== 1 || s.treasury !== cfg.treasury || !Array.isArray(s.plots) || !Array.isArray(s.rejected)) {
    throw new Error('Stored map state has an unexpected shape');
  }
  return s;
}

/** Newest saved state, or an empty map when nothing has been saved yet. */
async function readStored(cfg: ServerConfig): Promise<MapState> {
  const store = getStore();
  const versions = (await store.listPaths(stateDir(cfg))).filter((p) => VERSION_RE.test(p)).sort();
  for (let i = versions.length - 1; i >= 0; i--) {
    const text = await store.getText(versions[i]);
    if (text === null) continue;
    let state: MapState;
    try {
      state = parseState(text, cfg);
    } catch (e) {
      console.error(`[grammap] skipping unreadable state ${versions[i]}:`, (e as Error).message);
      continue;
    }
    // Old versions are only kept for instances that are reading them right now.
    const old = versions.slice(0, Math.max(0, i + 1 - KEEP_VERSIONS));
    if (old.length) await store.remove(old).catch(() => {});
    return state;
  }
  return emptyState(cfg.network, cfg.treasury!);
}

async function loadMemory(cfg: ServerConfig): Promise<Memory> {
  const key = stateDir(cfg);
  if (g.__grammapMemory?.key === key) return g.__grammapMemory;
  const state = await readStored(cfg);
  // Remembered as never synced: the first sync starts from this state.
  return (g.__grammapMemory = { key, state, syncedAt: 0, unsavedTxs: 0, written: [] });
}

async function runSync(cfg: ServerConfig): Promise<MapState> {
  const memory = await loadMemory(cfg);
  const base = memory.state;

  const { txs } = await fetchTransactions({
    network: cfg.network,
    address: cfg.treasury!,
    afterLt: base.lastLt,
    genesisUtime: cfg.genesisUtime,
    toncenterKey: cfg.toncenterKey,
    tonapiKey: cfg.tonapiKey,
  });
  if (txs.length === 0) {
    memory.syncedAt = Date.now();
    return base;
  }

  // A storage failure here aborts the sync: a paid plot is never indexed as empty by mistake.
  const contents = await loadContents(contentHashesIn(txs.map((t) => t.comment)));
  const next = applyTransactions(base, txs, limitsOf(cfg), contents);

  memory.unsavedTxs += txs.length;
  if (mapChanged(base, next) || memory.unsavedTxs >= SAVE_CURSOR_AFTER) {
    const store = getStore();
    const file = versionPath(memory.key, next.lastLt);
    // Save before answering: once a buyer is told the plot is theirs, a restart must not forget it.
    // If another instance already saved this version, it holds the same bytes.
    await store.createText(file, JSON.stringify(next));
    memory.unsavedTxs = 0;
    memory.written.push(file);
    if (memory.written.length > KEEP_VERSIONS) {
      await store.remove(memory.written.splice(0, memory.written.length - KEEP_VERSIONS)).catch(() => {});
    }
  }
  memory.state = next;
  memory.syncedAt = Date.now();
  return next;
}

/** Asks the chain for new treasury transactions and applies them. Calls made while one is running share it. */
export function syncNow(): Promise<MapState> {
  const cfg = getServerConfig();
  if (!cfg.treasury) return Promise.resolve(emptyState(cfg.network, ''));
  if (!g.__grammapSync) {
    g.__grammapSync = runSync(cfg)
      .catch((e) => {
        g.__grammapSyncFailedAt = Date.now();
        throw e;
      })
      .finally(() => {
        g.__grammapSync = null;
      });
  }
  return g.__grammapSync;
}

export interface StateResult {
  state: MapState;
  /** True when the chain could not be reached and an older copy is returned. */
  stale: boolean;
}

/** Current map, synced with the chain unless this instance did so within `maxAgeMs`. */
export async function getState(maxAgeMs: number): Promise<StateResult> {
  const cfg = getServerConfig();
  if (!cfg.treasury) return { state: emptyState(cfg.network, ''), stale: false };
  const memory = await loadMemory(cfg);
  if (Date.now() - memory.syncedAt < maxAgeMs) return { state: memory.state, stale: false };
  try {
    return { state: await syncNow(), stale: false };
  } catch (e) {
    console.error('[grammap] sync failed:', (e as Error).message);
    return { state: memory.state, stale: true };
  }
}

export interface PeekResult {
  state: MapState;
  /** False when this instance has not checked the chain within `maxAgeMs`: sync in the background. */
  fresh: boolean;
  /** True when syncing has been failing for a while and the map may lag behind the chain. */
  stale: boolean;
}

/**
 * The map as this instance knows it, without waiting for the chain. Page loads use this so
 * that a slow indexer never holds up the map; the caller schedules a sync when `fresh` is false.
 */
export async function peekState(maxAgeMs: number): Promise<PeekResult> {
  const cfg = getServerConfig();
  if (!cfg.treasury) return { state: emptyState(cfg.network, ''), fresh: true, stale: false };
  const memory = await loadMemory(cfg);
  const age = Date.now() - memory.syncedAt;
  const failedAt = g.__grammapSyncFailedAt ?? 0;
  return {
    state: memory.state,
    fresh: age < maxAgeMs,
    stale: failedAt > memory.syncedAt && Date.now() - failedAt < 120_000 && age > 120_000,
  };
}
