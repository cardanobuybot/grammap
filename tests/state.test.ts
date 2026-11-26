import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildBuyComment, buildUpdateComment } from '@/lib/protocol';
import type { ChainTx } from '@/lib/types';

const TREASURY = '0:' + 'f'.repeat(64);
const ALICE = '0:' + 'a'.repeat(64);
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let dir: string;
let chainFile: string;
let versionsDir: string;
let state: typeof import('@/lib/state');
let content: typeof import('@/lib/content');

const globals = globalThis as Record<string, unknown>;
const forgetMemory = () => {
  delete globals.__grammapMemory;
};
const versions = async () => (await readdir(versionsDir)).sort();

let seq = 0;
const tx = (from: string, grams: number, comment: string | null): ChainTx => {
  seq += 1;
  return {
    hash: seq.toString(16).padStart(64, '0'),
    lt: String(seq * 1000),
    utime: 1_800_000_000 + seq,
    from,
    value: BigInt(Math.round(grams * 1e9)).toString(),
    comment,
    credited: true,
  };
};
const chain: ChainTx[] = [];
const push = async (...txs: ChainTx[]) => {
  chain.push(...txs);
  await writeFile(chainFile, JSON.stringify(chain));
};

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'grammap-'));
  chainFile = path.join(dir, 'chain.json');
  versionsDir = path.join(dir, '.data', 'state', `mainnet-0${'f'.repeat(15)}`);
  await writeFile(chainFile, '[]');
  process.chdir(dir);
  process.env.MOCK_CHAIN_FILE = chainFile;
  process.env.TREASURY_ADDRESS = TREASURY;
  process.env.GENESIS_UTIME = '0';
  delete process.env.VERCEL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  state = await import('@/lib/state');
  content = await import('@/lib/content');
});

describe('map state against a (mock) chain', () => {
  it('starts empty and saves nothing until a payment arrives', async () => {
    const s = await state.syncNow();
    expect(s.plots).toEqual([]);
    expect(s.lastLt).toBe('0');
    await expect(readdir(path.join(dir, '.data'))).rejects.toThrow();
  });

  it('indexes a purchase together with the draft it commits to, and saves that version', async () => {
    const draft = await content.saveDraft({
      title: 'Hello map',
      url: 't.me/example',
      image: `data:image/png;base64,${PNG}`,
    });
    expect(draft.content.image).toMatch(/^\/api\/dev-blob\/img\/[0-9a-f]{32}\.png$/);

    await push(tx(ALICE, 100, buildBuyComment(10, 10, 10, 10, draft.hash)));
    const s = await state.syncNow();
    expect(s.plots).toHaveLength(1);
    expect(s.plots[0]).toMatchObject({ id: '10-10', owner: ALICE, contentHash: draft.hash });
    expect(s.plots[0].content).toEqual({ title: 'Hello map', url: 'https://t.me/example', image: draft.content.image });

    expect(await versions()).toEqual([`${s.lastLt.padStart(24, '0')}.json`]);
    const saved = JSON.parse(await readFile(path.join(versionsDir, (await versions())[0]), 'utf8'));
    expect(saved).toEqual(s);
  });

  it('serves a recent copy from memory without asking the chain again', async () => {
    await push(tx(ALICE, 1, buildBuyComment(0, 0, 1, 1)));
    expect((await state.getState(60_000)).state.plots).toHaveLength(1);
    expect((await state.getState(0)).state.plots).toHaveLength(2);
  });

  it('moves the cursor past unrelated transfers without saving a new version', async () => {
    const before = await versions();
    await push(tx(ALICE, 5, 'thanks!'), tx(ALICE, 5, null));
    const s = await state.syncNow();
    expect(s.lastLt).toBe(chain.at(-1)!.lt);
    expect(s.plots).toHaveLength(2);
    expect(await versions()).toEqual(before);
  });

  it('a fresh instance continues from the newest saved version instead of replaying history', async () => {
    forgetMemory();
    const second = await content.saveDraft({ title: 'Changed', url: '' });
    chain.push(tx(ALICE, 0.1, buildUpdateComment(10, 10, second.hash)));
    // Hand the mock only what is newer than the saved cursor: a correct indexer needs nothing else.
    const savedLt = BigInt((await versions()).at(-1)!.replace('.json', ''));
    await writeFile(chainFile, JSON.stringify(chain.filter((t) => BigInt(t.lt) > savedLt)));
    const s = await state.syncNow();
    expect(s.plots).toHaveLength(2);
    expect(s.plots.find((p) => p.id === '10-10')?.content).toEqual({ title: 'Changed', url: null, image: null });
    await writeFile(chainFile, JSON.stringify(chain));
  });

  it('answers page loads from what is saved, without waiting for the chain', async () => {
    forgetMemory();
    const cold = await state.peekState(15_000);
    expect(cold.state.plots).toHaveLength(2);
    expect(cold).toMatchObject({ fresh: false, stale: false });
    await state.syncNow();
    expect(await state.peekState(15_000)).toMatchObject({ fresh: true, stale: false });
    expect((await state.peekState(0)).fresh).toBe(false);
  });

  it('two instances that index the same payment agree and do not trip over each other', async () => {
    await state.syncNow();
    const instanceA = structuredClone(globals.__grammapMemory);
    await push(tx(ALICE, 4, buildBuyComment(50, 50, 2, 2)));

    forgetMemory(); // instance B starts cold, indexes the payment and saves the version
    const fromB = await state.syncNow();
    const savedByB = await readFile(path.join(versionsDir, (await versions()).at(-1)!), 'utf8');

    globals.__grammapMemory = instanceA; // instance A has not seen it yet
    const fromA = await state.syncNow();
    expect(fromA).toEqual(fromB);
    expect(fromA.plots.map((p) => p.id).sort()).toEqual(['0-0', '10-10', '50-50']);
    expect(await readFile(path.join(versionsDir, (await versions()).at(-1)!), 'utf8')).toBe(savedByB);
  });

  it('keeps only the last few saved versions', async () => {
    const name = (t: ChainTx) => `${t.lt.padStart(24, '0')}.json`;
    const written: string[] = [];
    for (let i = 0; i < 7; i++) {
      const t = tx(ALICE, 1, buildBuyComment(80 + i, 80, 1, 1));
      written.push(name(t));
      await push(t);
      await state.syncNow();
    }
    // A running instance removes its own older versions as it goes…
    const kept = await versions();
    expect(kept).toEqual(expect.arrayContaining(written.slice(-4)));
    for (const gone of written.slice(0, 3)) expect(kept).not.toContain(gone);

    // …and a starting instance clears whatever earlier instances left behind.
    forgetMemory();
    expect((await state.peekState(0)).state.plots).toHaveLength(10);
    expect(await versions()).toEqual(written.slice(-4));
  });
});
