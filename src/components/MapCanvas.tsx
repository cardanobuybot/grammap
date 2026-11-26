'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { plotAt, rectContains } from '@/lib/geometry';
import type { Plot, PublicConfig, Rect } from '@/lib/types';

export interface Cell {
  x: number;
  y: number;
}

/** Screen space hidden behind panels, in CSS pixels from the right and bottom edges. */
export interface Cover {
  right: number;
  bottom: number;
}

export interface MapHandle {
  /** Centres the view on an area, zooming so it is comfortably visible. */
  flyTo(target: Rect, cover?: Cover): void;
  /** Pans just enough to bring an area out from under the panels. Keeps the zoom. */
  reveal(target: Rect, cover?: Cover): void;
  zoomBy(factor: number): void;
  fitAll(): void;
  centerCell(): Cell;
}

interface Props {
  config: PublicConfig;
  plots: Plot[];
  /** Raw address of the connected wallet, to mark the visitor's own plots. */
  mine: string | null;
  mode: 'browse' | 'select';
  selection: Rect | null;
  selectionOk: boolean;
  activeId: string | null;
  probe: Cell | null;
  /** Screen space covered by panels, so "fly to" lands in the visible part. */
  obscured: Cover;
  plateSub: string;
  label: string;
  onTap(cell: Cell, plot: Plot | null): void;
  onSelectionChange(rect: Rect): void;
  onPointerCell(cell: Cell | null): void;
}

// Drawing colours. They mirror the tokens in globals.css.
const INK = '#071a38';
const SHEET = '#0e3371';
const CHALK = '234, 242, 255';
const FLAG = '255, 107, 44';
const ALERT = '255, 93, 115';
const DRAFT_FONT = '"Jura Variable", "Jura", system-ui, sans-serif';

const MAX_SCALE = 48;

interface View {
  cx: number;
  cy: number;
  scale: number;
}

type Gesture =
  | { type: 'pan'; id: number; sx: number; sy: number; cx: number; cy: number; moved: boolean; t0: number }
  | { type: 'draw'; id: number; anchor: Cell; moved: boolean }
  | { type: 'move'; id: number; from: Cell; rect: Rect }
  | { type: 'pinch'; dist: number; scale: number; wx: number; wy: number };

interface Loaded {
  img: HTMLImageElement;
  state: 'loading' | 'ready' | 'failed';
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const MapCanvas = forwardRef<MapHandle, Props>(function MapCanvas(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  const view = useRef<View>({ cx: 0, cy: 0, scale: 1 });
  const size = useRef({ w: 0, h: 0, dpr: 1, ready: false });
  const images = useRef(new Map<string, Loaded>());
  const raf = useRef(0);
  const anim = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);

  const minScale = useCallback(() => {
    const { gridW, gridH } = propsRef.current.config;
    const { w, h } = size.current;
    return Math.max(0.05, (Math.min(w, h) * 0.9) / Math.max(gridW, gridH));
  }, []);

  const draw = useCallback(() => {
    raf.current = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !size.current.ready) return;
    const p = propsRef.current;
    const { w: vw, h: vh, dpr } = size.current;
    const { cx, cy, scale } = view.current;
    const { gridW, gridH } = p.config;
    const X = (wx: number) => (wx - cx) * scale + vw / 2;
    const Y = (wy: number) => (wy - cy) * scale + vh / 2;
    const crisp = (v: number) => Math.round(v) + 0.5;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, vw, vh);

    // The sheet.
    const sx0 = X(0);
    const sy0 = Y(0);
    const sx1 = X(gridW);
    const sy1 = Y(gridH);
    ctx.fillStyle = SHEET;
    ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);

    // Visible range of the sheet, in pixels of the map.
    const wx0 = clamp(Math.floor(cx - vw / 2 / scale), 0, gridW);
    const wx1 = clamp(Math.ceil(cx + vw / 2 / scale), 0, gridW);
    const wy0 = clamp(Math.floor(cy - vh / 2 / scale), 0, gridH);
    const wy1 = clamp(Math.ceil(cy + vh / 2 / scale), 0, gridH);

