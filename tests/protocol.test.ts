import { describe, expect, it } from 'vitest';
import { buildBuyComment, buildUpdateComment, contentHashesIn, parseComment } from '@/lib/protocol';

const HASH = 'a'.repeat(24);

describe('payment comments', () => {
  it('round-trips a purchase', () => {
    expect(parseComment(buildBuyComment(10, 20, 5, 4))).toEqual({
      type: 'command',
      command: { kind: 'buy', x: 10, y: 20, w: 5, h: 4, content: null },
    });
    expect(parseComment(buildBuyComment(10, 20, 5, 4, HASH))).toEqual({
      type: 'command',
      command: { kind: 'buy', x: 10, y: 20, w: 5, h: 4, content: HASH },
    });
  });

  it('round-trips an update and a clear', () => {
    expect(parseComment(buildUpdateComment(1, 2, HASH))).toEqual({
      type: 'command',
      command: { kind: 'update', x: 1, y: 2, content: HASH },
    });
    expect(parseComment(buildUpdateComment(1, 2, null))).toEqual({
      type: 'command',
      command: { kind: 'update', x: 1, y: 2, content: null },
    });
  });

  it('reads moderation commands', () => {
    expect(parseComment('gm:h:5:6')).toEqual({ type: 'command', command: { kind: 'hide', x: 5, y: 6 } });
    expect(parseComment('gm:s:5:6')).toEqual({ type: 'command', command: { kind: 'show', x: 5, y: 6 } });
  });

  it('tolerates case and surrounding spaces', () => {
    expect(parseComment('  GM:B:1:2:3:4 ')).toMatchObject({ type: 'command' });
  });

  it('separates unrelated transfers from broken ones', () => {
    expect(parseComment(null)).toEqual({ type: 'foreign' });
    expect(parseComment('thanks for the coffee')).toEqual({ type: 'foreign' });
    expect(parseComment('gm:b:1:2:3')).toEqual({ type: 'malformed' });
    expect(parseComment('gm:b:1:2:3:4:nothex')).toEqual({ type: 'malformed' });
    expect(parseComment('gm:b:-1:2:3:4')).toEqual({ type: 'malformed' });
    expect(parseComment('gm:b:1.5:2:3:4')).toEqual({ type: 'malformed' });
    expect(parseComment('gm:b:1:2:3:4 extra')).toEqual({ type: 'malformed' });
  });

  it('collects the content hashes a batch refers to', () => {
    const other = 'b'.repeat(24);
    expect(
      contentHashesIn([buildBuyComment(0, 0, 1, 1, HASH), buildUpdateComment(0, 0, other), 'hello', null, 'gm:h:0:0']).sort(),
    ).toEqual([HASH, other]);
  });
});
