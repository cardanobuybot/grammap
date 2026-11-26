import { describe, expect, it } from 'vitest';
import { applyTransactions, emptyState, type IndexerLimits } from '@/lib/indexer';
import { buildBuyComment, buildUpdateComment } from '@/lib/protocol';
import type { ChainTx, PlotContent } from '@/lib/types';

const GRAM = BigInt(1_000_000_000);
const TREASURY = '0:' + 'f'.repeat(64);
const ALICE = '0:' + 'a'.repeat(64);
const BOB = '0:' + 'b'.repeat(64);
const HASH = '1'.repeat(24);
const HASH2 = '2'.repeat(24);

const limits: IndexerLimits = {
  gridW: 100,
  gridH: 100,
  maxSide: 50,
  maxArea: 400,
  reserved: [{ x: 40, y: 40, w: 20, h: 20 }],
  pricePerPixel: GRAM,
  editFee: GRAM / BigInt(10),
  admins: [TREASURY],
};

const contents = new Map<string, PlotContent>([
  [HASH, { title: 'First', url: 'https://example.com/', image: null }],
  [HASH2, { title: 'Second', url: null, image: 'https://img.example/a.png' }],
]);

let seq = 0;
function tx(from: string | null, grams: number | bigint, comment: string | null, extra: Partial<ChainTx> = {}): ChainTx {
  seq += 1;
  return {
    hash: seq.toString(16).padStart(64, '0'),
    lt: String(seq * 1000),
    utime: 1_800_000_000 + seq,
    from,
    value: (typeof grams === 'bigint' ? grams : BigInt(Math.round(grams * 1e9))).toString(),
    comment,
    credited: true,
    ...extra,
  };
}

const start = () => emptyState('mainnet', TREASURY);
const run = (txs: ChainTx[], state = start()) => applyTransactions(state, txs, limits, contents);

