export type Network = 'mainnet' | 'testnet';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What an owner shows on their plot. */
export interface PlotContent {
  title: string;
  url: string | null;
  image: string | null;
}

export interface Plot extends Rect {
  /** "x-y" of the top-left pixel. Plots never overlap, so this is unique. */
  id: string;
  /** Raw address of the owner, lowercase ("0:abc…"). */
  owner: string;
  /** Logical time and hash of the purchase transaction. */
  lt: string;
  hash: string;
  utime: number;
  /** Amount received for the purchase, in nanograms. */
  paid: string;
  content: PlotContent | null;
  contentHash: string | null;
  /** Set by a moderator: the plot stays owned, its picture and link are not shown. */
  hidden: boolean;
  /** Time of the last content change. */
  updatedAt: number;
}

export type RejectReason =
  | 'malformed'
  | 'out_of_bounds'
  | 'too_large'
  | 'reserved'
  | 'taken'
  | 'underpaid'
  | 'no_plot'
  | 'not_owner';

/** A payment that reached the treasury but could not be applied. Refunded by hand. */
export interface RejectedPayment {
  hash: string;
  lt: string;
  utime: number;
  from: string;
  value: string;
  comment: string;
  reason: RejectReason;
}

export interface MapState {
  v: 1;
  network: Network;
  /** Raw treasury address this state was indexed from. */
  treasury: string;
  /** Logical time of the last processed treasury transaction. */
  lastLt: string;
  plots: Plot[];
  rejected: RejectedPayment[];
}

/** An incoming treasury transaction, normalised across API providers. */
export interface ChainTx {
  hash: string;
  lt: string;
  utime: number;
  /** Raw lowercase sender address, or null for external messages. */
  from: string | null;
  /** Nanograms attached to the incoming message. */
  value: string;
  comment: string | null;
  /** True when the value stayed on the treasury (not bounced back). */
  credited: boolean;
}

/** Settings the browser needs. Contains nothing secret. */
export interface PublicConfig {
  network: Network;
  gridW: number;
  gridH: number;
  /** Nanograms per pixel. */
  pricePerPixel: string;
  /** Nanograms to change the picture or link of a plot. */
  editFee: string;
  maxSide: number;
  maxArea: number;
  reserved: Rect[];
  /** Treasury address in user-friendly form, or null while sales are closed. */
  treasury: string | null;
  salesOpen: boolean;
  telegramUrl: string | null;
}

export interface MapResponse {
  config: PublicConfig;
  plots: Plot[];
  lastLt: string;
  serverTime: number;
  /** True when the chain could not be reached and the saved copy is shown. */
  stale: boolean;
}

export interface OrderRequest {
  kind: 'buy' | 'update';
  x: number;
  y: number;
  w?: number;
  h?: number;
  /** Content hash from /api/drafts. For updates, null clears the plot. */
  content?: string | null;
}

export interface OrderResponse {
  to: string;
  amount: string;
  payload: string;
  comment: string;
  validUntil: number;
  network: Network;
}
