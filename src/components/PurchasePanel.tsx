'use client';

import { CHAIN, UserRejectsError, useTonConnectUI } from '@tonconnect/ui-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, createOrder, fetchRejected, saveDraft, syncMap } from '@/lib/client-api';
import { formatGrams } from '@/lib/format';
import { useI18n, type I18nKey } from '@/lib/i18n';
import { ImageError, preparePlotImage } from '@/lib/image';
import type { MapResponse, OrderResponse, Plot, PublicConfig, Rect, RejectReason } from '@/lib/types';
import { IconCheck } from './icons';
import { Sheet } from './Sheet';

type Picture = { kind: 'none' } | { kind: 'new'; dataUrl: string } | { kind: 'keep'; url: string };

type Step =
  | { name: 'form' }
  | { name: 'preparing' }
  | { name: 'wallet' }
  | { name: 'confirming' }
  | { name: 'done' }
  | { name: 'slow' }
  | { name: 'rejected'; reason: RejectReason };

interface Props {
  kind: 'buy' | 'edit';
  /** The area being bought, or the plot being changed. */
  rect: Rect;
  plot?: Plot;
  config: PublicConfig;
  /** Raw address of the connected wallet. */
  mine: string | null;
  onMap(data: MapResponse): void;
  /** The payment is confirmed on the map. */
  onApplied?(): void;
  onShow(plotId: string): void;
  onClose(): void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PurchasePanel({ kind, rect, plot, config, mine, onMap, onApplied, onShow, onClose }: Props) {
  const { t } = useI18n();
  const [tonConnectUI] = useTonConnectUI();
  const current = kind === 'edit' && plot && !plot.hidden ? plot.content : null;

  const [title, setTitle] = useState(current?.title ?? '');
  const [url, setUrl] = useState(current?.url ?? '');
  const [picture, setPicture] = useState<Picture>(current?.image ? { kind: 'keep', url: current.image } : { kind: 'none' });
  const [pictureBusy, setPictureBusy] = useState(false);
  const [step, setStep] = useState<Step>({ name: 'form' });
  const [problem, setProblem] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const amount = kind === 'buy' ? BigInt(config.pricePerPixel) * BigInt(rect.w * rect.h) : BigInt(config.editFee);
  const amountText = formatGrams(amount);
  const fee = formatGrams(config.editFee);
  const ratio = Math.min(3, Math.max(1 / 3, rect.w / rect.h));
  const plotId = `${rect.x}-${rect.y}`;

  const explain = (code: string) => {
    const key = `error.${code}` as I18nKey;
    const text = t(key);
    if (text !== key) return text;
    const area = t(`problem.${code}` as I18nKey, { side: config.maxSide, area: config.maxArea });
    return area !== `problem.${code}` ? area : t('error.unavailable');
  };

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProblem(null);
    setPictureBusy(true);
    try {
      const dataUrl = await preparePlotImage(file, rect.w, rect.h);
      if (alive.current) setPicture({ kind: 'new', dataUrl });
    } catch (err) {
      if (alive.current) {
        setProblem(t(err instanceof ImageError && err.message === 'too_large' ? 'error.image_too_large' : 'error.image_invalid'));
      }
    } finally {
      if (alive.current) setPictureBusy(false);
    }
  };

  /** Watches the chain until the payment shows up on the map (or on the refund list). */
  const waitForChain = async (order: OrderResponse, hash: string | null) => {
    const startedAt = Math.floor(Date.now() / 1000);
    const applied = (data: MapResponse) =>
      data.plots.some((p) => {
        if (p.x !== rect.x || p.y !== rect.y || p.owner !== mine) return false;
        if (kind === 'buy') return p.w === rect.w && p.h === rect.h;
        return p.contentHash === hash && p.updatedAt >= startedAt - 300;
      });

    for (let i = 0; i < 45; i++) {
      await sleep(i < 3 ? 2500 : 4000);
      if (!alive.current) return;
      try {
        const data = await syncMap();
        if (!alive.current) return;
        onMap(data);
        if (applied(data)) {
          setStep({ name: 'done' });
          onApplied?.();
          return;
        }
        if (i % 3 === 2) {
          const { rejected } = await fetchRejected();
          const hit = rejected.find((r) => r.from === mine && r.comment === order.comment && r.utime >= startedAt - 300);
          if (hit && alive.current) {
            setStep({ name: 'rejected', reason: hit.reason });
            return;
          }
        }
      } catch {
        /* a failed poll is not a failed payment: keep waiting */
      }
    }
    if (alive.current) setStep({ name: 'slow' });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (!mine) {
      await tonConnectUI.openModal();
      return;
    }
    const empty = !title.trim() && !url.trim() && picture.kind === 'none';

    setStep({ name: 'preparing' });
    let order: OrderResponse;
    let hash: string | null = null;
    try {
      if (!empty) {
        const draft = await saveDraft({
          title,
          url,
          image: picture.kind === 'new' ? picture.dataUrl : null,
          keepImageOf: picture.kind === 'keep' ? { x: rect.x, y: rect.y } : undefined,
        });
        hash = draft.hash;
      }
      if (kind === 'edit' && hash === (plot?.contentHash ?? null)) {
        setStep({ name: 'form' });
        setProblem(t('form.same'));
        return;
      }
      order = await createOrder(
        kind === 'buy'
          ? { kind: 'buy', x: rect.x, y: rect.y, w: rect.w, h: rect.h, content: hash }
          : { kind: 'update', x: rect.x, y: rect.y, content: hash },
      );
    } catch (err) {
      if (!alive.current) return;
      setStep({ name: 'form' });
      setProblem(explain(err instanceof ApiError ? err.code : 'unavailable'));
      return;
    }
    if (!alive.current) return;

    setStep({ name: 'wallet' });
    try {
      await tonConnectUI.sendTransaction({
        validUntil: order.validUntil,
        network: order.network === 'testnet' ? CHAIN.TESTNET : CHAIN.MAINNET,
        messages: [{ address: order.to, amount: order.amount, payload: order.payload }],
      });
    } catch (err) {
      if (!alive.current) return;
      setStep({ name: 'form' });
      if (err instanceof UserRejectsError) setProblem(t('pay.cancelled'));
      else if (err instanceof Error && /network/i.test(`${err.name} ${err.message}`)) {
        setProblem(t('pay.error.network', { network: config.network }));
      } else setProblem(t('pay.error.generic'));
      return;
    }
    if (!alive.current) return;

    setStep({ name: 'confirming' });
    await waitForChain(order, hash);
  };

