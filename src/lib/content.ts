import { createHash } from 'node:crypto';
import { imageSize } from 'image-size';
import { CONTENT_HASH_RE } from './protocol';
import { getStore } from './store';
import type { PlotContent } from './types';

/**
 * What owners put on their plots: a title, an optional https link and an optional picture.
 * Content is stored under the hash of its own text, so a payment comment that carries the
 * hash commits to exactly this content and nothing can be swapped in later.
 */

export const TITLE_MAX = 60;
export const URL_MAX = 200;
export const IMAGE_MAX_BYTES = 350 * 1024;
export const IMAGE_MAX_SIDE = 2048;

export type ContentErrorCode =
  | 'title_required'
  | 'title_too_long'
  | 'url_invalid'
  | 'url_too_long'
  | 'image_invalid'
  | 'image_too_large';

export class ContentError extends Error {
  constructor(public code: ContentErrorCode) {
    super(code);
  }
}

const IMAGE_TYPES: Record<string, { ext: string; mime: string; magic: (b: Buffer) => boolean }> = {
  png: {
    ext: 'png',
    mime: 'image/png',
    magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  jpeg: { ext: 'jpg', mime: 'image/jpeg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  webp: {
    ext: 'webp',
    mime: 'image/webp',
    magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  gif: { ext: 'gif', mime: 'image/gif', magic: (b) => /^GIF8[79]a$/.test(b.subarray(0, 6).toString('latin1')) },
};

// Control characters and the bidirectional overrides used to disguise text.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

export function cleanTitle(input: unknown): string {
  if (typeof input !== 'string') throw new ContentError('title_required');
  const title = input.normalize('NFC').replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (!title) throw new ContentError('title_required');
  if ([...title].length > TITLE_MAX) throw new ContentError('title_too_long');
  return title;
}

export function cleanUrl(input: unknown): string | null {
  if (input == null || input === '') return null;
  if (typeof input !== 'string') throw new ContentError('url_invalid');
  let text = input.trim();
  if (!text) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new ContentError('url_invalid');
  }
  // Links open in the visitor's browser: https only, a real host name, nobody's credentials.
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) {
    throw new ContentError('url_invalid');
  }
  const out = url.toString();
  if (out.length > URL_MAX) throw new ContentError('url_too_long');
  return out;
}

export interface DecodedImage {
  data: Buffer;
  ext: string;
  mime: string;
}

export function decodeImage(dataUrl: unknown): DecodedImage | null {
  if (dataUrl == null || dataUrl === '') return null;
  if (typeof dataUrl !== 'string') throw new ContentError('image_invalid');
  const m = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new ContentError('image_invalid');
  const data = Buffer.from(m[2], 'base64');
  if (data.length > IMAGE_MAX_BYTES) throw new ContentError('image_too_large');
  const type = IMAGE_TYPES[m[1]];
  if (data.length < 16 || !type.magic(data)) throw new ContentError('image_invalid');
  try {
    const size = imageSize(data);
    if (!size.width || !size.height || size.width > IMAGE_MAX_SIDE || size.height > IMAGE_MAX_SIDE) {
      throw new ContentError('image_too_large');
    }
  } catch (e) {
    if (e instanceof ContentError) throw e;
    throw new ContentError('image_invalid');
  }
  return { data, ext: type.ext, mime: type.mime };
}

export function contentHash(content: PlotContent): string {
  return createHash('sha256')
    .update(JSON.stringify([content.title, content.url, content.image]))
    .digest('hex')
    .slice(0, 24);
}

const contentPath = (hash: string) => `content/${hash}.json`;

/** Validates a draft, stores its picture and text, and returns the hash to put in the payment. */
export async function saveDraft(input: {
  title?: unknown;
  url?: unknown;
  image?: unknown;
  /** Address of a picture that is already stored (resolved by the server, never by the visitor). */
  existingImage?: string | null;
}): Promise<{
  hash: string;
  content: PlotContent;
}> {
  const title = cleanTitle(input.title);
  const url = cleanUrl(input.url);
  const image = decodeImage(input.image);
  const store = getStore();

  let imageUrl: string | null = input.existingImage ?? null;
  if (image) {
    const digest = createHash('sha256').update(image.data).digest('hex').slice(0, 32);
    imageUrl = await store.putPublicFile(`img/${digest}.${image.ext}`, image.data, image.mime);
  }
  const content: PlotContent = { title, url, image: imageUrl };
  const hash = contentHash(content);
  await store.putText(contentPath(hash), JSON.stringify(content));
  return { hash, content };
}

function isContent(v: unknown): v is PlotContent {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.title === 'string' &&
    (c.url === null || typeof c.url === 'string') &&
    (c.image === null || typeof c.image === 'string')
  );
}

/**
 * Loads stored content by hash. A hash with nothing behind it is simply absent from the
 * result; a storage failure throws, so the caller never indexes a paid plot as empty by mistake.
 */
export async function loadContents(hashes: readonly string[]): Promise<Map<string, PlotContent>> {
  const out = new Map<string, PlotContent>();
  if (!hashes.length) return out;
  const store = getStore();
  await Promise.all(
    hashes.filter((h) => CONTENT_HASH_RE.test(h)).map(async (hash) => {
      const text = await store.getText(contentPath(hash));
      if (text === null) return;
      const parsed: unknown = JSON.parse(text);
      if (isContent(parsed) && contentHash(parsed) === hash) out.set(hash, parsed);
    }),
  );
  return out;
}
