# ADR-0002: Photo source

Status: decided 2026-09-18.

Amended 2026-09-18 (status note, decision clauses unchanged): the Context paragraph below guessed realtor.com's size token as a `-w480_h360` suffix. The first human-captured fixture (`fixtures/realtor/M0000000001/`) shows the real shape is `ap.rdcpix.com/<32 hex>l-m<id>` followed by a size token — `s.jpg` in the embedded JSON, `rd-w<W>_h<H>.(webp|jpg)` in the DOM, `rd-w2048_h1536.jpg` the largest served. §3 already required the rule to be a fixture-backed pure function, which is what caught the guess. The gallery JSON path is `props.pageProps.initialReduxState.propertyDetails.photos[].href`; `augmented_gallery` is the same photos bucketed by room and is ignored.

## Context
The gallery DOM on all three sites is lazy: only photos that have scrolled into view exist as `<img>`/`<source>` nodes, and they carry thumbnail-sized URLs. The Zillow gist works around this by instructing the user to "scroll through all images first" and then taking the last `srcset` entry. That is fragile and manual.

All three sites are server-rendered React/Next applications and embed the full listing record — including the complete photo array — in the HTML: `#__NEXT_DATA__` on realtor.com and Zillow (Zillow also exposes a `hdpApolloPreloadedData` blob), and a JSON-LD / preloaded-state blob on homes.com. The exact paths are learned from fixtures captured by a human (ADR-0003 §agents) and will drift over time.

CDN URLs encode the size: realtor.com's `ap.rdcpix.com` uses a `-w480_h360` style suffix before the extension; Zillow's `photos.zillowstatic.com` uses `-cc_ft_384` / `-uncropped_scaled_within_1536_1152`; homes.com's CDN uses a size segment in the path. Removing or replacing the size token yields the largest rendition.

## Decision
1. **JSON first.** Each adapter's `extract()` locates the site's embedded listing JSON and reads the photo array from it. This yields the whole gallery regardless of scroll state.
2. **DOM fallback.** If the JSON is absent or yields zero photos, the adapter selects gallery `<picture>`/`<img>` nodes (the Zillow gist's `ul.media-stream li picture source[type="image/jpeg"]` is the seed selector for that site) and takes the largest `srcset` candidate. The result is marked `source: "dom"` in `listing.json` so a partial gallery is explainable.
3. **Per-site upsizing rule**, written as a pure function `toLargest(url): string` in the adapter with fixture-backed tests for each known pattern. Unknown patterns pass through unchanged — never guess a URL the site did not give us.
4. **Order and dedupe.** Gallery order as the site lists it; duplicates (same URL after upsizing) removed, first occurrence wins.
5. **Drift signal.** A matching URL that produces zero photos from both paths is a *layout change*, not an error. The popup shows "Layout changed on <site>" and a prefilled-issue link carrying the page URL and extension version only. The fixture tests in CI are the other half of drift detection.

## Consequences
- No scrolling requirement for the user.
- Each adapter has two extraction paths and one URL function, each fixture-tested. When a site changes, exactly one file changes.
- Fixtures must contain the real JSON shape; they are captured by a human and anonymised (ADR-0006).
- The DOM fallback is honest about being partial; we do not silently ship 12 photos as if they were the gallery.

## Rejected
- **DOM only.** Requires the user to scroll; misses lazy photos; thumbnail URLs need upsizing anyway.
- **Calling the sites' internal JSON APIs directly.** More reliable in the short term, but it is a request the page did not make, which crosses from "save what the browser fetched" into scraping (ADR-0003).
- **Guessing larger sizes by probing the CDN (`HEAD` requests for candidate suffixes).** Extra requests per photo and fabricates URLs; the site's own JSON already names the original.
