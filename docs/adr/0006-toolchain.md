# ADR-0006: Toolchain

Status: decided 2026-09-18.

## Context
An MV3 extension can be written in plain JavaScript with no build step. The value of a compile step here is the adapter interface (ADR-0001 §3): three implementations of one contract, exercised by fixture tests, in a repo where agents write most of the code and the reviewer reads diffs. Types make the contract enforceable and the diffs smaller.

Fixtures are the eval gate (ADR-0005 §4). A fixture is a copy of what a site sent to a browser: its full HTML is copyrighted markup and contains a real address, agent names and MLS identifiers.

## Decision
1. **TypeScript, strict.** `src/` compiled by **esbuild** with one config file (`build.mjs`), producing `dist/` with `manifest.json`, `background.js`, `content.js`, `popup.html`/`popup.js`, icons. No bundler framework, no CRXJS, no React; the popup is a small vanilla-TS document.
2. **Vitest** with `jsdom` for adapter tests: fixtures are parsed into a `Document`, `extract()` runs against it, assertions cover count, order, `listingId`, `address` and `toLargest()`.
3. **`fflate`** for zipping (small, synchronous `zipSync` is enough at v1's sizes). No other runtime dependency.
4. **pnpm**, Node 22, ESLint + Prettier at root, same configs as frontdesk where they apply.
5. **Fixtures are trimmed and anonymised**, at `fixtures/<site>/<id>/`: the embedded JSON block (photo URLs intact, address and people replaced with obviously fake values, other listing fields pruned to what the adapter reads) plus a minimal DOM slice for the fallback path. Never full page HTML. Captured by a human in their own browser with the console snippet in `docs/conventions.md`; the capture snippet does the pruning and replacement before anything reaches the clipboard.
6. **Scripts:** `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm package` (zips `dist/` as `listing-photo-saver-<version>.zip`, checking the version against the git tag when one is present).

## Consequences
- A build step exists; `dist/` is git-ignored and produced by CI for releases (ADR-0004).
- Adapter tests run in milliseconds with no network, so CI is fast and never touches the sites (ADR-0003).
- Fixtures are small, reviewable diffs; a site markup change shows up as a fixture update plus an adapter change in one PR.
- Photo URLs in fixtures are real CDN URLs. They identify a listing to anyone who resolves them; this is accepted because the same URLs are public on the listing page, and no address travels with them in the repo.

## Rejected
- **Plain JS, no build.** Loses the enforceable adapter contract; the reviewer gets less from every diff.
- **Vite + CRXJS.** Hot-reload for extensions is pleasant and is also a large dependency tree for a three-file build.
- **JSZip.** Works; larger than `fflate` and slower. Either is fine; one was chosen.
- **Full-page HTML fixtures.** Copyrighted markup and real personal data committed to a public repo, for no test value the trimmed form does not provide.
- **Playwright end-to-end tests against the live sites.** ADR-0003 §4.
