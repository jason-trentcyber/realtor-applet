// Content script (ADR-0001 §4). Runs on detail pages, listens for the popup's
// probe/download messages. The download path (fetch -> fflate zip -> <a download>
// with chrome.downloads fallback) is the realtor milestone; this scaffold only
// answers probe so the popup has a working count to render.

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
  // Extract against the real document. For the realtor milestone this returns 0.
  sendResponse({ active: true, found: 0, listingId: '' } as ProbeResponse);
  return true;
});
