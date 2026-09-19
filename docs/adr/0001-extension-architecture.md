# ADR-0001: Extension architecture

Status: decided 2026-09-18. One clause superseded 2026-09-19 by ADR-0007: the "Rejected: fetch in the service worker" entry and the "no `host_permissions`" consequence no longer hold for CDNs that refuse page-origin fetch (homes.com). Everything else stands.

## Context
The seed for this project is two DevTools console snippets — one for realtor.com, one for Zillow (the public "Zillow Image Downloader" gist) — that select gallery `<img>`/`<source>` elements, `fetch()` each URL from the page's own origin, and trigger downloads. They prove two things: the image CDNs answer same-origin `fetch()` from the listing page without extra headers, and the download path needs nothing beyond `<a download>`. They also share three weaknesses: the user must scroll the whole gallery first so lazy images exist in the DOM, each photo is a separate download rather than one archive, and there is no notion of "which site am I on".

Chrome extensions on Manifest V3 have a service worker with no DOM (no `URL.createObjectURL`, no `<a download>`), content scripts that run in the page's context, and a popup with its own short-lived document.

## Decision
1. **Manifest V3, Chrome only.** No `browser_specific_settings`, no polyfill, no Firefox testing. Edge could load the same zip but is not a target and is not mentioned as supported.
2. **Activation by URL, no page injection.** `declarativeContent` enables the toolbar action on these patterns only:
   - realtor.com: `/realestateandhomes-detail/*`
   - zillow.com: `/homedetails/*`
   - homes.com: `/property/*`
   The extension adds nothing to the page's DOM. All UI is in the popup.
3. **Per-site adapters behind one interface.** `src/adapters/<site>.ts` exports `{ site, matches(url): boolean, extract(doc: Document): Listing }` where `Listing = { site, listingId, address, photos: PhotoRef[] }`. The core knows only the interface. Adding a site is one adapter file plus fixtures; the core does not change.
4. **The content script does the work.** On the popup's "Download ZIP" message, the content script runs the adapter, fetches photos (concurrency 4) from the page's origin — reproducing exactly what the console snippets proved — zips them in memory with `fflate`, and saves via `<a download>` on a blob URL. If the anchor path is blocked, it falls back to `chrome.downloads.download` with the blob URL. The service worker holds no logic beyond activation rules and message relay.
5. **Popup = state display.** Photo count (from a `probe` message), progress (from `progress` messages), result, and the drift notice (ADR-0002 §drift). No settings page in v1.

## Consequences
- Same-origin fetch means no `host_permissions` for the CDNs; the permission set is `activeTab`, `scripting`, `declarativeContent`, `downloads`. Small permission surface is a stated goal.
- Zipping in the content script means the whole gallery is in page memory briefly (~50 photos × ~300 KB, well under 50 MB). Acceptable for v1; a streaming path via the offscreen API is the revisit if galleries prove larger.
- Because nothing is injected, the sites' own scripts have nothing to detect or fight; the cost is that all interaction is through the toolbar icon.
- Chrome only removes an entire class of cross-browser conditionals from a codebase whose point is to stay explainable.

## Rejected
- **Fetch in the service worker with `host_permissions`.** Bypasses CORS but cannot create a blob URL or click an anchor; needs an offscreen document or ArrayBuffer messaging. More moving parts to reproduce something the content script already does.
- **Inject a floating button into the page.** Faster to reach, but it is a DOM mutation on a site whose markup we do not control and whose anti-tamper scripts we cannot see. The toolbar icon is the browser's own, supported surface.
- **One download per photo (the gist's approach).** 47 downloads and 47 prompts; the zip is the feature.
- **Firefox support.** Different SW semantics and `browser_specific_settings`; nobody asked for it.