  const heading = kind === 'buy' ? t('form.buyTitle', { w: rect.w, h: rect.h }) : t('form.editTitle');

  if (step.name !== 'form') {
    const waiting = step.name === 'preparing' || step.name === 'wallet' || step.name === 'confirming';
    return (
      <Sheet title={heading} onClose={onClose}>
        <div className="status" role="status" aria-live="polite">
          {waiting ? <span className="spinner" aria-hidden /> : null}
          {step.name === 'done' ? (
            <span className="status__ok" aria-hidden>
              <IconCheck width={28} height={28} />
            </span>
          ) : null}
          <p className="status__text">
            {step.name === 'preparing' && t('pay.preparing')}
            {step.name === 'wallet' && t('pay.wallet')}
            {step.name === 'confirming' && t('pay.confirming')}
            {step.name === 'done' && t(kind === 'buy' ? 'pay.done.buy' : 'pay.done.edit')}
            {step.name === 'slow' && t('pay.slow')}
            {step.name === 'rejected' &&
              (step.reason === 'taken'
                ? t('pay.rejected.taken')
                : t('pay.rejected.other', { reason: t(`reason.${step.reason}` as I18nKey) }))}
          </p>
          {step.name === 'done' ? (
            <button type="button" className="btn btn--primary btn--block" onClick={() => onShow(plotId)}>
              {t('pay.show')}
            </button>
          ) : null}
          {step.name === 'slow' || step.name === 'rejected' ? (
            <button type="button" className="btn btn--block" onClick={onClose}>
              {t('pay.close')}
            </button>
          ) : null}
        </div>
      </Sheet>
    );
  }

  const preview = picture.kind === 'new' ? picture.dataUrl : picture.kind === 'keep' ? picture.url : null;

  return (
    <Sheet title={heading} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <span className="field__label">{t('form.image')}</span>
          <div
            className={`picker ${preview ? 'picker--filled' : ''}`}
            style={{ aspectRatio: String(ratio), width: `min(100%, ${Math.round(160 * ratio)}px)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen picture */}
            {preview ? <img src={preview} alt="" /> : null}
            {pictureBusy ? <span className="spinner" aria-hidden /> : null}
          </div>
          <div className="row">
            <label className="btn btn--small">
              {preview ? t('form.imageReplace') : t('form.imagePick')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="visually-hidden"
                onChange={pick}
                disabled={pictureBusy}
              />
            </label>
            {preview ? (
              <button type="button" className="btn btn--small btn--quiet" onClick={() => setPicture({ kind: 'none' })}>
                {t('form.imageRemove')}
              </button>
            ) : null}
          </div>
          <span className="field__hint">{t('form.imageHint')}</span>
        </div>

        <label className="field">
          <span className="field__label">{t('form.title')}</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder={t('form.titlePh')}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field__label">{t('form.link')}</span>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={200}
            placeholder="https://"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="field__hint">{t('form.linkHint')}</span>
        </label>

        <p className="note">{kind === 'buy' ? t('form.later', { fee }) : t('form.clear')}</p>

        <div className="total">
          <span>{t('form.total')}</span>
          <strong>{amountText} GRAM</strong>
        </div>

        {problem ? (
          <p className="alert" role="alert">
            {problem}
          </p>
        ) : null}

        <button type="submit" className="btn btn--primary btn--block" disabled={pictureBusy}>
          {!mine
            ? t('form.connectFirst')
            : kind === 'buy'
              ? t('form.pay', { price: amountText })
              : t('form.payEdit', { fee: amountText })}
        </button>
        <p className="fine">{t('form.rules')}</p>
      </form>
    </Sheet>
  );
}
