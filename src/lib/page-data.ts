import { getServerConfig, toPublicConfig } from './server-config';
import { getState } from './state';
import type { Plot, PublicConfig } from './types';

/**
 * What the server-rendered pages know about the map. `plots` is null when the saved map could
 * not be read: a page then leaves the plots out instead of claiming that nothing is sold.
 */
export interface PageData {
  config: PublicConfig;
  plots: Plot[] | null;
}

const LOAD_TIMEOUT_MS = 12_000;

function timeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
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

/** Never throws and never hangs: a page of text must build even when the storage or the chain is away. */
export async function loadPageData(maxAgeMs = 60_000): Promise<PageData> {
  const config = toPublicConfig(getServerConfig());
  try {
    const { state } = await timeout(getState(maxAgeMs), LOAD_TIMEOUT_MS);
    return { config, plots: state.plots };
  } catch (e) {
    console.error('[grammap] pages: map is unavailable:', (e as Error).message);
    return { config, plots: null };
  }
}
