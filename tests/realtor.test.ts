// realtor.com adapter, fixture-driven (ADR-0002, ADR-0006 §2). Fixtures under
// fixtures/realtor/<id>/ are human-captured and anonymised; the tests build a
// jsdom Document from them and run extract() exactly as the content script does.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { realtorAdapter, toRealtorLargest } from '../src/adapters/realtor';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'realtor', 'M0000000001');
const DETAIL_URL = 'https://www.realtor.com/realestateandhomes-detail/123-Away-St_Springfield_XX_00000_M00000-00001';
const HASH = 'deadbeefdeadbeefdeadbeefdeadbeef';

function readFixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), 'utf8');
}

function docWith(opts: { nextData?: boolean; gallery?: boolean }): Document {
  const parts: string[] = [];
  if (opts.nextData) parts.push(`<script id="__NEXT_DATA__" type="application/json">${readFixture('next-data.json')}</script>`);
  if (opts.gallery) parts.push(readFixture('gallery.html'));
  return new JSDOM(`<!doctype html><html><body>${parts.join('\n')}</body></html>`, { url: DETAIL_URL }).window.document;
}

describe('realtor toLargest (ADR-0002 §3)', () => {
  it('rewrites the small JSON rendition to the largest served', () => {
    expect(toRealtorLargest(`https://ap.rdcpix.com/${HASH}l-m2014259136s.jpg`)).toBe(
      `https://ap.rdcpix.com/${HASH}l-m2014259136rd-w2048_h1536.jpg`,
    );
  });
  it('normalises DOM renditions (webp, any WxH) to the same largest URL', () => {
    for (const v of ['rd-w480_h360.webp', 'rd-w960_h720.webp', 'rd-w1280_h960.webp', 'rd-w2048_h1536.webp', 'rd-w2048_h1536.jpg']) {
      expect(toRealtorLargest(`https://ap.rdcpix.com/${HASH}l-m1400713529${v}`)).toBe(
        `https://ap.rdcpix.com/${HASH}l-m1400713529rd-w2048_h1536.jpg`,
      );
    }
  });
  it('passes unknown patterns through unchanged', () => {
    for (const u of [
      'https://ap.rdcpix.com/not-a-hash-m1s.jpg',
      'https://example.com/photo-w480_h360.jpg',
      `https://ap.rdcpix.com/${HASH}l-m1s.png`,
    ]) {
      expect(toRealtorLargest(u)).toBe(u);
    }
  });
});

describe('realtor extract — JSON path (ADR-0002 §1)', () => {
  const listing = realtorAdapter.extract(docWith({ nextData: true, gallery: true }));

  it('reads the whole gallery from #__NEXT_DATA__ in page order', () => {
    expect(listing.source).toBe('json');
    expect(listing.photos).toHaveLength(55);
    expect(listing.photos[0].originalUrl).toBe(`https://ap.rdcpix.com/${HASH}l-m2014259136s.jpg`);
    expect(listing.photos[0].url).toBe(`https://ap.rdcpix.com/${HASH}l-m2014259136rd-w2048_h1536.jpg`);
    expect(listing.photos[54].originalUrl).toBe(`https://ap.rdcpix.com/${HASH}l-m3491735409s.jpg`);
  });
  it('upsizes every photo and dedupes by final URL (ADR-0002 §4)', () => {
    const urls = listing.photos.map((p) => p.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((u) => u.endsWith('rd-w2048_h1536.jpg'))).toBe(true);
  });
  it('fills listingId from property_id and a display address', () => {
    expect(listing.site).toBe('realtor');
    expect(listing.listingId).toBe('0000000001');
    expect(listing.address).toBe('123 Away St, Springfield, XX');
  });
});

describe('realtor extract — DOM fallback (ADR-0002 §2)', () => {
  it('uses hero-carousel slides when JSON is absent and ignores other rdcpix images', () => {
    const listing = realtorAdapter.extract(docWith({ gallery: true }));
    expect(listing.source).toBe('dom');
    expect(listing.photos.map((p) => p.url)).toEqual([
      `https://ap.rdcpix.com/${HASH}l-m2014259136rd-w2048_h1536.jpg`,
      `https://ap.rdcpix.com/${HASH}l-m1400713529rd-w2048_h1536.jpg`,
    ]);
    expect(listing.listingId).toBe('M0000000001'); // from the URL when JSON is missing
  });
  it('falls back to the DOM when JSON parses but has zero photos', () => {
    const data = JSON.parse(readFixture('next-data.json')) as { props: { pageProps: { initialReduxState: { propertyDetails: { photos: unknown[] } } } } };
    data.props.pageProps.initialReduxState.propertyDetails.photos = [];
    const doc = new JSDOM(
      `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>${readFixture('gallery.html')}</body></html>`,
      { url: DETAIL_URL },
    ).window.document;
    const listing = realtorAdapter.extract(doc);
    expect(listing.source).toBe('dom');
    expect(listing.photos).toHaveLength(2);
  });
});

describe('realtor extract — drift (ADR-0002 §5)', () => {
  it('returns photos: [] and source none on a matching page with neither path, never throws', () => {
    const listing = realtorAdapter.extract(docWith({}));
    expect(listing).toMatchObject({ site: 'realtor', photos: [], source: 'none' });
  });
  it('survives malformed __NEXT_DATA__', () => {
    const doc = new JSDOM('<script id="__NEXT_DATA__">{not json</script>', { url: DETAIL_URL }).window.document;
    expect(realtorAdapter.extract(doc).source).toBe('none');
  });
});
