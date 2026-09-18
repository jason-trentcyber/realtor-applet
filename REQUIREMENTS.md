# Requirements

## 1. What this is

A Chrome (Manifest V3) extension that, on a single real-estate listing detail page, saves the full photo gallery as one zip. Three sites in v1: realtor.com, Zillow, homes.com. Personal use by the person browsing; nothing runs unattended.

The repository is also a second instance of the AI-first SDLC first built in frontdesk: the same guardrails on a codebase with no server, no database and no cloud cost. Both are deliverables.

## 2. Functional

- F1 Activation: the toolbar action is enabled only on detail-page URLs (ADR-0001 lists the patterns). Everywhere else it is disabled and does nothing.
- F2 Extraction: an adapter per site returns `{ site, listingId, address, photos[] }`. JSON embedded in the page is the primary source; the gallery DOM is the fallback (ADR-0002).
- F3 Largest size: every photo URL is rewritten to the largest size the site's CDN serves, per the site's documented rule (ADR-0002).
- F4 Zip: `<address-slug>_<site>_<listingId>.zip` containing `01.jpg … NN.jpg` in gallery order and `listing.json` (source URL, captured-at, address, each photo's original URL, final URL, HTTP status, bytes).
- F5 Resilience: a photo that fails to fetch is skipped and recorded in `listing.json`; the zip still saves. The popup reports "N of M saved".
- F6 Drift: zero photos on a matching URL shows "Layout changed on <site>" and a link that opens a prefilled GitHub issue containing the page URL and extension version only.
- F7 Popup: photo count before download, progress during, result after. No settings in v1.

## 3. Non-functional

- Chrome only. No Firefox, no store listing (ADR-0004).
- No network calls except to the page's own image CDN, from the page's own origin, initiated by a click.
- No analytics, no remote config, no storage of listing data beyond the zip the user saves.
- Concurrency 4 fetches; no artificial delays.
- Every adapter has fixture tests; CI blocks on them.

## 4. Out of scope (v1)

Search results, map and saved-list pages; Firefox/Safari; Chrome Web Store; MLS or API access; scheduled checks of the sites; any "install for others" or hosted component; photo deduplication or EXIF handling.

## 5. Definition of done (v1)

- A GitHub Release zip loads unpacked in Chrome and F1–F7 hold on one live listing per site, verified by a human.
- `pnpm lint && pnpm typecheck && pnpm test` green; fixture tests exist for all three adapters.
- Every merged PR carries provenance and a review-agent pass (ADR-0005).
