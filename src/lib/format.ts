/** Formatting helpers shared by the interface. No dependencies, safe in the browser. */

const NNBSP = ' ';

export function formatInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}

/** Nanograms → "1 250.5". Trailing zeros are dropped; at most `maxFraction` decimals are kept. */
export function formatGrams(nano: string | bigint, maxFraction = 2): string {
  let value: bigint;
  try {
    value = typeof nano === 'bigint' ? nano : BigInt(nano);
  } catch {
    return '0';
  }
  const unit = BigInt(1_000_000_000);
  const whole = value / unit;
  const fraction = (value % unit).toString().padStart(9, '0').slice(0, maxFraction).replace(/0+$/, '');
  const head = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return fraction ? `${head}.${fraction}` : head;
}

export function gramsNumber(nano: string | bigint): number {
  try {
    return Number(typeof nano === 'bigint' ? nano : BigInt(nano)) / 1e9;
  } catch {
    return 0;
  }
}

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function percent(part: number, total: number): string {
  if (!total || !part) return '0%';
  const p = (part / total) * 100;
  if (p < 0.01) return '<0.01%';
  return `${p < 10 ? p.toFixed(2) : p.toFixed(1)}%`;
}

export function formatDate(utime: number, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(utime * 1000));
  } catch {
    return new Date(utime * 1000).toISOString().slice(0, 16).replace('T', ' ');
  }
}
