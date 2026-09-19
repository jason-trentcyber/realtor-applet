// Service worker (ADR-0001 §4): activation rules, the icon state, and the one
// relay the content script cannot do itself (chrome.downloads is not exposed
// to content scripts). No fetching, no page logic.

import type { Message } from './messages';
import type { FetchPhotoResponse } from './messages';

chrome.runtime.onInstalled.addListener(() => {
  // ShowAction only enables the action where a rule matches; it never disables
  // it elsewhere, and the action starts enabled. Disable globally first so the
  // rules below are the only thing that turns it on (REQUIREMENTS F1).
  chrome.action.disable();
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
              hostSuffix: 'realtor.com',
              pathPrefix: '/realestateandhomes-detail/',
            },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: 'zillow.com', pathPrefix: '/homedetails/' },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: 'homes.com', pathPrefix: '/property/' },
          }),
        ],
        actions: [new chrome.declarativeContent.ShowAction()],
      },
    ]);
  });
});

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (msg?.type === 'save-fallback') {
    chrome.downloads
      .download({ url: msg.dataUrl, filename: msg.filename, saveAs: false })
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    return true;
  }
  if (msg?.type === 'fetch-photo') {
    // ADR-0007: only for adapters marked fetchVia: 'worker', only URLs the
    // adapter took from the page, only on the user's click. host_permissions
    // limits which hosts this can reach at all.
    fetch(msg.url, { credentials: 'omit' })
      .then(async (r) => {
        if (!r.ok) return sendResponse({ ok: false, status: r.status } satisfies FetchPhotoResponse);
        const bytes = new Uint8Array(await r.arrayBuffer());
        sendResponse({ ok: true, status: r.status, base64: bytesToBase64(bytes) } satisfies FetchPhotoResponse);
      })
      .catch((e: unknown) => sendResponse({ ok: false, status: 0, error: e instanceof Error ? e.message : String(e) } satisfies FetchPhotoResponse));
    return true;
  }
  return false;
});
