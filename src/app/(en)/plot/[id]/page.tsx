import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { PlotPage, plotMetadata } from '@/components/site/pages';
import { plotAt } from '@/lib/geometry';
import { plotPath } from '@/lib/seo-content';
import { getServerConfig, toPublicConfig } from '@/lib/server-config';
import { mapViewport } from '@/lib/site-metadata';
import { getState } from '@/lib/state';
import type { Plot, PublicConfig } from '@/lib/types';

/**
 * A plot's own address: the map opened on that plot, with the plot described in text for
 * crawlers, link previews and browsers without JavaScript. Pages are built on first request
 * and refreshed every minute.
 */
export const revalidate = 60;
export const dynamicParams = true;
export const viewport = mapViewport;

export function generateStaticParams() {
  return [];
}

interface Found {
  plot: Plot | null;
  config: PublicConfig;
}

const ID = /^(0|[1-9]\d{0,3})-(0|[1-9]\d{0,3})$/;

/** The plot covering the pixel in the address. Shared by the head tags and the page. */
const find = cache(async (id: string): Promise<Found> => {
  const config = toPublicConfig(getServerConfig());
  const m = ID.exec(id);
  if (!m) return { plot: null, config };
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (x >= config.gridW || y >= config.gridH) return { plot: null, config };

  // If the saved map cannot be read this throws, and that is right: "no such plot" must
  // never be answered, and cached, on a guess.
  let { state } = await getState(30_000);
  let plot = plotAt(state.plots, x, y);
  if (!plot) {
    // Perhaps bought seconds ago, and its owner is sharing the link already: look again.
    ({ state } = await getState(3_000));
    plot = plotAt(state.plots, x, y);
  }
  return { plot, config };
});

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { plot } = await find(id);
  // Anything else is settled by the page itself: a 404 or a redirect.
  return plot && plot.id === id ? plotMetadata(plot) : {};
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const { plot, config } = await find(id);
  if (!plot) notFound();
  // Any pixel of a plot leads to the plot; its top-left pixel is the address that counts.
  if (plot.id !== id) redirect(plotPath(plot.id));
  return <PlotPage plot={plot} config={config} />;
}
