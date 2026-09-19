// Download flow, pure part (ADR-0001 §4, REQUIREMENTS F4/F5). No DOM, no
// chrome.* — the content script supplies `fetch` and does the saving, so this
// file is fully unit-testable with a fake fetch.

import { strToU8, zipSync } from 'fflate';
import type { Listing, PhotoRef } from './adapters/types';

export const CONCURRENCY = 4;
export const REPO_URL = 'https://github.com/jason-trentcyber/realtor-applet';
export const SITE_LABEL: Record<string, string> = { realtor: 'realtor.com', zillow: 'Zillow', homes: 'homes.com' };

/** F6 drift link: page URL and extension version only — never page content. */
export function driftIssueUrl(site: string, pageUrl: string, version: string): string {
  const title = `Layout changed on ${SITE_LABEL[site] ?? site}`;
  const body = `Page: ${pageUrl}\nExtension version: ${version}\n\nThe extension found 0 photos on this listing page.`;
  const params = new URLSearchParams({ title, body, labels: 'bug,adapter' });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}

export interface PhotoResult {
  index: number;
  originalUrl: string;
  /** URL actually fetched (largest rendition, or original if that failed). */
  finalUrl: string;
  status: number;
  bytes: number;
  data?: Uint8Array;
  error?: string;
}

export interface Manifest {
  sourceUrl: string;
  capturedAt: string;
  site: Listing['site'];
  listingId: string;
  address: string;
  extensionVersion: string;
  photoSource: 'json' | 'dom' | 'none';
  saved: number;
  total: number;
  photos: Omit<PhotoResult, 'data'>[];
}

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

export function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'listing';
}

export function zipName(listing: Pick<Listing, 'site' | 'listingId' | 'address'>): string {
  const id = listing.listingId || 'unknown';
  return `${slugify(listing.address)}_${listing.site}_${id}.zip`;
}

async function fetchOne(fetchFn: FetchLike, url: string): Promise<{ status: number; data?: Uint8Array; error?: string }> {
  try {
    const res = await fetchFn(url);
    if (!res.ok) return { status: res.status };
    const buf = await res.arrayBuffer();
    return { status: res.status, data: new Uint8Array(buf) };
  } catch (e) {
    return { status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Fetch every photo with bounded concurrency, in a fixed order. A failure is
 * recorded, never thrown (F5). If the upsized URL fails, the original URL the
 * page named is tried once — the size rule is derived from fixtures and a site
 * may serve a rendition the rule does not know about.
 */
export async function fetchAll(
  photos: PhotoRef[],
  fetchFn: FetchLike,
  onProgress?: (done: number, total: number) => void,
  concurrency = CONCURRENCY,
): Promise<PhotoResult[]> {
  const results: PhotoResult[] = new Array(photos.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < photos.length) {
      const i = next++;
      const p = photos[i];
      let finalUrl = p.url;
      let r = await fetchOne(fetchFn, finalUrl);
      if (!r.data && p.originalUrl !== p.url) {
        finalUrl = p.originalUrl;
        r = await fetchOne(fetchFn, finalUrl);
      }
      results[i] = {
        index: i,
        originalUrl: p.originalUrl,
        finalUrl,
        status: r.status,
        bytes: r.data?.byteLength ?? 0,
        data: r.data,
        error: r.error,
      };
      done++;
      onProgress?.(done, photos.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, photos.length) }, worker));
  return results;
}

function extensionFor(url: string): string {
  const m = /\.(jpe?g|png|webp|gif)(?:[?#]|$)/i.exec(url);
  const ext = m ? m[1].toLowerCase() : 'jpg';
  return ext === 'jpeg' ? 'jpg' : ext;
}

/** Zip entry name: 01.jpg … NN.jpg, width grows with the gallery size (F4). */
export function entryName(index: number, total: number, url: string): string {
  const width = Math.max(2, String(total).length);
  return `${String(index + 1).padStart(width, '0')}.${extensionFor(url)}`;
}

export function buildManifest(
  listing: Listing & { source: 'json' | 'dom' | 'none' },
  results: PhotoResult[],
  ctx: { sourceUrl: string; extensionVersion: string; now?: Date },
): Manifest {
  return {
    sourceUrl: ctx.sourceUrl,
    capturedAt: (ctx.now ?? new Date()).toISOString(),
    site: listing.site,
    listingId: listing.listingId,
    address: listing.address,
    extensionVersion: ctx.extensionVersion,
    photoSource: listing.source,
    saved: results.filter((r) => r.data).length,
    total: results.length,
    photos: results.map(({ data: _data, ...rest }) => rest),
  };
}

/** Photos are already compressed; store them (level 0) and only deflate the manifest. */
export function buildZip(results: PhotoResult[], manifest: Manifest): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const r of results) {
    if (r.data) entries[entryName(r.index, results.length, r.finalUrl)] = [r.data, { level: 0 }];
  }
  entries['listing.json'] = [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }];
  return zipSync(entries);
}
