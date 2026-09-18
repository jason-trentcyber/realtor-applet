# Listing Photo Saver

A Chrome extension that saves the photo gallery of a real-estate listing you are looking at as a single zip file. Works on realtor.com, Zillow and homes.com listing detail pages. (The repo is named `realtor-applet` because that is where it started; it covers all three sites.)

It does what "Save image as…" does, for every photo in the gallery at once: the photos are the ones your browser already fetched to render the page. It does not crawl, does not run in the background, and does not talk to any server of its own.

**Personal use only.** Listing photos belong to the listing's photographer, brokerage or MLS. Save them for your own house hunt; do not republish them. See [ADR-0003](docs/adr/0003-scope-and-use-policy.md).

## Install (Chrome, unpacked)

1. Download `listing-photo-saver-<version>.zip` from the latest [GitHub Release](../../releases) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, pick the unzipped folder.
3. Open a listing detail page. The toolbar icon lights up; click it, then **Download ZIP**.

Not on the Chrome Web Store, by decision ([ADR-0004](docs/adr/0004-distribution.md)). Chrome only ([ADR-0001](docs/adr/0001-extension-architecture.md)).

## How it works, briefly

- Active only on detail-page URLs (`declarativeContent`); nothing is injected into the page's UI.
- A per-site **adapter** reads the listing's embedded JSON first and falls back to the gallery DOM, then rewrites CDN URLs to the largest size ([ADR-0002](docs/adr/0002-photo-source.md)).
- The content script fetches the photos, zips them with `fflate`, and hands the zip to the browser's normal download path.
- The zip is `<address>_<site>_<id>.zip` containing `01.jpg … NN.jpg` and a `listing.json` manifest (source URL, per-photo status). A missing photo is recorded, never fatal.
- Zero photos on a matching URL means the site changed its markup: the popup says so and offers a prefilled issue link (URL only, never page content).

## Built with an AI-first SDLC

The process is part of the deliverable, carried over from [frontdesk](https://github.com/jason-trentcyber/frontdesk-intake) and adapted to a repo with no server and no cloud bill:

| Guardrail | Here |
|---|---|
| Context pack | `CLAUDE.md`, `AGENTS.md`, `docs/conventions.md`, `docs/adr/` |
| Provenance | `pr-lint`: exactly one `agent:*` label + a `Model:` line on every PR |
| Blocking review agent | `review-agent`: Gemini Flash, one full-context request per push, posts a review and fails on blocking findings ([ADR-0005](docs/adr/0005-ai-first-sdlc-here.md)) |
| Eval gate | Adapter fixture tests: each site has trimmed, anonymised fixtures; a markup change fails CI |
| Governance | `docs/AI-GOVERNANCE.md` — who may do what; agents never contact the listing sites |
| Ops loop | None, by design: the only legitimate probe of these sites is a person using the extension |

## Develop

```
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm build        # -> dist/ (load this folder unpacked)
pnpm package      # -> listing-photo-saver-<version>.zip
```

Fixtures are captured by a human in their own browser (`docs/conventions.md` → Fixtures). Agents do not fetch listing pages.

## License

MIT.
