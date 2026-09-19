// homes.com adapter, fixture-driven (ADR-0002, ADR-0006 §2). No embedded photo
// list on this site: both fixtures are DOM slices (fixtures/homes/x0000000000000/).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { findAdapterForUrl } from '../src/adapters';
import { homesAdapter, toHomesLargest } from '../src/adapters/homes';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'homes', 'x0000000000000');
const DETAIL_URL = 'https://www.homes.com/property/123-away-st-springfield-xx/x0000000000000/';
const CDN = 'https://images.homes.com/listings/';

const readFixture = (name: string) => readFileSync(join(FIXTURE_DIR, name), 'utf8');

function docWith(opts: { carousel?: boolean; modal?: boolean; extraHtml?: string }): Document {
  const parts: string[] = [];
  if (opts.carousel) parts.push(readFixture('carousel.html'));
  if (opts.modal) parts.push(readFixture('gallery-modal.html'));
  if (opts.extraHtml) parts.push(opts.extraHtml);
  return new JSDOM(`<!doctype html><html><body>${parts.join('\n')}</body></html>`, { url: DETAIL_URL }).window.document;
}

describe('homes.com matching (ADR-0001 §2)', () => {
  it('matches /property/ URLs only', () => {
    expect(findAdapterForUrl(DETAIL_URL)?.site).toBe('homes');
    expect(findAdapterForUrl('https://www.homes.com/springfield-xx/')).toBeUndefined();
  });
});

describe('homes.com toLargest (ADR-0002 §3)', () => {
  it('rewrites the size code to 111 and drops the query string', () => {
    expect(toHomesLargest(`${CDN}115/5100000000-000000000/123-away-st-11.jpg`)).toBe(`${CDN}111/5100000000-000000000/123-away-st-11.jpg`);
    expect(toHomesLargest(`${CDN}214/6300000000-000000000/123-away-st-14.jpg?t=p`)).toBe(`${CDN}111/6300000000-000000000/123-away-st-14.jpg`);
    expect(toHomesLargest(`https://imagescdn.homes.com/listings/104/8300000000-000000000/123-away-st.jpg`)).toBe(`https://imagescdn.homes.com/listings/111/8300000000-000000000/123-away-st.jpg`);
  });
  it('passes unknown shapes through unchanged', () => {
    for (const u of ['/assets/images/spacer.gif', 'https://images.homes.com/agents/1/photo.jpg', 'https://example.com/listings/115/x/y.jpg']) {
      expect(toHomesLargest(u)).toBe(u);
    }
  });
});

describe('homes.com extract — viewer open (full gallery)', () => {
  const listing = homesAdapter.extract(docWith({ carousel: true, modal: true }));

  it('reads every slide of #gallery-modal-v2 in order, src or data-image, at size 111', () => {
    expect(listing.source).toBe('dom');
    expect(listing.photos).toHaveLength(55);
    expect(listing.expectedCount).toBeUndefined();
    expect(listing.photos[0].url).toBe(`${CDN}111/8300000000-000000000/123-away-st.jpg`);
    expect(listing.photos[10].originalUrl).toBe(`${CDN}115/5100000000-000000000/123-away-st-11.jpg`);
    expect(listing.photos[10].url).toBe(`${CDN}111/5100000000-000000000/123-away-st-11.jpg`);
    expect(listing.photos[54].url).toBe(`${CDN}111/4400000000-000000000/123-away-st-55.jpg`);
    expect(listing.photos.every((p) => p.url.includes('/listings/111/'))).toBe(true);
  });
  it('excludes the trailing flashback slides (prior-listing photos)', () => {
    expect(listing.photos.some((p) => /-8[56]\.jpg$/.test(p.url))).toBe(false);
  });
  it('fills listingId and address from the URL', () => {
    expect(listing.site).toBe('homes');
    expect(listing.listingId).toBe('x0000000000000');
    expect(listing.address).toBe('123 away st springfield xx');
  });
});

describe('homes.com extract — fresh page (viewer not opened)', () => {
  it('returns the loaded carousel photos and expectedCount from data-totalimgs', () => {
    const l = homesAdapter.extract(docWith({ carousel: true }));
    expect(l.source).toBe('dom');
    expect(l.photos).toHaveLength(7);
    expect(l.expectedCount).toBe(55);
    expect(l.photos.every((p) => !p.originalUrl.includes('spacer'))).toBe(true);
  });
  it('does not set expectedCount when the DOM already has all of them', () => {
    const l = homesAdapter.extract(docWith({ carousel: true, modal: true }));
    expect(l.expectedCount).toBeUndefined();
  });
});

describe('homes.com extract — drift (ADR-0002 §5)', () => {
  it('returns photos: [] / none with no gallery markup, never throws', () => {
    expect(homesAdapter.extract(docWith({}))).toMatchObject({ site: 'homes', photos: [], source: 'none' });
  });
  it('ignores non-listing images on the page', () => {
    const l = homesAdapter.extract(docWith({ extraHtml: '<img src="https://images.homes.com/agents/1/photo.jpg"><img src="https://imagescdn.homes.com/listings/115/9900000000-000000000/other.jpg">' }));
    expect(l.photos).toHaveLength(0);
  });
});
