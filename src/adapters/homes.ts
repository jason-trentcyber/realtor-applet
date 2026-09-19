// homes.com adapter (ADR-0001 §3, ADR-0002). This site embeds NO photo list:
// JSON-LD carries one image and the page is Vue-rendered, so the DOM is the
// only source (ADR-0002 status note 2026-09-19). Two DOM sources, in order:
//   1. #gallery-modal-v2 — the full-screen viewer, present only after the user
//      clicks the main photo; one slide per photo (src when loaded, data-image
//      when lazy). Trailing `.fb-slide` "flashback" slides are photos from a
//      prior listing and are excluded.
//   2. #gallery-primary-carousel — what a fresh page has: a handful of real
//      slides plus spacer.gif placeholders; carries data-totalimgs="<N>".
// When the DOM has fewer photos than data-totalimgs, `expectedCount` is set so
// the popup can ask the user to open the viewer (REQUIREMENTS F7 note).
//
// CDN shape: images.homes.com/listings/<sizeCode>/<2-digit><8 digits>-<9 digits>/<slug>[-N].jpg
// Size codes observed: 104 (thumb), 115 (325x217), 117 (650x433), 111 (1240x826), 214.
// toLargest rewrites the code to 111 — the largest the page itself served.
// Fixture: fixtures/homes/x0000000000000/, human-captured.

import type { SiteAdapter, Listing, PhotoRef } from './types';

type Source = 'json' | 'dom' | 'none';

const LISTING_URL = /^(https:\/\/images(?:cdn)?\.homes\.com\/listings\/)(\d+)(\/\d{10}-\d{9}\/[^\s"'?#]+)(\?[^\s"']*)?$/i;
const LARGEST_CODE = '111';

function matches(url: string): boolean {
  return /^https:\/\/www\.homes\.com\/property\//.test(url);
}

export function toHomesLargest(url: string): string {
  const m = LISTING_URL.exec(url);
  return m ? `${m[1]}${LARGEST_CODE}${m[3]}` : url;
}

function photoUrl(img: Element): string | undefined {
  for (const attr of ['src', 'data-image', 'data-src']) {
    const v = img.getAttribute(attr);
    if (v && LISTING_URL.test(v)) return v;
  }
  return undefined;
}

function collect(nodes: Iterable<Element>): PhotoRef[] {
  const seen = new Set<string>();
  const out: PhotoRef[] = [];
  for (const node of nodes) {
    const originalUrl = photoUrl(node);
    if (!originalUrl) continue;
    const url = toHomesLargest(originalUrl);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ originalUrl, url });
  }
  return out;
}

function listingIdFromUrl(href: string): string {
  return /\/property\/[^/]+\/([a-z0-9]+)\/?/i.exec(href)?.[1] ?? '';
}

function addressFromUrl(href: string): string {
  const slug = /\/property\/([^/]+)\//i.exec(href)?.[1] ?? '';
  return slug.replace(/-/g, ' ');
}

function extract(doc: Document): Listing & { source: Source; expectedCount?: number } {
  const href = doc.location?.href ?? '';
  const base: Listing = { site: 'homes', listingId: listingIdFromUrl(href), address: addressFromUrl(href), photos: [] };

  const carousel = doc.querySelector('#gallery-primary-carousel');
  const total = parseInt(carousel?.getAttribute('data-totalimgs') ?? '', 10);
  const expected = Number.isFinite(total) && total > 0 ? total : undefined;

  // 1. Full-screen viewer, if the user has opened it: complete gallery.
  const modal = doc.querySelector('#gallery-modal-v2');
  if (modal) {
    const slides = [...modal.querySelectorAll('.embla__slide')].filter((s) => !s.classList.contains('fb-slide'));
    const photos = collect(slides.flatMap((s) => [...s.querySelectorAll('img')]));
    if (photos.length > 0) {
      return { ...base, photos, source: 'dom', ...(expected && photos.length < expected ? { expectedCount: expected } : {}) };
    }
  }

  // 2. Primary carousel: partial on a fresh page.
  if (carousel) {
    const photos = collect(carousel.querySelectorAll('img'));
    if (photos.length > 0) {
      return { ...base, photos, source: 'dom', ...(expected && photos.length < expected ? { expectedCount: expected } : {}) };
    }
  }

  return { ...base, source: 'none' };
}

export const homesAdapter: SiteAdapter = { site: 'homes', matches, extract };
