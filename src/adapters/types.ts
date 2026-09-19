// The adapter contract (ADR-0001 §3). The core knows only this interface;
// adding a site is one new adapter file plus fixtures, never a core change.

export interface PhotoRef {
  /** Original URL as the page named it (gallery order). */
  originalUrl: string;
  /** Largest rendition per the site's rule (ADR-0002 §3). */
  url: string;
}

export interface Listing {
  site: 'realtor' | 'zillow' | 'homes';
  listingId: string;
  /** Display address as shown on the page; used for the zip filename. */
  address: string;
  photos: PhotoRef[];
}

export interface SiteAdapter {
  site: Listing['site'];
  /** Whether this URL is a detail page for this site (ADR-0001 §2). */
  matches(url: string): boolean;
  /**
   * How photo bytes are fetched. 'page' (default): the content script fetches
   * from the page's origin (ADR-0001 §4). 'worker': the CDN refuses page-origin
   * fetch, so the service worker fetches and relays the bytes; needs a
   * host_permissions entry for that CDN (ADR-0007).
   */
  fetchVia?: 'page' | 'worker';
  /**
   * Return the listing, or photos: [] when the markup has changed — never throw
   * (ADR-0002 §5). `source` records which path produced the photos so a partial
   * gallery is explainable. `expectedCount` is set when the page states how many
   * photos the gallery has but fewer are present in the DOM (a site with no
   * embedded photo list, whose viewer loads on click); the popup then asks the
   * user to open the viewer before saving.
   */
  extract(doc: Document): Listing & { source: 'json' | 'dom' | 'none'; expectedCount?: number };
}
