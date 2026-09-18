// Service worker (ADR-0001 §4): activation rules only, plus the icon state.
// All work happens in the content script / popup.

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
