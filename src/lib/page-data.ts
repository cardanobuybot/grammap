import { getServerConfig, toPublicConfig } from './server-config';
import { getState, peekState } from './state';
import type { MapState, Plot, PublicConfig } from './types';

/**
 * What the server-rendered pages know about the map. `plots` is null when the saved map could
 * not be read: a page then leaves the plots out instead of claiming that nothing is sold.
 */
export interface PageData {
  config: PublicConfig;
  plots: Plot[] | null;
}

/** Longest a page waits for the chain before it settles for what this instance already knows. */
const CHAIN_WAIT_MS = 8_000;

class TimedOut extends Error {}

function timeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimedOut(`timed out after ${ms} ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * The map for a page: synced with the chain unless this instance did so within `maxAgeMs`,
 * without waiting long for a slow indexer. Throws only when the saved map cannot be read.
 */
export async function pageState(maxAgeMs: number): Promise<MapState> {
  try {
    return (await timeout(getState(maxAgeMs), CHAIN_WAIT_MS)).state;
  } catch (e) {
    if (!(e instanceof TimedOut)) throw e;
    // The sync carries on in the background and the next build of the page picks it up.
    return (await peekState(maxAgeMs)).state;
  }
}

/** Never throws: a page of text must build even when the storage or the chain is away. */
export async function loadPageData(maxAgeMs = 60_000): Promise<PageData> {
  const config = toPublicConfig(getServerConfig());
  try {
    return { config, plots: (await pageState(maxAgeMs)).plots };
  } catch (e) {
    console.error('[grammap] pages: map is unavailable:', (e as Error).message);
    return { config, plots: null };
  }
}
