// realtor.com adapter (ADR-0001 §3, ADR-0002). JSON-first via #__NEXT_DATA__,
// DOM fallback on the hero carousel, then toLargest() rewrites the CDN size
// token. Every path here is backed by fixtures/realtor/<id>/ captured by a
// human (ADR-0003 §4, ADR-0006 §5).
//
// CDN shape as observed 2026-09-18 (fixture M0000000001):
//   https://ap.rdcpix.com/<32 hex>l-m<digits>s.jpg            <- JSON href (small)
//   https://ap.rdcpix.com/<32 hex>l-m<digits>rd-w960_h720.webp <- DOM src
//   https://ap.rdcpix.com/<32 hex>l-m<digits>rd-w2048_h1536.jpg <- largest served
// The size token is what follows the photo id (`m<digits>`); ADR-0002's context
// paragraph guessed a `-w480_h360` suffix, which is the `rd-wW_hH` form here.
// Anything that does not match the observed shape passes through unchanged
// (ADR-0002 §3: never guess a URL the site did not give us).

import type { SiteAdapter, Listing, PhotoRef } from './types';

type Source = 'json' | 'dom' | 'none';

const LARGEST = 'rd-w2048_h1536.jpg';
const SIZE_TOKEN = /^(https:\/\/ap\.rdcpix\.com\/[0-9a-f]{32}l-m\d+)(?:s|rd-w\d+_h\d+)\.(?:jpe?g|webp)$/i;

function matches(url: string): boolean {
  return /^https:\/\/www\.realtor\.com\/realestateandhomes-detail\//.test(url);
}

export function toRealtorLargest(url: string): string {
  const m = SIZE_TOKEN.exec(url);
  return m ? `${m[1]}${LARGEST}` : url;
}

interface Address {
  line?: string;
  city?: string;
  state_code?: string;
}

interface PropertyDetails {
  property_id?: string | number;
  listing_id?: string | number;
  location?: { address?: Address };
  photos?: { href?: string }[];
}

interface NextData {
  props?: { pageProps?: { initialReduxState?: { propertyDetails?: PropertyDetails } } };
}

function readNextData(doc: Document): PropertyDetails | undefined {
  const el = doc.getElementById('__NEXT_DATA__');
  if (!el?.textContent) return undefined;
  try {
    const parsed = JSON.parse(el.textContent) as NextData;
    return parsed.props?.pageProps?.initialReduxState?.propertyDetails;
  } catch {
    return undefined;
  }
}

function dedupe(photos: PhotoRef[]): PhotoRef[] {
  const seen = new Set<string>();
  return photos.filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
}

function formatAddress(a?: Address): string {
  return [a?.line, a?.city, a?.state_code].filter(Boolean).join(', ');
}

function listingIdFromUrl(doc: Document): string {
  const m = /realestateandhomes-detail\/(?:.*_)?(M[\d-]+)/.exec(doc.location?.href ?? '');
  return m ? m[1].replace('-', '') : '';
}

function extract(doc: Document): Listing & { source: Source } {
  const base: Listing = { site: 'realtor', listingId: listingIdFromUrl(doc), address: '', photos: [] };

  // 1. JSON path (ADR-0002 §1): whole gallery, in gallery order, no scrolling.
  const pd = readNextData(doc);
  if (pd) {
    const photos = dedupe(
      (pd.photos ?? [])
        .map((p) => p.href)
        .filter((h): h is string => typeof h === 'string' && h.length > 0)
        .map((originalUrl) => ({ originalUrl, url: toRealtorLargest(originalUrl) })),
    );
    if (photos.length > 0) {
      return {
        ...base,
        listingId: pd.property_id != null ? String(pd.property_id) : base.listingId,
        address: formatAddress(pd.location?.address),
        photos,
        source: 'json',
      };
    }
  }

  // 2. DOM fallback (ADR-0002 §2): hero carousel slides only. Other rdcpix
  //    images on the page (saved-homes widget, similar listings) belong to
  //    other listings and are deliberately not selected.
  const nodes = doc.querySelectorAll<HTMLImageElement | HTMLSourceElement>(
    '[data-testid="photo-slide"] img, [data-testid="photo-slide"] source',
  );
  const domPhotos: PhotoRef[] = [];
  for (const node of nodes) {
    const src = node.getAttribute('src') ?? node.getAttribute('srcset')?.split(',')[0]?.trim().split(/\s+/)[0];
    if (src && /ap\.rdcpix\.com/.test(src)) domPhotos.push({ originalUrl: src, url: toRealtorLargest(src) });
  }
  const photos = dedupe(domPhotos);
  return { ...base, photos, source: photos.length > 0 ? 'dom' : 'none' };
}

export const realtorAdapter: SiteAdapter = { site: 'realtor', matches, extract };
