import { Address, Cell, beginCell, toNano } from '@ton/core';

/** Server-side TON helpers. Not imported by browser code. */

export function parseAddress(input: string | null | undefined): Address | null {
  if (!input) return null;
  try {
    return Address.parse(input.trim());
  } catch {
    return null;
  }
}

/** "0:abc…" lowercase — the form used for owners everywhere in the state. */
export function rawOf(address: Address): string {
  return address.toRawString().toLowerCase();
}

export function normalizeRaw(input: string | null | undefined): string | null {
  const a = parseAddress(input);
  return a ? rawOf(a) : null;
}

/**
 * User-friendly, non-bounceable form. Payments must use it: a bounceable transfer to a
 * wallet that has never sent a transaction is returned to the sender.
 */
export function friendlyOf(raw: string): string {
  return Address.parseRaw(raw).toString({ urlSafe: true, bounceable: false });
}

/** Body of a transfer with a text comment, as a base64 BoC for TON Connect. */
export function commentPayload(text: string): string {
  return beginCell().storeUint(0, 32).storeStringTail(text).endCell().toBoc().toString('base64');
}

export function decodeComment(boc: string | null | undefined, encoding: 'base64' | 'hex'): string | null {
  if (!boc) return null;
  try {
    const cell = Cell.fromBoc(Buffer.from(boc, encoding))[0];
    const slice = cell.beginParse();
    if (slice.remainingBits < 32) return null;
    if (slice.loadUint(32) !== 0) return null;
    return slice.loadStringTail();
  } catch {
    return null;
  }
}

/** "1.5" → 1500000000n. Returns null for anything that is not a positive decimal. */
export function gramsToNano(input: string | null | undefined): bigint | null {
  if (!input || !/^\d{1,9}(\.\d{1,9})?$/.test(input.trim())) return null;
  try {
    const n = toNano(input.trim());
    return n > BigInt(0) ? n : null;
  } catch {
    return null;
  }
}
