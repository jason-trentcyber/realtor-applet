// Content script (ADR-0001 §4). Runs on detail pages, listens for the popup's
// probe/download messages. Probe runs the adapter against the live document;
// the download path (fetch -> fflate zip -> <a download> with chrome.downloads
// fallback) is the next PR in the realtor milestone.

import { findAdapterForUrl } from './adapters';

interface ProbeResponse {
  active: boolean;
  found: number;
  listingId: string;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'probe') return false; // no response -> channel stays open
  const url = msg.url as string;
  const adapter = findAdapterForUrl(url);
  if (!adapter) { sendResponse({ active: false, found: 0, listingId: '' } as ProbeResponse); return true; }
  const listing = adapter.extract(document);
  sendResponse({ active: true, found: listing.photos.length, listingId: listing.listingId } as ProbeResponse);
  return true;
});
