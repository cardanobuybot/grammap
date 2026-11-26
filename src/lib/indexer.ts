import { areaProblem, plotAt, plotId, type AreaLimits } from './geometry';
import { parseComment } from './protocol';
import type { ChainTx, MapState, Plot, PlotContent, RejectReason, RejectedPayment } from './types';

export interface IndexerLimits extends AreaLimits {
  /** Nanograms per pixel. */
  pricePerPixel: bigint;
  /** Nanograms to change the content of a plot. */
  editFee: bigint;
  /** Raw addresses allowed to hide and show content. */
  admins: readonly string[];
}

const MAX_REJECTED = 300;

/**
 * Applies treasury transactions to the map. Pure and deterministic: the same
 * transactions in the same order always give the same map, so the saved state can be
 * rebuilt from the chain at any time. Transactions at or below `state.lastLt` are skipped.
 */
export function applyTransactions(
  state: MapState,
  txs: readonly ChainTx[],
  limits: IndexerLimits,
  contents: ReadonlyMap<string, PlotContent>,
): MapState {
  const ordered = [...txs].sort((a, b) => (BigInt(a.lt) < BigInt(b.lt) ? -1 : BigInt(a.lt) > BigInt(b.lt) ? 1 : 0));
  // Copied on first change only: when nothing relevant arrived the result shares the input's
  // arrays, which is how callers tell "the map changed" from "the cursor moved".
  let plots: Plot[] = state.plots;
  let rejected: RejectedPayment[] = state.rejected;
  const ownPlots = () => (plots === state.plots ? (plots = [...state.plots]) : plots);
  let lastLt = BigInt(state.lastLt);

  const reject = (tx: ChainTx, reason: RejectReason) => {
    if (rejected === state.rejected) rejected = [...state.rejected];
    rejected.push({
      hash: tx.hash,
      lt: tx.lt,
      utime: tx.utime,
      from: tx.from ?? '',
      value: tx.value,
      comment: (tx.comment ?? '').slice(0, 80),
      reason,
    });
  };

  for (const tx of ordered) {
    const lt = BigInt(tx.lt);
    if (lt <= lastLt) continue;
    lastLt = lt;

    if (!tx.credited || !tx.from) continue;
    const parsed = parseComment(tx.comment);
    if (parsed.type === 'foreign') continue;
    if (parsed.type === 'malformed') {
      reject(tx, 'malformed');
      continue;
    }

    const cmd = parsed.command;
    const value = BigInt(tx.value);

    if (cmd.kind === 'buy') {
      const rect = { x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h };
      const problem = areaProblem(rect, limits, plots);
      if (problem) {
        reject(tx, problem);
        continue;
      }
      const price = limits.pricePerPixel * BigInt(rect.w * rect.h);
      if (value < price) {
        reject(tx, 'underpaid');
        continue;
      }
      const content = cmd.content ? (contents.get(cmd.content) ?? null) : null;
      ownPlots().push({
        ...rect,
        id: plotId(rect.x, rect.y),
        owner: tx.from,
        lt: tx.lt,
        hash: tx.hash,
        utime: tx.utime,
        paid: tx.value,
        content,
        contentHash: content ? cmd.content : null,
        hidden: false,
        updatedAt: tx.utime,
      });
      continue;
    }

    if (cmd.kind === 'update') {
      const index = plots.findIndex((p) => p.x === cmd.x && p.y === cmd.y);
      if (index < 0) {
        reject(tx, 'no_plot');
        continue;
      }
      const plot = plots[index];
      if (plot.owner !== tx.from) {
        reject(tx, 'not_owner');
        continue;
      }
      if (value < limits.editFee) {
        reject(tx, 'underpaid');
        continue;
      }
      const content = cmd.content ? (contents.get(cmd.content) ?? null) : null;
      if (cmd.content && !content) {
        // The hash points at nothing we stored: keep what the plot shows now.
        reject(tx, 'malformed');
        continue;
      }
      ownPlots()[index] = { ...plot, content, contentHash: content ? cmd.content : null, updatedAt: tx.utime };
      continue;
    }

    // Moderation: only from an admin address, silently ignored otherwise.
    if (!limits.admins.includes(tx.from)) continue;
    const target = plotAt(plots, cmd.x, cmd.y);
    if (!target) continue;
    const hidden = cmd.kind === 'hide';
    if (target.hidden === hidden) continue;
    const index = plots.indexOf(target);
    ownPlots()[index] = { ...target, hidden };
  }

  return {
    ...state,
    lastLt: lastLt.toString(),
    plots,
    rejected: rejected.length > MAX_REJECTED ? rejected.slice(-MAX_REJECTED) : rejected,
  };
}

/** True when applying transactions changed plots or the refund list, not just the cursor. */
export function mapChanged(before: MapState, after: MapState): boolean {
  return before.plots !== after.plots || before.rejected !== after.rejected;
}

export function emptyState(network: MapState['network'], treasury: string): MapState {
  return { v: 1, network, treasury, lastLt: '0', plots: [], rejected: [] };
}
