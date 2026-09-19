// Zillow adapter (ADR-0001 §3, ADR-0002). JSON-first via #__NEXT_DATA__ ->
// props.pageProps.componentProps.gdpClientCache (a JSON *string*) ->
// <query key>.property.responsivePhotos[]. Each photo lists every rendition
// with its width in mixedSources.jpeg, so "largest" is the widest URL the page
// itself names — no size-token rewriting (ADR-0002 §3: never guess a URL).
// DOM fallback: [data-testid="hollywood-gallery-images-tile-list"] images on
// photos.zillowstatic.com/fp/ (3D-tour posters on www.zillowstatic.com are not
// photos). Fixture: fixtures/zillow/Z1000000001/, human-captured.
//
// Observed 2026-09-19: the address-bar zpid and the cache entry's zpid can
// differ (Zillow re-listing/redirect); the cache had exactly one property
// entry. Prefer the entry matching the URL zpid, else the one with photos, and
// report the property's own zpid as listingId.

import type { SiteAdapter, Listing, PhotoRef } from './types';

type Source = 'json' | 'dom' | 'none';

const PHOTO_HOST = /^https:\/\/photos\.zillowstatic\.com\/fp\//;

function matches(url: string): boolean {
  return /^https:\/\/www\.zillow\.com\/homedetails\//.test(url);
}

interface Rendition {
  url?: string;
  width?: number;
}
interface ResponsivePhoto {
  url?: string;
  mixedSources?: { jpeg?: Rendition[]; webp?: Rendition[] };
}
interface ZillowProperty {
  zpid?: number | string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  responsivePhotos?: ResponsivePhoto[];
}

/** Widest JPEG rendition the page lists; falls back to the photo's own url. */
export function largestZillowUrl(photo: ResponsivePhoto): string | undefined {
  const jpeg = (photo.mixedSources?.jpeg ?? []).filter((r): r is Required<Rendition> => typeof r.url === 'string' && typeof r.width === 'number');
  if (jpeg.length > 0) return jpeg.reduce((a, b) => (b.width > a.width ? b : a)).url;
  return photo.url;
}

/** For DOM srcset: the candidate with the largest `Nw` descriptor. */
export function largestFromSrcset(srcset: string): { url: string; w: number } | undefined {
  let best: { url: string; w: number } | undefined;
  for (const part of srcset.split(',')) {
    const [url, desc] = part.trim().split(/\s+/);
    if (!url) continue;
    const w = desc && /^\d+w$/.test(desc) ? parseInt(desc, 10) : 0;
    if (!best || w > best.w) best = { url, w };
  }
  return best;
}

/** Width encoded in a Zillow rendition name (`-cc_ft_960.jpg`), 0 if none. */
function widthFromUrl(url: string): number {
  return parseInt(/_(\d+)\.[a-z]+(?:[?#]|$)/i.exec(url)?.[1] ?? '0', 10);
}

function readProperties(doc: Document): ZillowProperty[] {
  const el = doc.getElementById('__NEXT_DATA__');
  if (!el?.textContent) return [];
  try {
    const nd = JSON.parse(el.textContent) as { props?: { pageProps?: { componentProps?: { gdpClientCache?: string } } } };
    const raw = nd.props?.pageProps?.componentProps?.gdpClientCache;
    if (typeof raw !== 'string') return [];
    const cache = JSON.parse(raw) as Record<string, { property?: ZillowProperty }>;
    return Object.values(cache)
      .map((v) => v?.property)
      .filter((p): p is ZillowProperty => !!p && typeof p === 'object');
  } catch {
    return [];
  }
}

function zpidFromUrl(href: string): string {
  return /(\d+)_zpid/.exec(href)?.[1] ?? '';
}

function dedupe(photos: PhotoRef[]): PhotoRef[] {
  const seen = new Set<string>();
  return photos.filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
}

function extract(doc: Document): Listing & { source: Source } {
  const urlZpid = zpidFromUrl(doc.location?.href ?? '');
  const base: Listing = { site: 'zillow', listingId: urlZpid, address: '', photos: [] };

  // 1. JSON path (ADR-0002 §1).
  const props = readProperties(doc);
  const prop = props.find((p) => String(p.zpid) === urlZpid && p.responsivePhotos?.length) ?? props.find((p) => p.responsivePhotos?.length);
  if (prop) {
    const photos = dedupe(
      (prop.responsivePhotos ?? [])
        .map((ph) => ({ originalUrl: ph.url, url: largestZillowUrl(ph) }))
        .filter((p): p is PhotoRef => typeof p.originalUrl === 'string' && typeof p.url === 'string'),
    );
    if (photos.length > 0) {
      return {
        ...base,
        listingId: prop.zpid != null ? String(prop.zpid) : urlZpid,
        address: [prop.streetAddress, prop.city, prop.state].filter(Boolean).join(', '),
        photos,
        source: 'json',
      };
    }
  }

  // 2. DOM fallback (ADR-0002 §2): gallery tile list only, listing-photo host only.
  //    A tile carries the same photo as <source type=jpeg srcset> (all widths)
  //    and <img src> (one width); key by photo hash and keep the widest.
  const nodes = doc.querySelectorAll<HTMLImageElement | HTMLSourceElement>(
    '[data-testid="hollywood-gallery-images-tile-list"] img, [data-testid="hollywood-gallery-images-tile-list"] source',
  );
  const byHash = new Map<string, { originalUrl: string; url: string; w: number }>();
  for (const node of nodes) {
    const srcset = node.getAttribute('srcset');
    const src = node.getAttribute('src');
    const original = src && PHOTO_HOST.test(src) ? src : srcset ? srcset.split(',')[0]?.trim().split(/\s+/)[0] : undefined;
    if (!original || !PHOTO_HOST.test(original)) continue;
    const best = srcset ? largestFromSrcset(srcset) : undefined;
    const url = best?.url ?? original;
    if (!PHOTO_HOST.test(url) || !/\.jpe?g(?:[?#]|$)/i.test(url)) continue; // jpeg only; skip the webp <source>
    const hash = /fp\/([0-9a-f]{32})/i.exec(url)?.[1] ?? url;
    const w = best?.w ?? widthFromUrl(url);
    const prev = byHash.get(hash);
    if (!prev || w > prev.w) byHash.set(hash, { originalUrl: prev?.originalUrl ?? original, url, w });
  }
  const photos = dedupe([...byHash.values()].map(({ originalUrl, url }) => ({ originalUrl, url })));
  return { ...base, photos, source: photos.length > 0 ? 'dom' : 'none' };
}

export const zillowAdapter: SiteAdapter = { site: 'zillow', matches, extract };
