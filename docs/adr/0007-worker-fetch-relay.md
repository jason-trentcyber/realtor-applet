# ADR-0007: Service-worker fetch relay for CDNs that refuse page-origin fetch

Status: decided 2026-09-19. Supersedes ADR-0001 "Rejected: fetch in the service worker with `host_permissions`" and the consequence "no `host_permissions` for the CDNs"; every other clause of ADR-0001 stands.

## Context
ADR-0001 chose to fetch photos from the content script on the strength of two console gists (realtor.com, Zillow) that proved their CDNs answer a page-origin `fetch()`. That held for `ap.rdcpix.com` and `photos.zillowstatic.com` in the live checks of PRs #10 and #12. It does not hold for homes.com: `images.homes.com` serves the `<img>` tags but sends no `Access-Control-Allow-Origin`, so `fetch()` from `https://www.homes.com` is blocked (verified in Jason's browser 2026-09-19: "No 'Access-Control-Allow-Origin' header is present"). The first live homes.com save produced a zip with `listing.json` only — 0 of 55, every photo `status: 0, error: Failed to fetch`. F5 worked; the feature did not.

An extension's service worker is not subject to the page's CORS policy for hosts listed in `host_permissions`. ADR-0001 rejected that route because a service worker "cannot create a blob URL or click an anchor" — true, but the worker does not need to save anything: it only needs to return bytes to the content script, which already zips and saves.

## Decision
1. **Per-adapter flag.** `SiteAdapter` gains an optional `fetchVia: 'page' | 'worker'` (default `'page'`). Only `homes` sets `'worker'`.
2. **Relay, not a second download path.** For `'worker'` adapters the content script sends `{ type: 'fetch-photo', url }` to the service worker, which does `fetch(url)` and replies with the status and the bytes (as an `ArrayBuffer` transferred through the message port as a base64 string — messages must be JSON-serialisable). Concurrency, retry-on-original, manifest, zip and save are unchanged and stay in the content script (ADR-0001 §4).
3. **Narrowest permission that works.** `manifest.json` gains `"host_permissions": ["https://images.homes.com/*", "https://imagescdn.homes.com/*"]` — the two image hosts the fixture shows, nothing wider. No permission for the listing sites themselves; the service worker still never fetches a page.
4. **Same-origin stays the default.** A new adapter uses `'page'` unless a human live check proves the CDN blocks it. Switching a site to `'worker'` is a one-line adapter change plus a `host_permissions` entry, both in the same PR with the console evidence quoted.
5. **Scope unchanged.** The worker fetches only URLs the adapter extracted from the page the user is on, only on the user's click (ADR-0003 §1–§3). It does not enumerate, guess or prefetch.

## Consequences
- Permission surface grows from four API permissions to four plus two host patterns. `chrome://extensions` will show "Read and change your data on images.homes.com and imagescdn.homes.com". The README states why.
- Bytes cross a message boundary once per photo (~300 KB base64 each, 55 photos) — measurable but well under MV3 message limits; a `.webp`-heavy or 200-photo gallery would want chunking. Revisit if a site exceeds ~100 photos.
- The worker now has one fetch responsibility; ADR-0001's "no logic beyond activation rules and message relay" reads as "activation rules, save fallback, and the fetch relay".
- The local headless harness (PR #10) must serve the homes.com CDN *without* an ACAO header to prove the relay is what makes it work.

## Rejected
- **`mode: 'no-cors'` fetch in the content script.** Returns an opaque response; the bytes are unreadable, so nothing to zip.
- **Draw each `<img>` to a canvas and export.** Tainted canvas for cross-origin images without CORS; same wall.
- **Offscreen document.** Solves saving from the worker, which we do not need; the content script already saves.
- **`host_permissions` for `*://*.homes.com/*`.** Wider than needed; would also cover the listing pages, contradicting ADR-0003 §4's spirit.
- **Drop homes.com.** It is one of the three sites in REQUIREMENTS §1 and the DOM extraction works; only the transport is wrong.
