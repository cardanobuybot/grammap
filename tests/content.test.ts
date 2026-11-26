import { describe, expect, it } from 'vitest';
import { ContentError, cleanTitle, cleanUrl, contentHash, decodeImage } from '@/lib/content';

// 1×1 transparent PNG.
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ContentError ? e.code : 'other';
  }
  return 'ok';
};

describe('plot content', () => {
  it('cleans titles and enforces their length', () => {
    expect(cleanTitle('  Hello \n  world  ')).toBe('Hello world');
    expect(cleanTitle('safe‮evil')).toBe('safe evil');
    expect(codeOf(() => cleanTitle('   '))).toBe('title_required');
    expect(codeOf(() => cleanTitle(42))).toBe('title_required');
    expect(codeOf(() => cleanTitle('x'.repeat(61)))).toBe('title_too_long');
    expect(cleanTitle('я'.repeat(60))).toHaveLength(60);
  });

  it('accepts https links only', () => {
    expect(cleanUrl('https://t.me/grammap')).toBe('https://t.me/grammap');
    expect(cleanUrl('example.com/page')).toBe('https://example.com/page');
    expect(cleanUrl('')).toBeNull();
    expect(cleanUrl(null)).toBeNull();
    expect(codeOf(() => cleanUrl('http://example.com'))).toBe('url_invalid');
    expect(codeOf(() => cleanUrl('javascript:alert(1)'))).toBe('url_invalid');
    expect(codeOf(() => cleanUrl('data:text/html,<script>'))).toBe('url_invalid');
    expect(codeOf(() => cleanUrl('https://user:pass@example.com'))).toBe('url_invalid');
    expect(codeOf(() => cleanUrl('https://localhost'))).toBe('url_invalid');
    expect(codeOf(() => cleanUrl('https://example.com/' + 'a'.repeat(200)))).toBe('url_too_long');
  });

  it('accepts real images and refuses disguised or oversized ones', () => {
    const image = decodeImage(`data:image/png;base64,${PNG}`);
    expect(image).toMatchObject({ ext: 'png', mime: 'image/png' });
    expect(decodeImage('')).toBeNull();
    expect(codeOf(() => decodeImage(`data:image/jpeg;base64,${PNG}`))).toBe('image_invalid');
    expect(codeOf(() => decodeImage('data:image/svg+xml;base64,PHN2Zz4='))).toBe('image_invalid');
    expect(codeOf(() => decodeImage('data:text/html;base64,PGh0bWw+'))).toBe('image_invalid');
    const big = Buffer.alloc(400 * 1024, 1).toString('base64');
    expect(codeOf(() => decodeImage(`data:image/png;base64,${big}`))).toBe('image_too_large');
  });

  it('hashes content deterministically and distinguishes every field', () => {
    const base = { title: 'A', url: 'https://a.example/', image: null };
    expect(contentHash(base)).toMatch(/^[0-9a-f]{24}$/);
    expect(contentHash({ ...base })).toBe(contentHash(base));
    expect(contentHash({ ...base, title: 'B' })).not.toBe(contentHash(base));
    expect(contentHash({ ...base, url: null })).not.toBe(contentHash(base));
    expect(contentHash({ ...base, image: 'https://i.example/x.png' })).not.toBe(contentHash(base));
  });
});
