// Zillow adapter, fixture-driven (ADR-0002, ADR-0006 §2). Fixture under
// fixtures/zillow/Z1000000001/ is human-captured and anonymised.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { findAdapterForUrl } from '../src/adapters';
import { largestFromSrcset, largestZillowUrl, zillowAdapter } from '../src/adapters/zillow';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'zillow', 'Z1000000001');
const DETAIL_URL = 'https://www.zillow.com/homedetails/123-Away-St-Springfield-XX-00000/1000000001_zpid/';
const FP = 'https://photos.zillowstatic.com/fp/';
const h = (n: number) => String(n).padStart(32, '0');

const readFixture = (name: string) => readFileSync(join(FIXTURE_DIR, name), 'utf8');

function docWith(opts: { nextData?: string; gallery?: boolean; url?: string }): Document {
  const parts: string[] = [];
  if (opts.nextData) parts.push(`<script id="__NEXT_DATA__" type="application/json">${opts.nextData}</script>`);
  if (opts.gallery) parts.push(readFixture('gallery.html'));
  return new JSDOM(`<!doctype html><html><body>${parts.join('\n')}</body></html>`, { url: opts.url ?? DETAIL_URL }).window.document;
}

type NextData = { props: { pageProps: { componentProps: { gdpClientCache: string } } } };
function withCache(mutate: (cache: Record<string, { property: Record<string, unknown> }>) => void): string {
  const nd = JSON.parse(readFixture('next-data.json')) as NextData;
  const cache = JSON.parse(nd.props.pageProps.componentProps.gdpClientCache) as Record<string, { property: Record<string, unknown> }>;
  mutate(cache);
  nd.props.pageProps.componentProps.gdpClientCache = JSON.stringify(cache);
  return JSON.stringify(nd);
}

describe('zillow registry + matching (ADR-0001 §2)', () => {
  it('matches homedetails URLs only', () => {
    expect(findAdapterForUrl(DETAIL_URL)?.site).toBe('zillow');
    expect(findAdapterForUrl('https://www.zillow.com/homes/for_sale/')).toBeUndefined();
    expect(findAdapterForUrl('https://www.realtor.com/realestateandhomes-detail/M1')?.site).toBe('realtor');
  });
});

describe('zillow largest rendition (ADR-0002 §3)', () => {
  it('picks the widest jpeg the page lists, regardless of order', () => {
    expect(
      largestZillowUrl({ url: `${FP}${h(1)}-p_d.jpg`, mixedSources: { jpeg: [{ url: `${FP}${h(1)}-cc_ft_1536.jpg`, width: 1536 }, { url: `${FP}${h(1)}-cc_ft_192.jpg`, width: 192 }] } }),
    ).toBe(`${FP}${h(1)}-cc_ft_1536.jpg`);
  });
  it('falls back to the photo url when no renditions are listed — never invents a URL', () => {
    expect(largestZillowUrl({ url: `${FP}${h(1)}-p_d.jpg` })).toBe(`${FP}${h(1)}-p_d.jpg`);
    expect(largestZillowUrl({ url: `${FP}${h(1)}-p_d.jpg`, mixedSources: { jpeg: [{ url: 'x' }] } })).toBe(`${FP}${h(1)}-p_d.jpg`);
  });
  it('picks the largest w-descriptor from a srcset', () => {
    expect(largestFromSrcset(`${FP}a-192.jpg 192w, ${FP}a-960.jpg 960w, ${FP}a-384.jpg 384w`)).toEqual({ url: `${FP}a-960.jpg`, w: 960 });
    expect(largestFromSrcset('')).toBeUndefined();
  });
});

describe('zillow extract — JSON path (ADR-0002 §1)', () => {
  const listing = zillowAdapter.extract(docWith({ nextData: readFixture('next-data.json'), gallery: true }));

  it('reads the whole gallery from gdpClientCache in page order at the widest rendition', () => {
    expect(listing.source).toBe('json');
    expect(listing.photos).toHaveLength(89);
    expect(listing.photos[0].originalUrl).toBe(`${FP}${h(1)}-p_d.jpg`);
    expect(listing.photos[0].url).toBe(`${FP}${h(1)}-cc_ft_1536.jpg`);
    expect(listing.photos[88].url).toBe(`${FP}${h(89)}-cc_ft_1536.jpg`);
    expect(new Set(listing.photos.map((p) => p.url)).size).toBe(89);
  });
  it('fills listingId from the property zpid and a display address', () => {
    expect(listing.site).toBe('zillow');
    expect(listing.listingId).toBe('1000000001');
    expect(listing.address).toBe('123 Away St, Springfield, XX');
  });
  it('prefers the cache entry whose zpid matches the URL when several have photos', () => {
    const nd = withCache((cache) => {
      const [key, entry] = Object.entries(cache)[0];
      cache['ForSalePriorityQuery{"zpid":2000000002}'] = { property: { ...entry.property, zpid: 2000000002, streetAddress: '9 Other Rd' } };
      cache[key] = entry;
    });
    const a = zillowAdapter.extract(docWith({ nextData: nd, url: DETAIL_URL }));
    expect(a.listingId).toBe('1000000001');
    const b = zillowAdapter.extract(docWith({ nextData: nd, url: 'https://www.zillow.com/homedetails/x/2000000002_zpid/' }));
    expect(b.listingId).toBe('2000000002');
    expect(b.address).toContain('9 Other Rd');
  });
  it('uses the only entry with photos when the URL zpid matches none (observed re-listing case)', () => {
    const l = zillowAdapter.extract(docWith({ nextData: readFixture('next-data.json'), url: 'https://www.zillow.com/homedetails/x/70291729_zpid/' }));
    expect(l.source).toBe('json');
    expect(l.listingId).toBe('1000000001');
    expect(l.photos).toHaveLength(89);
  });
});

describe('zillow extract — DOM fallback (ADR-0002 §2)', () => {
  it('uses gallery tiles when JSON is absent, largest srcset, listing-photo host only (3D-tour poster ignored)', () => {
    const l = zillowAdapter.extract(docWith({ gallery: true }));
    expect(l.source).toBe('dom');
    expect(l.photos).toHaveLength(1);
    expect(l.photos[0].url).toBe(`${FP}${h(90)}-cc_ft_1536.jpg`);
    expect(l.listingId).toBe('1000000001'); // from the URL
  });
  it('falls back to the DOM when the cache has zero photos', () => {
    const nd = withCache((cache) => {
      for (const e of Object.values(cache)) e.property.responsivePhotos = [];
    });
    const l = zillowAdapter.extract(docWith({ nextData: nd, gallery: true }));
    expect(l.source).toBe('dom');
    expect(l.photos).toHaveLength(1);
  });
});

describe('zillow extract — drift (ADR-0002 §5)', () => {
  it('returns photos: [] / none with neither path, never throws', () => {
    expect(zillowAdapter.extract(docWith({}))).toMatchObject({ site: 'zillow', photos: [], source: 'none' });
  });
  it('survives malformed __NEXT_DATA__ and a malformed cache string', () => {
    expect(zillowAdapter.extract(docWith({ nextData: '{nope' })).source).toBe('none');
    expect(zillowAdapter.extract(docWith({ nextData: JSON.stringify({ props: { pageProps: { componentProps: { gdpClientCache: '{nope' } } } }) })).source).toBe('none');
  });
});
