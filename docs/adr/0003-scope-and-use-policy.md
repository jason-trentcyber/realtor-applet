# ADR-0003: Scope and use policy

Status: decided 2026-09-18.

## Context
Listing photos are copyrighted by the photographer, brokerage or MLS. The sites' terms prohibit automated access and bulk collection. This repository is public and carries its author's name. The line between "a person saving photos from a page they are looking at" and "a scraper" is drawn by behaviour, and the behaviour has to be visible in the code and stated in the docs.

Separately, the AI-first SDLC (ADR-0005) involves coding and review agents. An agent that "checks whether the selector still works" by fetching realtor.com from a CI runner is a bot hitting a site that forbids bots, from a datacenter IP, under this repo's name.

## Decision
1. **Personal use.** The extension is for a person saving the gallery of a listing they are viewing, for their own use. README states this; the zip's `listing.json` records the source URL so provenance travels with the photos. No redistribution guidance beyond "don't".
2. **Detail pages only, one listing per click.** Activation patterns (ADR-0001) exclude search results, map views, saved lists and any page that enumerates listings. There is no "save all results" and there will not be one.
3. **Only what the page already loaded, from the page's origin.** The extension fetches image URLs the page's own JSON or DOM named, from the page's own origin, on a user click. It does not call listing APIs, does not page through galleries server-side, does not run on page load, and has no background schedule.
4. **Agents never contact the listing sites.** No CI job, review agent, coding agent, Hermes cron, or subagent fetches realtor.com, zillow.com or homes.com. Fixtures are captured by a human in their own browser and anonymised before commit (ADR-0006). This is written into `docs/AI-GOVERNANCE.md` and is a blocking review-rubric item.
5. **No scheduled probes, no ops loop.** Drift is detected by fixture tests in CI and by the extension reporting zero photos to the person using it (ADR-0002 §drift). There is nothing to operate.
6. **Public vocabulary.** README, manifest, issue titles and PR text say "save", "photo gallery", "listing". Not "scrape", "bulk download", "download all", "crawler".

## Consequences
- The repo can stay public under the author's name with a defensible, visible boundary.
- Some conveniences are permanently out (multi-listing save, background prefetch).
- Fixture capture is manual and human-gated; the number of fixtures stays small on purpose.
- Anyone forking to add crawling has to remove stated policy and change the activation rules; the diff would show it.

## Rejected
- **Private repo.** Removes the reputational exposure and also removes the portfolio value, which is the second deliverable.
- **Public repo, no policy statement.** Leaves the reader to decide what this is; the point is to decide for them.
- **Scheduled selector health checks in CI.** Would make the repo's own automation violate the sites' terms and would fail on anti-bot measures anyway.
