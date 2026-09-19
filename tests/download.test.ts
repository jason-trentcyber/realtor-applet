// Download flow, pure part (REQUIREMENTS F4/F5/F6). Fake fetch only — no
// test touches the network (docs/conventions.md → Tests).
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { Listing, PhotoRef } from '../src/adapters/types';
import { buildManifest, buildZip, driftIssueUrl, entryName, fetchAll, slugify, zipName, type FetchLike } from '../src/download';

const HASH = 'deadbeefdeadbeefdeadbeefdeadbeef';
const photo = (n: number): PhotoRef => ({
  originalUrl: `https://ap.rdcpix.com/${HASH}l-m${n}s.jpg`,
  url: `https://ap.rdcpix.com/${HASH}l-m${n}rd-w2048_h1536.jpg`,
});
const listing: Listing & { source: 'json' } = {
  site: 'realtor',
  listingId: '0000000001',
  address: '123 Away St, Springfield, XX',
  photos: [1, 2, 3, 4, 5, 6].map(photo),
  source: 'json',
};

/** Fake fetch: `fail` URLs 404, `boom` URLs throw, everything else returns bytes = the url's length. */
function fakeFetch(opts: { fail?: (url: string) => boolean; boom?: (url: string) => boolean; log?: string[]; delayMs?: number } = {}): FetchLike & { inFlight: () => number; peak: () => number } {
  let inFlight = 0;
  let peak = 0;
  const fn: FetchLike = async (url) => {
    opts.log?.push(url);
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, opts.delayMs ?? 2));
    inFlight--;
    if (opts.boom?.(url)) throw new TypeError('Failed to fetch');
    if (opts.fail?.(url)) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer as ArrayBuffer };
  };
  return Object.assign(fn, { inFlight: () => inFlight, peak: () => peak });
}

describe('naming (F4)', () => {
  it('slugifies the address and builds <slug>_<site>_<id>.zip', () => {
    expect(slugify('123 Away St, Springfield, XX')).toBe('123-away-st-springfield-xx');
    expect(zipName(listing)).toBe('123-away-st-springfield-xx_realtor_0000000001.zip');
    expect(zipName({ site: 'realtor', listingId: '', address: '' })).toBe('listing_realtor_unknown.zip');
  });
  it('numbers entries in gallery order with a width that fits the gallery', () => {
    expect(entryName(0, 6, photo(1).url)).toBe('01.jpg');
    expect(entryName(9, 120, photo(1).url)).toBe('010.jpg');
    expect(entryName(0, 1, 'https://x/y.WEBP')).toBe('01.webp');
    expect(entryName(0, 1, 'https://x/y')).toBe('01.jpg');
  });
});

describe('fetchAll (F5, concurrency 4)', () => {
  it('fetches every photo, keeps order, never exceeds 4 in flight', async () => {
    const f = fakeFetch({ delayMs: 5 });
    const progress: number[] = [];
    const results = await fetchAll(listing.photos, f, (done) => progress.push(done));
    expect(results.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(results.every((r) => r.status === 200 && r.data && r.bytes > 0)).toBe(true);
    expect(f.peak()).toBe(4);
    expect(f.inFlight()).toBe(0);
    expect(progress).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('records a 404 and a thrown fetch without aborting the others', async () => {
    const f = fakeFetch({ fail: (u) => u.includes('m2'), boom: (u) => u.includes('m5') });
    const results = await fetchAll(listing.photos, f);
    expect(results.filter((r) => r.data)).toHaveLength(4);
    expect(results[1]).toMatchObject({ status: 404, bytes: 0 });
    expect(results[1].data).toBeUndefined();
    expect(results[4]).toMatchObject({ status: 0, error: 'Failed to fetch' });
  });
  it('retries the original page URL once when the upsized URL fails', async () => {
    const log: string[] = [];
    const f = fakeFetch({ log, fail: (u) => u.includes('m3') && u.includes('rd-w2048') });
    const results = await fetchAll(listing.photos, f);
    expect(results[2].finalUrl).toBe(photo(3).originalUrl);
    expect(results[2].status).toBe(200);
    expect(log.filter((u) => u.includes('m3'))).toHaveLength(2);
    // a photo that succeeded first time is fetched exactly once
    expect(log.filter((u) => u.includes('m1'))).toHaveLength(1);
  });
});

describe('manifest + zip (F4/F5)', () => {
  it('writes NN.jpg entries plus listing.json with per-photo status, skipping failures', async () => {
    const f = fakeFetch({ fail: (u) => u.includes('m4') });
    const results = await fetchAll(listing.photos, f);
    const manifest = buildManifest(listing, results, {
      sourceUrl: 'https://www.realtor.com/realestateandhomes-detail/M0000000001',
      extensionVersion: '0.1.0',
      now: new Date('2026-09-18T22:00:00Z'),
    });
    expect(manifest).toMatchObject({ site: 'realtor', listingId: '0000000001', saved: 5, total: 6, photoSource: 'json', capturedAt: '2026-09-18T22:00:00.000Z' });
    expect(manifest.photos[3]).toMatchObject({ index: 3, status: 404, bytes: 0 });
    expect('data' in manifest.photos[0]).toBe(false);

    const zip = unzipSync(buildZip(results, manifest));
    expect(Object.keys(zip).sort()).toEqual(['01.jpg', '02.jpg', '03.jpg', '05.jpg', '06.jpg', 'listing.json']);
    expect(strFromU8(zip['01.jpg'])).toBe(photo(1).url); // fake fetch returns the url as the body
    const parsed = JSON.parse(strFromU8(zip['listing.json'])) as typeof manifest;
    expect(parsed.photos).toHaveLength(6);
    expect(parsed.photos[3].finalUrl).toBe(photo(4).originalUrl); // fell back, still failed
  });
});

describe('drift link (F6)', () => {
  it('carries only the page URL and extension version', () => {
    const u = new URL(driftIssueUrl('realtor', 'https://www.realtor.com/realestateandhomes-detail/M1', '0.1.0'));
    expect(u.origin + u.pathname).toBe('https://github.com/jason-trentcyber/realtor-applet/issues/new');
    expect(u.searchParams.get('title')).toBe('Layout changed on realtor.com');
    expect(u.searchParams.get('body')).toContain('Page: https://www.realtor.com/realestateandhomes-detail/M1');
    expect(u.searchParams.get('body')).toContain('Extension version: 0.1.0');
    expect(u.searchParams.get('body')).not.toMatch(/<|rdcpix|address/i);
  });
});
