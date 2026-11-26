import type { Plot, Rect } from './types';

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function rectInBounds(r: Rect, gridW: number, gridH: number): boolean {
  return (
    Number.isInteger(r.x) &&
    Number.isInteger(r.y) &&
    Number.isInteger(r.w) &&
    Number.isInteger(r.h) &&
    r.w >= 1 &&
    r.h >= 1 &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.x + r.w <= gridW &&
    r.y + r.h <= gridH
  );
}

export function rectArea(r: Rect): number {
  return r.w * r.h;
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

export function plotAt<T extends Rect>(plots: readonly T[], x: number, y: number): T | null {
  for (const p of plots) {
    if (rectContains(p, x, y)) return p;
  }
  return null;
}

export function plotId(x: number, y: number): string {
  return `${x}-${y}`;
}

export type AreaProblem = 'out_of_bounds' | 'too_large' | 'reserved' | 'taken';

export interface AreaLimits {
  gridW: number;
  gridH: number;
  maxSide: number;
  maxArea: number;
  reserved: readonly Rect[];
}

/** Why an area cannot be bought, or null when it is free. Shared by the server and the map. */
export function areaProblem(
  r: Rect,
  limits: AreaLimits,
  plots: readonly Pick<Plot, 'x' | 'y' | 'w' | 'h'>[],
): AreaProblem | null {
  if (!rectInBounds(r, limits.gridW, limits.gridH)) return 'out_of_bounds';
  if (r.w > limits.maxSide || r.h > limits.maxSide || rectArea(r) > limits.maxArea) return 'too_large';
  for (const z of limits.reserved) {
    if (rectsOverlap(r, z)) return 'reserved';
  }
  for (const p of plots) {
    if (rectsOverlap(r, p)) return 'taken';
  }
  return null;
}
