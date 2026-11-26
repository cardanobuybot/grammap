import { describe, expect, it } from 'vitest';
import { fromTonapi, fromToncenter } from '@/lib/chain';
import { commentPayload, decodeComment, friendlyOf, gramsToNano, normalizeRaw } from '@/lib/ton';

describe('ton helpers', () => {
  it('builds a comment payload that decodes back', () => {
    const text = 'gm:b:120:340:10:10:0123456789abcdef01234567';
    expect(decodeComment(commentPayload(text), 'base64')).toBe(text);
  });

  it('decodes comment bodies exactly as the indexers return them', () => {
    // Bodies of a real mainnet transfer, as served by toncenter (base64) and tonapi (hex).
    expect(decodeComment('te6cckEBAQEAIQAAPgAAAABRdWF2ZW5jZSBFeGNoYW5nZSAjOTIzYzNiZjOcqJVi', 'base64')).toBe(
      'Quavence Exchange #923c3bf3',
    );
    expect(
      decodeComment('b5ee9c7201010101002100003e0000000051756176656e63652045786368616e676520233932336333626633', 'hex'),
    ).toBe('Quavence Exchange #923c3bf3');
  });

  it('returns null for bodies that are not text comments', () => {
    expect(decodeComment(null, 'base64')).toBeNull();
    expect(decodeComment('not a boc', 'base64')).toBeNull();
    expect(decodeComment('b5ee9c720101010100020000', 'hex')).toBeNull();
  });

  it('normalises friendly and raw addresses to one raw form', () => {
    const raw = '0:83dfd552e63729b472fcbcc8c45ebcc6691702558b68ec7527e1ba403a0f31a8';
    expect(normalizeRaw('EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N')).toBe(raw);
    expect(normalizeRaw('UQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqEBI')).toBe(raw);
    expect(normalizeRaw(raw.toUpperCase())).toBe(raw);
    expect(normalizeRaw('nonsense')).toBeNull();
    // Payments go to the non-bounceable form.
    expect(friendlyOf(raw)).toBe('UQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqEBI');
  });

  it('converts gram amounts to nanograms', () => {
    expect(gramsToNano('1')).toBe(BigInt(1_000_000_000));
    expect(gramsToNano('0.1')).toBe(BigInt(100_000_000));
    expect(gramsToNano('0')).toBeNull();
    expect(gramsToNano('-1')).toBeNull();
    expect(gramsToNano('abc')).toBeNull();
    expect(gramsToNano(undefined)).toBeNull();
  });
});

// Trimmed copies of real responses from the two indexers for the same two transactions.
const toncenterOk = {
  hash: 'Yo2YZy9Kc0/3RnbT/AoAqqfL7CLSvnRyYbNMmxQ6oG8=',
  lt: '119065450000030',
  now: 1795640430,
  description: { type: 'ord', aborted: false },
  in_msg: {
    source: '0:1F3E7A086D1F7928D929F8E8DC74BD748393EBFD83D95B3DE0D50634FDA15F46',
    value: '10000000000',
    bounce: true,
    bounced: false,
    message_content: {
      body: 'te6cckEBAQEAIQAAPgAAAABRdWF2ZW5jZSBFeGNoYW5nZSAjOTIzYzNiZjOcqJVi',
      decoded: { '@type': 'text_comment', comment: 'Quavence Exchange #923c3bf3' },
    },
  },
  emulated: false,
  finality: 'finalized',
};
const tonapiOk = {
  hash: '628d98672f4a734ff74676d3fc0a00aaa7cbec22d2be747261b34c9b143aa06f',
  lt: 119065450000030,
  utime: 1795640430,
  success: true,
  aborted: false,
  in_msg: {
    msg_type: 'int_msg',
    bounce: true,
    bounced: false,
    value: 10000000000,
    source: { address: '0:1f3e7a086d1f7928d929f8e8dc74bd748393ebfd83d95b3de0d50634fda15f46' },
    raw_body: 'b5ee9c7201010101002100003e0000000051756176656e63652045786368616e676520233932336333626633',
    decoded_op_name: 'text_comment',
    decoded_body: { text: 'Quavence Exchange #923c3bf3' },
  },
};

describe('indexer responses', () => {
  it('reads the same transaction identically from both providers', () => {
    const a = fromToncenter(toncenterOk);
    const b = fromTonapi(tonapiOk);
    expect(a).toEqual({
      hash: '628d98672f4a734ff74676d3fc0a00aaa7cbec22d2be747261b34c9b143aa06f',
      lt: '119065450000030',
      utime: 1795640430,
      from: '0:1f3e7a086d1f7928d929f8e8dc74bd748393ebfd83d95b3de0d50634fda15f46',
      value: '10000000000',
      comment: 'Quavence Exchange #923c3bf3',
      credited: true,
    });
    expect(b).toEqual(a);
  });

  it('treats an aborted bounceable transfer as returned, a non-bounceable one as kept', () => {
    const aborted = { ...toncenterOk, description: { type: 'ord', aborted: true } };
    expect(fromToncenter(aborted)?.credited).toBe(false);
    expect(fromToncenter({ ...aborted, in_msg: { ...toncenterOk.in_msg, bounce: false } })?.credited).toBe(true);
    expect(fromTonapi({ ...tonapiOk, aborted: true })?.credited).toBe(false);
    expect(fromTonapi({ ...tonapiOk, aborted: true, in_msg: { ...tonapiOk.in_msg, bounce: false } })?.credited).toBe(true);
  });

  it('never credits a bounced message or one without a sender', () => {
    expect(fromToncenter({ ...toncenterOk, in_msg: { ...toncenterOk.in_msg, bounced: true } })?.credited).toBe(false);
    expect(fromToncenter({ ...toncenterOk, in_msg: { ...toncenterOk.in_msg, source: null } })?.credited).toBe(false);
    expect(fromToncenter({ ...toncenterOk, in_msg: null })).toMatchObject({ credited: false, from: null });
    expect(fromTonapi({ ...tonapiOk, in_msg: { ...tonapiOk.in_msg, msg_type: 'ext_in_msg' } })?.credited).toBe(false);
  });
});
