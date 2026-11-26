import type { MapResponse, OrderRequest, OrderResponse, PlotContent, RejectedPayment } from './types';

/** Thrown with the server's error code ("taken", "rate_limited", …) so the interface can explain it. */
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError('offline', 0);
  }
  if (!res.ok) {
    let code = 'unavailable';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) code = body.error;
    } catch {
      /* keep the generic code */
    }
    throw new ApiError(code, res.status);
  }
  return (await res.json()) as T;
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const fetchMap = () => call<MapResponse>('/api/map');
export const syncMap = () => call<MapResponse>('/api/sync', { method: 'POST' });
export const createOrder = (order: OrderRequest) => call<OrderResponse>('/api/order', post(order));
export const saveDraft = (draft: {
  title: string;
  url: string;
  image: string | null;
  /** Reuse the picture the plot at these coordinates already shows. */
  keepImageOf?: { x: number; y: number };
}) =>
  call<{ hash: string; content: PlotContent }>('/api/drafts', post(draft));
export const fetchRejected = () => call<{ rejected: RejectedPayment[] }>('/api/rejected');