    // Grid: every pixel when close, every 10 further out, every 100 always.
    const grid = (step: number, alpha: number) => {
      ctx.beginPath();
      for (let gx = Math.ceil(wx0 / step) * step; gx <= wx1; gx += step) {
        const px = crisp(X(gx));
        ctx.moveTo(px, Math.max(sy0, 0));
        ctx.lineTo(px, Math.min(sy1, vh));
      }
      for (let gy = Math.ceil(wy0 / step) * step; gy <= wy1; gy += step) {
        const py = crisp(Y(gy));
        ctx.moveTo(Math.max(sx0, 0), py);
        ctx.lineTo(Math.min(sx1, vw), py);
      }
      ctx.strokeStyle = `rgba(${CHALK}, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    if (scale >= 9) grid(1, 0.07);
    if (scale >= 1.4) grid(10, scale >= 9 ? 0.16 : 0.1);
    grid(100, 0.24);

    // Sheet border and the coordinates along its top and left edges.
    ctx.strokeStyle = `rgba(${CHALK}, 0.75)`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(crisp(sx0), crisp(sy0), Math.round(sx1 - sx0), Math.round(sy1 - sy0));
    if (scale * 100 >= 64) {
      ctx.font = `500 11px ${DRAFT_FONT}`;
      ctx.fillStyle = `rgba(${CHALK}, 0.6)`;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'center';
      for (let gx = Math.ceil(wx0 / 100) * 100; gx <= wx1; gx += 100) ctx.fillText(String(gx), X(gx), sy0 - 6);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      for (let gy = Math.ceil(wy0 / 100) * 100; gy <= wy1; gy += 100) ctx.fillText(String(gy), sx0 - 8, Y(gy));
    }

    // The title plate: the part of the sheet that names it.
    for (const z of p.config.reserved) {
      const zx = X(z.x);
      const zy = Y(z.y);
      const zw = z.w * scale;
      const zh = z.h * scale;
      if (zx > vw || zy > vh || zx + zw < 0 || zy + zh < 0) continue;
      ctx.fillStyle = INK;
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = `rgba(${CHALK}, 0.85)`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(crisp(zx), crisp(zy), Math.round(zw), Math.round(zh));
      const inset = Math.max(3, zh * 0.06);
      if (zh > 40) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${CHALK}, 0.35)`;
        ctx.strokeRect(crisp(zx + inset), crisp(zy + inset), Math.round(zw - inset * 2), Math.round(zh - inset * 2));
      }
      const titleSize = zh * 0.36;
      if (titleSize >= 7) {
        ctx.fillStyle = `rgba(${CHALK}, 0.96)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${titleSize}px ${DRAFT_FONT}`;
        const subSize = zh * 0.085;
        const showSub = subSize >= 9;
        ctx.fillText('GramMap', zx + zw / 2, zy + zh * (showSub ? 0.43 : 0.52));
        if (showSub) {
          ctx.font = `500 ${subSize}px ${DRAFT_FONT}`;
          ctx.fillStyle = `rgba(${CHALK}, 0.7)`;
          ctx.fillText(p.plateSub, zx + zw / 2, zy + zh * 0.76, zw - inset * 4);
        }
      }
    }

    // Plots.
    const wanted = new Set<string>();
    for (const plot of p.plots) {
      const px = X(plot.x);
      const py = Y(plot.y);
      const pw = plot.w * scale;
      const ph = plot.h * scale;
      if (px > vw || py > vh || px + pw < 0 || py + ph < 0) continue;
      const own = p.mine !== null && plot.owner === p.mine;
      const url = !plot.hidden ? plot.content?.image : null;
      let painted = false;
      if (url && pw >= 3 && ph >= 3) {
        wanted.add(url);
        const entry = images.current.get(url);
        if (entry?.state === 'ready') {
          // Smooth when shrinking a picture, crisp pixels when magnifying it.
          ctx.imageSmoothingEnabled = pw < entry.img.naturalWidth;
          ctx.drawImage(entry.img, px, py, pw, ph);
          painted = true;
        }
      }
      if (!painted) {
        ctx.fillStyle = own ? `rgba(${FLAG}, 0.42)` : `rgba(${CHALK}, 0.2)`;
        ctx.fillRect(px, py, Math.max(pw, 1), Math.max(ph, 1));
      }
      if (pw >= 5 && ph >= 5) {
        ctx.strokeStyle = own ? `rgba(${FLAG}, 0.95)` : `rgba(${CHALK}, 0.4)`;
        ctx.lineWidth = own ? 1.5 : 1;
        ctx.strokeRect(crisp(px), crisp(py), Math.round(pw) - 1, Math.round(ph) - 1);
      }
    }
    for (const url of wanted) {
      if (images.current.has(url)) continue;
      const img = new Image();
      const entry: Loaded = { img, state: 'loading' };
      images.current.set(url, entry);
      img.decoding = 'async';
      img.onload = () => {
        entry.state = 'ready';
        if (!raf.current) raf.current = requestAnimationFrame(draw);
      };
      img.onerror = () => {
        entry.state = 'failed';
      };
      img.src = url;
    }

    // A free pixel the visitor tapped.
    if (p.probe && p.mode === 'browse') {
      const s = Math.max(scale, 6);
      const px = X(p.probe.x + 0.5) - s / 2;
      const py = Y(p.probe.y + 0.5) - s / 2;
      ctx.strokeStyle = `rgba(${CHALK}, 0.95)`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(crisp(px), crisp(py), Math.round(s), Math.round(s));
      // Cross-hair ticks, the way a surveyor marks a point.
      ctx.beginPath();
      const mx = X(p.probe.x + 0.5);
      const my = Y(p.probe.y + 0.5);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        ctx.moveTo(crisp(mx + dx * (s / 2 + 4)), crisp(my + dy * (s / 2 + 4)));
        ctx.lineTo(crisp(mx + dx * (s / 2 + 12)), crisp(my + dy * (s / 2 + 12)));
      }
      ctx.stroke();
    }

    // The plot whose card is open.
    const active = p.activeId ? p.plots.find((q) => q.id === p.activeId) : null;
    if (active) {
      const pad = 3;
      ctx.strokeStyle = `rgba(${CHALK}, 1)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        crisp(X(active.x) - pad),
        crisp(Y(active.y) - pad),
        Math.round(active.w * scale + pad * 2),
        Math.round(active.h * scale + pad * 2),
      );
    }

    // The area being bought, with drafting dimension lines.
    if (p.selection && p.mode === 'select') {
      const r = p.selection;
      const colour = p.selectionOk ? FLAG : ALERT;
      const rx = X(r.x);
      const ry = Y(r.y);
      const rw = r.w * scale;
      const rh = r.h * scale;
      ctx.fillStyle = `rgba(${colour}, 0.2)`;
      ctx.fillRect(rx, ry, rw, rh);
      if (!p.selectionOk && rw > 8 && rh > 8) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.clip();
        ctx.beginPath();
        for (let d = -rh; d < rw; d += 8) {
          ctx.moveTo(rx + d, ry + rh);
          ctx.lineTo(rx + d + rh, ry);
        }
        ctx.strokeStyle = `rgba(${colour}, 0.55)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = `rgba(${colour}, 1)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(crisp(rx), crisp(ry), Math.round(rw), Math.round(rh));

      ctx.font = `700 12px ${DRAFT_FONT}`;
      ctx.lineWidth = 1;
      const tag = (text: string, tx: number, ty: number) => {
        const tw = ctx.measureText(text).width + 10;
        ctx.fillStyle = INK;
        ctx.fillRect(tx - tw / 2, ty - 9, tw, 18);
        ctx.fillStyle = `rgba(${colour}, 1)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, tx, ty + 0.5);
      };
      const tick = (tx: number, ty: number) => {
        // Slanted end marks, as on an architectural drawing.
        ctx.moveTo(tx - 4, ty + 4);
        ctx.lineTo(tx + 4, ty - 4);
      };
      if (rw >= 56 && rh >= 30) {
        const above = ry - 16 > 70 ? ry - 16 : ry + rh + 16;
        const beside = rx - 16 > 30 ? rx - 16 : rx + rw + 16;
        ctx.beginPath();
        ctx.moveTo(rx, crisp(above));
        ctx.lineTo(rx + rw, crisp(above));
        tick(rx, above);
        tick(rx + rw, above);
        ctx.moveTo(crisp(beside), ry);
        ctx.lineTo(crisp(beside), ry + rh);
        tick(beside, ry);
        tick(beside, ry + rh);
        ctx.strokeStyle = `rgba(${colour}, 0.9)`;
        ctx.stroke();
        tag(`${r.w} px`, rx + rw / 2, above);
        ctx.save();
        ctx.translate(beside, ry + rh / 2);
        ctx.rotate(-Math.PI / 2);
        tag(`${r.h} px`, 0, 0);
        ctx.restore();
      } else {
        tag(`${r.w} × ${r.h}`, rx + rw / 2, ry + rh + 16);
      }
    }
  }, []);

  const requestDraw = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(draw);
  }, [draw]);

  const setView = useCallback(
    (next: Partial<View>) => {
      const { gridW, gridH } = propsRef.current.config;
      const v = view.current;
      v.scale = clamp(next.scale ?? v.scale, minScale(), MAX_SCALE);
      v.cx = clamp(next.cx ?? v.cx, 0, gridW);
      v.cy = clamp(next.cy ?? v.cy, 0, gridH);
      requestDraw();
    },
    [minScale, requestDraw],
  );

  const animateTo = useCallback(
    (target: View) => {
      cancelAnimationFrame(anim.current);
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        setView(target);
        return;
      }
      const from = { ...view.current };
      const t0 = performance.now();
      const step = (now: number) => {
        const k = clamp((now - t0) / 420, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        setView({
          cx: from.cx + (target.cx - from.cx) * e,
          cy: from.cy + (target.cy - from.cy) * e,
          // Zoom is interpolated geometrically so it feels even at every level.
          scale: from.scale * Math.pow(target.scale / from.scale, e),
        });
        if (k < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [setView],
  );

  const cellAt = useCallback((clientX: number, clientY: number): Cell => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { cx, cy, scale } = view.current;
    return {
      x: Math.floor((clientX - rect.left - size.current.w / 2) / scale + cx),
      y: Math.floor((clientY - rect.top - size.current.h / 2) / scale + cy),
    };
  }, []);

  const inSheet = useCallback((c: Cell) => {
    const { gridW, gridH } = propsRef.current.config;
    return c.x >= 0 && c.y >= 0 && c.x < gridW && c.y < gridH;
  }, []);

  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      const v = view.current;
      const { w, h } = size.current;
      const wx = (px - w / 2) / v.scale + v.cx;
      const wy = (py - h / 2) / v.scale + v.cy;
      const scale = clamp(v.scale * factor, minScale(), MAX_SCALE);
      setView({ scale, cx: wx - (px - w / 2) / scale, cy: wy - (py - h / 2) / scale });
    },
    [minScale, setView],
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo(target, cover) {
        const { w, h } = size.current;
        const { right, bottom } = cover ?? propsRef.current.obscured;
        const freeW = Math.max(120, w - right);
        const freeH = Math.max(120, h - bottom);
        const scale = clamp(Math.min((freeW * 0.5) / target.w, (freeH * 0.4) / target.h), Math.max(3, minScale()), 28);
        animateTo({
          scale,
          // Shift the centre so the target sits in the middle of the uncovered part.
          cx: target.x + target.w / 2 + right / 2 / scale,
          cy: target.y + target.h / 2 + bottom / 2 / scale,
        });
      },
      reveal(target, cover) {
        const { w, h } = size.current;
        const { right, bottom } = cover ?? propsRef.current.obscured;
        const v = view.current;
        const free = { l: 20, r: w - right - 20, t: 76, b: h - bottom - 20 };
        const x0 = (target.x - v.cx) * v.scale + w / 2;
        const y0 = (target.y - v.cy) * v.scale + h / 2;
        const x1 = x0 + target.w * v.scale;
        const y1 = y0 + target.h * v.scale;
        // Too big to fit: centre it. Otherwise move only as far as needed.
        const shift = (a0: number, a1: number, lo: number, hi: number) =>
          a1 - a0 > hi - lo ? (a0 + a1) / 2 - (lo + hi) / 2 : a0 < lo ? a0 - lo : a1 > hi ? a1 - hi : 0;
        const dx = shift(x0, x1, free.l, free.r);
        const dy = shift(y0, y1, free.t, free.b);
        if (dx || dy) animateTo({ scale: v.scale, cx: v.cx + dx / v.scale, cy: v.cy + dy / v.scale });
      },
      zoomBy(factor) {
        const v = view.current;
        animateTo({ ...v, scale: clamp(v.scale * factor, minScale(), MAX_SCALE) });
      },
      fitAll() {
        const { gridW, gridH } = propsRef.current.config;
        animateTo({ cx: gridW / 2, cy: gridH / 2, scale: minScale() });
      },
      centerCell() {
        return { x: Math.floor(view.current.cx), y: Math.floor(view.current.cy) };
      },
    }),
    [animateTo, minScale],
  );

  // Keep the latest props for the drawing code and repaint after every render.
  useEffect(() => {
    propsRef.current = props;
    requestDraw();
  });

  // Size the canvas to its box and choose the opening view.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const first = !size.current.ready;
      size.current = { w: box.width, h: box.height, dpr, ready: box.width > 0 && box.height > 0 };
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      if (first && size.current.ready) {
        const { gridW, gridH } = propsRef.current.config;
        view.current = {
          cx: gridW / 2,
          cy: gridH / 2,
          scale: clamp(Math.min(box.width / 150, 6), minScale(), MAX_SCALE),
        };
      } else {
        setView({});
      }
      requestDraw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    document.fonts?.ready.then(requestDraw).catch(() => {});
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(anim.current);
      raf.current = 0;
    };
  }, [minScale, requestDraw, setView]);

  // Pointer, wheel and keyboard input.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const clampCell = (c: Cell): Cell => {
      const { gridW, gridH } = propsRef.current.config;
      return { x: clamp(c.x, 0, gridW - 1), y: clamp(c.y, 0, gridH - 1) };
    };

    const startPinch = () => {
      const [a, b] = [...pointers.current.values()];
      const v = view.current;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      gesture.current = {
        type: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale: v.scale,
        wx: (mx - size.current.w / 2) / v.scale + v.cx,
        wy: (my - size.current.h / 2) / v.scale + v.cy,
      };
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancelAnimationFrame(anim.current);
      canvas.setPointerCapture(e.pointerId);
      const pt = local(e);
      pointers.current.set(e.pointerId, pt);
      if (pointers.current.size === 2) {
        startPinch();
        return;
      }
      if (pointers.current.size > 2) return;
      const p = propsRef.current;
      const cell = cellAt(e.clientX, e.clientY);
      if (p.mode === 'select') {
        if (p.selection && rectContains(p.selection, cell.x, cell.y)) {
          gesture.current = { type: 'move', id: e.pointerId, from: cell, rect: p.selection };
        } else {
          gesture.current = { type: 'draw', id: e.pointerId, anchor: clampCell(cell), moved: false };
        }
        return;
      }
      gesture.current = {
        type: 'pan',
        id: e.pointerId,
        sx: pt.x,
        sy: pt.y,
        cx: view.current.cx,
        cy: view.current.cy,
        moved: false,
        t0: performance.now(),
      };
    };

    const onMove = (e: PointerEvent) => {
      const p = propsRef.current;
      const pt = local(e);
      if (!pointers.current.has(e.pointerId)) {
        if (e.pointerType === 'mouse') {
          const cell = cellAt(e.clientX, e.clientY);
          p.onPointerCell(inSheet(cell) ? cell : null);
        }
        return;
      }
      pointers.current.set(e.pointerId, pt);
      const g = gesture.current;
      if (!g) return;

      if (g.type === 'pinch') {
        if (pointers.current.size < 2) return;
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const scale = clamp((g.scale * dist) / g.dist, minScale(), MAX_SCALE);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        // Keep the map point under the fingers where it was: this also pans.
        setView({ scale, cx: g.wx - (mx - size.current.w / 2) / scale, cy: g.wy - (my - size.current.h / 2) / scale });
        return;
      }
      if (g.id !== e.pointerId) return;

      if (g.type === 'pan') {
        const dx = pt.x - g.sx;
        const dy = pt.y - g.sy;
        if (!g.moved && Math.hypot(dx, dy) > 6) g.moved = true;
        if (g.moved) setView({ cx: g.cx - dx / view.current.scale, cy: g.cy - dy / view.current.scale });
        return;
      }

      const cell = clampCell(cellAt(e.clientX, e.clientY));
      const { gridW, gridH, maxSide } = p.config;
      if (g.type === 'draw') {
        if (cell.x !== g.anchor.x || cell.y !== g.anchor.y) g.moved = true;
        const w = Math.min(Math.abs(cell.x - g.anchor.x) + 1, maxSide);
        const h = Math.min(Math.abs(cell.y - g.anchor.y) + 1, maxSide);
        p.onSelectionChange({
          x: cell.x >= g.anchor.x ? g.anchor.x : g.anchor.x - w + 1,
          y: cell.y >= g.anchor.y ? g.anchor.y : g.anchor.y - h + 1,
          w,
          h,
        });
        return;
      }
      // Moving the whole selection.
      p.onSelectionChange({
        ...g.rect,
        x: clamp(g.rect.x + cell.x - g.from.x, 0, gridW - g.rect.w),
        y: clamp(g.rect.y + cell.y - g.from.y, 0, gridH - g.rect.h),
      });
    };

    const onUp = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.delete(e.pointerId);
      const g = gesture.current;
      const p = propsRef.current;
      if (g?.type === 'pinch') {
        // One finger left: carry on as a pan from where it is, without a jump.
        const rest = [...pointers.current.entries()][0];
        gesture.current = rest
          ? {
              type: 'pan',
              id: rest[0],
              sx: rest[1].x,
              sy: rest[1].y,
              cx: view.current.cx,
              cy: view.current.cy,
              moved: true,
              t0: 0,
            }
          : null;
        return;
      }
      if (!g || g.id !== e.pointerId) return;
      gesture.current = null;
      if (e.type === 'pointercancel') return;
      if (g.type === 'pan' && !g.moved && performance.now() - g.t0 < 600) {
        const cell = cellAt(e.clientX, e.clientY);
        if (inSheet(cell)) p.onTap(cell, plotAt(p.plots, cell.x, cell.y));
      } else if (g.type === 'draw' && !g.moved) {
        p.onSelectionChange({ x: g.anchor.x, y: g.anchor.y, w: 1, h: 1 });
      }
    };

    const onLeave = () => propsRef.current.onPointerCell(null);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const pt = local(e);
      const unit = e.deltaMode === 1 ? 16 : 1;
      zoomAt(Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0018)), pt.x, pt.y);
    };

    const onDouble = (e: MouseEvent) => {
      if (propsRef.current.mode === 'select') return;
      const pt = local(e);
      zoomAt(2, pt.x, pt.y);
    };

    const onKey = (e: KeyboardEvent) => {
      const v = view.current;
      const stride = 60 / v.scale;
      if (e.key === 'ArrowLeft') setView({ cx: v.cx - stride });
      else if (e.key === 'ArrowRight') setView({ cx: v.cx + stride });
      else if (e.key === 'ArrowUp') setView({ cy: v.cy - stride });
      else if (e.key === 'ArrowDown') setView({ cy: v.cy + stride });
      else if (e.key === '+' || e.key === '=') zoomAt(1.4, size.current.w / 2, size.current.h / 2);
      else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.4, size.current.w / 2, size.current.h / 2);
      else if (e.key === 'Enter') {
        const cell = { x: Math.floor(v.cx), y: Math.floor(v.cy) };
        const p = propsRef.current;
        if (inSheet(cell)) p.onTap(cell, plotAt(p.plots, cell.x, cell.y));
      } else return;
      e.preventDefault();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDouble);
    canvas.addEventListener('keydown', onKey);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDouble);
      canvas.removeEventListener('keydown', onKey);
    };
  }, [cellAt, inSheet, minScale, setView, zoomAt]);

  return (
    <canvas
      ref={canvasRef}
      className={`map ${props.mode === 'select' ? 'map--select' : ''}`}
      tabIndex={0}
      role="application"
      aria-label={props.label}
    />
  );
});
