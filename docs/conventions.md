# Conventions

Rules every contributor (human or agent) follows. If a PR is rejected for the same reason twice, the reason becomes a rule here (0005 §1).

## Repo layout

```
src/
  background.ts        service worker: declarativeContent rules + message relay only
  content.ts           content script: probe / extract / fetch / zip / save (ADR-0001 §4)
  popup.ts             popup logic: count, progress, result, drift notice
  popup.html
  adapters/
    types.ts           Listing, PhotoRef, SiteAdapter
    realtor.ts
    zillow.ts
    homes.ts
  zip.ts               fflate wrapper; manifest assembly
fixtures/<site>/<id>/  trimmed, anonymised fixtures: listing.json (the JSON the adapter reads)
                      and gallery.html (minimal DOM slice for the fallback path)
tests/                 Vitest; one spec per adapter against its fixtures
docs/                  ADRs, governance, conventions, review rubric
.github/workflows/     pr-lint, review-agent, ci, release
```

The owning ADR for each directory is in `CLAUDE.md`. Read it before editing.

## Toolchain

- Node 22, pnpm. `pnpm install`, then `pnpm lint && pnpm typecheck && pnpm test` before any PR.
- TypeScript strict. ESLint + Prettier at root. No `any` without a comment saying why.
- esbuild via `build.mjs`; `dist/` is git-ignored (built in CI for releases, 0004).
- Runtime deps: `fflate` only. Everything else is devDependency.

## Fixtures (human task — agents do not capture or fetch)

- Captured in your own browser with the snippet at the bottom of this file: it copies the trimmed listing JSON and a small gallery DOM snippet to the clipboard, addresses and names already replaced with fake values.
- Save as `fixtures/<site>/<id>/` with `listing.json` and `gallery.html`. Keep them small (prune to what the adapter reads). Photo URLs stay intact.
- A fixture change is a human commit and is called out in the PR body (0005 §4).
- Real addresses, agent names, phone numbers, MLS ids that would identify a person: never. Fake them.

## Code style

- TypeScript strict; interfaces in `src/adapters/types.ts` are the contract. `extract()` returns `{ site, listingId, address, photos }` and never throws on missing data — it returns `photos: []` so the popup can show the drift notice (0002 §5).
- Pure functions (`matches`, `toLargest`) are unit-testable with no Date and no network. Keep them pure.
- No `console.log` in committed code; no dead code; small diffs one issue per PR.

## Tests

- Adapter specs load the fixtures, run `extract()` and `toLargest()`, assert count/order/id/address and every known URL pattern.
- No test, no fixture, and no test run touches the network.

## Git and PRs

- Branches: `<jason|claude|hermes>/<topic>`.
- Commits: imperative, ≤ 72 chars. Keep tool-added trailers.
- Every PR: exactly one `agent:*` label, a filled `Model:` line, a linked issue, and `Tests run` listed. `pr-lint` enforces the label and model.
- Words to avoid in features, issues, and (especially) visible copy: "scrape", "scraper", "bulk", "download all", "crawler" (0003 §6).
- Do not commit `dist/`, lockfile churn unrelated to your change, or full page HTML.

## Console snippets for fixture capture

Run on the listing page in the human's browser, never an agent's. One snippet per site, kept next to the fixtures; each prunes to what the adapter reads and replaces the photo hash and address with fake values before anything reaches the clipboard.

- realtor.com: `fixtures/realtor/capture.js` → `next-data.json` + `gallery.html` under `fixtures/realtor/M<10 digits>/`.
- Zillow, homes.com: written with those milestones (the realtor one is the template).

Before committing, read the paste: no street name, no person's name, no real photo hash, no key the adapter does not read.
