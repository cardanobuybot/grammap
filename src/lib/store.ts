import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Small file store: Vercel Blob in production, a local folder in development.
 *
 * Public blobs are served through a CDN that may show an overwritten file's old content
 * for up to a minute. Everything stored here is therefore write-once: a file's content
 * never changes after it is created, and "the latest" is found by listing, not by re-reading.
 */

export class StoreNotConfiguredError extends Error {
  constructor() {
    super('File storage is not configured');
  }
}

export interface Store {
  /** Content of a write-once file, or null when it does not exist. */
  getText(pathname: string): Promise<string | null>;
  /** Stores a write-once file. Writing the same path again must carry the same content. */
  putText(pathname: string, text: string): Promise<void>;
  /** Creates a file only if the path is free. Returns false when it already exists. */
  createText(pathname: string, text: string): Promise<boolean>;
  /** Paths under a folder, straight from the store's index (never from the CDN). */
  listPaths(prefix: string): Promise<string[]>;
  remove(pathnames: string[]): Promise<void>;
  /** Stores a public, immutable file and returns the URL browsers load it from. */
  putPublicFile(pathname: string, data: Buffer, contentType: string): Promise<string>;
}

const LOCAL_DIR = path.join(process.cwd(), '.data');

function safeLocalPath(pathname: string): string {
  const full = path.normalize(path.join(LOCAL_DIR, pathname));
  if (!full.startsWith(LOCAL_DIR + path.sep)) throw new Error('Bad path');
  return full;
}

const isMissing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT';

const localStore: Store = {
  async getText(pathname) {
    try {
      return await readFile(safeLocalPath(pathname), 'utf8');
    } catch (e) {
      if (isMissing(e)) return null;
      throw e;
    }
  },
  async putText(pathname, text) {
    const full = safeLocalPath(pathname);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, text, 'utf8');
  },
  async createText(pathname, text) {
    const full = safeLocalPath(pathname);
    await mkdir(path.dirname(full), { recursive: true });
    try {
      await writeFile(full, text, { encoding: 'utf8', flag: 'wx' });
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw e;
    }
  },
  async listPaths(prefix) {
    try {
      const names = await readdir(safeLocalPath(prefix));
      return names.map((name) => `${prefix}${name}`);
    } catch (e) {
      if (isMissing(e)) return [];
      throw e;
    }
  },
  async remove(pathnames) {
    await Promise.all(
      pathnames.map((p) =>
        unlink(safeLocalPath(p)).catch((e) => {
          if (!isMissing(e)) throw e;
        }),
      ),
    );
  },
  async putPublicFile(pathname, data) {
    const full = safeLocalPath(pathname);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return `/api/dev-blob/${pathname}`;
  },
};

const YEAR = 365 * 24 * 60 * 60;
const JSON_TYPE = 'application/json; charset=utf-8';

const blobStore: Store = {
  async getText(pathname) {
    const { get } = await import('@vercel/blob');
    const result = await get(pathname, { access: 'public' });
    if (!result || result.statusCode !== 200) return null;
    return new Response(result.stream).text();
  },
  async putText(pathname, text) {
    const { put } = await import('@vercel/blob');
    await put(pathname, text, { access: 'public', contentType: JSON_TYPE, allowOverwrite: true, cacheControlMaxAge: YEAR });
  },
  async createText(pathname, text) {
    const { put, head, BlobNotFoundError } = await import('@vercel/blob');
    try {
      await put(pathname, text, { access: 'public', contentType: JSON_TYPE, allowOverwrite: false, cacheControlMaxAge: YEAR });
      return true;
    } catch (e) {
      // "Already exists" has no error class of its own: ask the store whether the file is there.
      try {
        await head(pathname);
        return false;
      } catch (missing) {
        if (missing instanceof BlobNotFoundError) throw e;
        throw missing;
      }
    }
  },
  async listPaths(prefix) {
    const { list } = await import('@vercel/blob');
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      out.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  },
  async remove(pathnames) {
    if (!pathnames.length) return;
    const { del } = await import('@vercel/blob');
    await del(pathnames);
  },
  async putPublicFile(pathname, data, contentType) {
    const { put } = await import('@vercel/blob');
    const result = await put(pathname, data, { access: 'public', contentType, allowOverwrite: true, cacheControlMaxAge: YEAR });
    return result.url;
  },
};

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export function getStore(): Store {
  if (isBlobConfigured()) return blobStore;
  // On Vercel the local folder is read-only and per-instance: refuse rather than lose data.
  if (process.env.VERCEL) throw new StoreNotConfiguredError();
  return localStore;
}

export { LOCAL_DIR, safeLocalPath };
