// realtor.com adapter (ADR-0001 §3, ADR-0002). JSON-first via __NEXT_DATA__,
// DOM fallback on gallery `picture` nodes, then toLargest() strips the size
// suffix from ap.rdcpix.com URLs (§3). The real extraction is the next
// milestone (realtor) and is fixture-driven (docs/conventions.md -> Fixtures).

import type { SiteAdapter, Listing } from './types';

function matches(url: string): boolean {
  return /^https:\/\/www\.realtor\.com\/realestateandhomes-detail\//.test(url);
}

export function toRealtorLargest(url: string): string {
  // ap.rdcpix.com/<photo>/<size>.<ext> -> drop the trailing size segment.
  return url.replace(/-[a-z0-9_]+(\.[a-z0-9]+)$/i, '$1');
}

export const realtorAdapter: SiteAdapter = {
  site: 'realtor',
  matches,
  extract(doc: Document): Listing & { source: 'json' | 'dom' | 'none' } {
    // Milestone "realtor": parse #__NEXT_DATA__, map to Listing. Until the
    // fixture-driven implementation lands this deliberately returns "none"
    // so the popup shows the drift notice rather than a wrong gallery.
    void doc;
    return { site: 'realtor', listingId: '', address: '', photos: [], source: 'none' };
  },
};