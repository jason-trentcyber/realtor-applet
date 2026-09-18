# CLAUDE.md — context pack for agents in this repo

A Chrome (Manifest V3) extension that saves the photo gallery of a real-estate listing as one zip, for realtor.com, Zillow and homes.com. Built in public as a second instance of the AI-first SDLC first proven in frontdesk. The process is a deliverable: how you work here matters as much as what you ship.

## Read first, in this order

1. `REQUIREMENTS.md` — what we are building and the definition of done (§5).
2. `docs/AI-GOVERNANCE.md` — what you may and may not do. Non-negotiable.
3. `docs/conventions.md` — layout, toolchain, style, tests, PR rules, fixture capture.
4. The ADR(s) governing what you are touching (map below). If your change contradicts an ADR, propose a superseding ADR in the same PR; do not silently diverge. Never edit the decision text of a decided ADR.

## ADR map by directory

| Path | Governing ADR(s) | Notes |
|---|---|---|
| `src/adapters/<site>.ts` | 0001 architecture, 0002 photo source | One file per site: `matches()`, `extract()` (JSON-first, DOM fallback), `toLargest()`. `listingId`/`address`/photo array. Add a site = new adapter + fixtures + tests; the core does not change. |
| `src/*.ts` core | 0001 architecture | Content script fetches (concurrency 4) → `fflate` zip → `<a download>`; popup is display-only; activation by `declarativeContent` (see URL patterns in 0001 §2). |
| `manifest.json` | 0001, 0004 | Permissions stay minimal: `activeTab`, `scripting`, `declarativeContent`, `downloads`. `version` must match the tag for releases (0004). |
| `fixtures/*` | 0002, 0003, 0006 | Human-captured, trimmed, anonymised, never full page HTML. Agents do NOT fetch listing pages (0003 §4). A fixture change is a human commit. |
| `docs/` | 0005, 0006 | ADRs, governance, conventions, review rubric. |
| `.github/` | 0005 | `pr-lint` (provenance), `review-agent` (Gemini Flash, full context), `ci` (lint/typecheck/test/build). |

## What this repo is NOT

- It is not a crawler, a "download all", or a background service. Activation is by URL on detail pages only, one listing per click, and it fetches only image URLs the page's own JSON or DOM named, from the page's own origin (0003). The vocabulary in features, docs and PR text reflects this.
- It has no server, no database, no cloud bill. There is no ops loop and no scheduled job (0005 §6). Do not propose one.

## Build and test

```
pnpm install          # first time
pnpm lint             # ESLint + Prettier
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest (adapter fixtures)
pnpm build            # esbuild -> dist/
pnpm package          # dist/ -> release zip (version-checked against the tag)
```

Load `dist/` unpacked at `chrome://extensions` to try it. Agents do not need a browser to be useful: adapter work is fixture-driven and test-driven.

## Review expectations

Every PR is gated by the review agent (0005): a Gemini Flash full-context pass against the seven-item rubric in `docs/review-rubric.md`, posting a review and failing on `blocking`. A model wrote or edited this file; read the rubric. CI runs `pr-lint` (one `agent:*` label + `Model:` line), the fixture tests, and the build.

## When you disagree with an ADR

Open the PR with a new `docs/adr/NNNN-<slug>.md` that supersedes the old one and explains why, plus the index update in `docs/adr/README.md`. Never edit a decided ADR in place.
