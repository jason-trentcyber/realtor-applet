// Service worker (ADR-0001 §4): activation rules, the icon state, and the one
// relay the content script cannot do itself (chrome.downloads is not exposed
// to content scripts). No fetching, no page logic.

import type { Message } from './messages';

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

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (msg?.type !== 'save-fallback') return false;
  chrome.downloads
    .download({ url: msg.dataUrl, filename: msg.filename, saveAs: false })
    .then(() => sendResponse({ ok: true }))
    .catch((e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  return true;
});