describe('indexer', () => {
  it('gives a paid area to the sender, with the content the payment commits to', () => {
    const s = run([tx(ALICE, 12, buildBuyComment(0, 0, 4, 3, HASH))]);
    expect(s.plots).toHaveLength(1);
    expect(s.plots[0]).toMatchObject({ id: '0-0', x: 0, y: 0, w: 4, h: 3, owner: ALICE, contentHash: HASH, hidden: false });
    expect(s.plots[0].content?.title).toBe('First');
    expect(s.rejected).toHaveLength(0);
  });

  it('keeps the first buyer when two payments want overlapping areas', () => {
    const s = run([tx(ALICE, 4, buildBuyComment(10, 10, 2, 2)), tx(BOB, 9, buildBuyComment(11, 11, 3, 3))]);
    expect(s.plots.map((p) => p.owner)).toEqual([ALICE]);
    expect(s.rejected).toHaveLength(1);
    expect(s.rejected[0]).toMatchObject({ from: BOB, reason: 'taken', value: (BigInt(9) * GRAM).toString() });
  });

  it('orders by logical time, not by arrival order in the batch', () => {
    const first = tx(ALICE, 1, buildBuyComment(5, 5, 1, 1));
    const second = tx(BOB, 1, buildBuyComment(5, 5, 1, 1));
    expect(run([second, first]).plots[0].owner).toBe(ALICE);
  });

  it('rejects underpaid, oversized, out-of-sheet and reserved purchases', () => {
    const s = run([
      tx(ALICE, 3.999999999, buildBuyComment(0, 0, 2, 2)),
      tx(ALICE, 3000, buildBuyComment(0, 0, 51, 1)),
      tx(ALICE, 3000, buildBuyComment(0, 0, 21, 20)),
      tx(ALICE, 3000, buildBuyComment(99, 99, 2, 1)),
      tx(ALICE, 3000, buildBuyComment(45, 45, 1, 1)),
      tx(ALICE, 3000, buildBuyComment(0, 0, 0, 1)),
      tx(ALICE, 3000, 'gm:b:broken'),
    ]);
    expect(s.plots).toHaveLength(0);
    expect(s.rejected.map((r) => r.reason)).toEqual([
      'underpaid',
      'too_large',
      'too_large',
      'out_of_bounds',
      'reserved',
      'out_of_bounds',
      'malformed',
    ]);
  });

  it('ignores unrelated transfers, bounced payments and messages without a sender', () => {
    const s = run([
      tx(ALICE, 50, 'salary'),
      tx(ALICE, 50, null),
      tx(ALICE, 4, buildBuyComment(0, 0, 2, 2), { credited: false }),
      tx(null, 4, buildBuyComment(0, 0, 2, 2)),
    ]);
    expect(s.plots).toHaveLength(0);
    expect(s.rejected).toHaveLength(0);
    expect(s.lastLt).toBe(String(seq * 1000));
  });

  it('lets only the owner change or clear the content, for the edit fee', () => {
    let s = run([tx(ALICE, 4, buildBuyComment(0, 0, 2, 2, HASH))]);
    s = run([tx(BOB, 1, buildUpdateComment(0, 0, HASH2))], s);
    expect(s.plots[0].contentHash).toBe(HASH);
    expect(s.rejected.at(-1)?.reason).toBe('not_owner');

    s = run([tx(ALICE, 0.05, buildUpdateComment(0, 0, HASH2))], s);
    expect(s.plots[0].contentHash).toBe(HASH);
    expect(s.rejected.at(-1)?.reason).toBe('underpaid');

    s = run([tx(ALICE, 0.1, buildUpdateComment(0, 0, HASH2))], s);
    expect(s.plots[0]).toMatchObject({ contentHash: HASH2, owner: ALICE });
    expect(s.plots[0].content?.title).toBe('Second');

    s = run([tx(ALICE, 0.1, buildUpdateComment(0, 0, null))], s);
    expect(s.plots[0]).toMatchObject({ contentHash: null, content: null });

    s = run([tx(ALICE, 0.1, buildUpdateComment(7, 7, HASH))], s);
    expect(s.rejected.at(-1)?.reason).toBe('no_plot');
  });

  it('keeps the current content when an update names a hash that was never stored', () => {
    let s = run([tx(ALICE, 4, buildBuyComment(0, 0, 2, 2, HASH))]);
    s = run([tx(ALICE, 0.1, buildUpdateComment(0, 0, '9'.repeat(24)))], s);
    expect(s.plots[0].contentHash).toBe(HASH);
    expect(s.rejected.at(-1)?.reason).toBe('malformed');
  });

  it('sells the area without content when the purchase names an unknown hash', () => {
    const s = run([tx(ALICE, 4, buildBuyComment(0, 0, 2, 2, '9'.repeat(24)))]);
    expect(s.plots[0]).toMatchObject({ owner: ALICE, content: null, contentHash: null });
  });

  it('lets a moderator hide and show content; nobody else', () => {
    let s = run([tx(ALICE, 4, buildBuyComment(0, 0, 2, 2, HASH))]);
    s = run([tx(BOB, 1, 'gm:h:1:1')], s);
    expect(s.plots[0].hidden).toBe(false);
    s = run([tx(TREASURY, 0.01, 'gm:h:1:1')], s);
    expect(s.plots[0].hidden).toBe(true);
    expect(s.plots[0].owner).toBe(ALICE);
    s = run([tx(TREASURY, 0.01, 'gm:s:0:0')], s);
    expect(s.plots[0].hidden).toBe(false);
  });

  it('skips transactions it has already processed and is repeatable', () => {
    const batch = [tx(ALICE, 4, buildBuyComment(0, 0, 2, 2)), tx(BOB, 1, buildBuyComment(3, 3, 1, 1))];
    const once = run(batch);
    const twice = run(batch, once);
    expect(twice).toEqual(once);
    expect(run(batch)).toEqual(once);
  });

  it('does not mutate the state it was given', () => {
    const before = run([tx(ALICE, 4, buildBuyComment(0, 0, 2, 2, HASH))]);
    const snapshot = JSON.stringify(before);
    run([tx(ALICE, 0.1, buildUpdateComment(0, 0, HASH2)), tx(TREASURY, 0.01, 'gm:h:0:0')], before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
