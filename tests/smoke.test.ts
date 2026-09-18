// Adapter-contract smoke tests (fixture-driven specs land with each adapter).
import { describe, expect, it } from 'vitest';
import { findAdapterForUrl } from '../src/adapters';
import { toRealtorLargest } from '../src/adapters/realtor';

describe('adapter registry', () => {
  it('matches a realtor.com detail URL', () => {
    expect(findAdapterForUrl('https://www.realtor.com/realestateandhomes-detail/M9881080693')?.site).toBe('realtor');
  });
  it('does not match a non-detail URL', () => {
    expect(findAdapterForUrl('https://www.realtor.com/homes-for-sale')).toBeUndefined();
  });
  it('does not match a different site detail URL', () => {
    expect(findAdapterForUrl('https://www.zillow.com/homedetails/123')).toBeUndefined();
  });
});

describe('realtor CDN upsizing', () => {
  it('rewrites the size token on an ap.rdcpix.com URL (full cases in realtor.test.ts)', () => {
    expect(toRealtorLargest('https://ap.rdcpix.com/deadbeefdeadbeefdeadbeefdeadbeefl-m1s.jpg')).toBe(
      'https://ap.rdcpix.com/deadbeefdeadbeefdeadbeefdeadbeefl-m1rd-w2048_h1536.jpg',
    );
  });
});
