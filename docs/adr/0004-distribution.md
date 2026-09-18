# ADR-0004: Distribution

Status: decided 2026-09-18.

## Context
A Chrome extension reaches users either through the Chrome Web Store (developer registration, review process, policy compliance including the store's own rules on content-site interaction) or as an unpacked folder loaded in developer mode. The intended user is the author and anyone technical enough to read this repo.

## Decision
- Each tagged release publishes `listing-photo-saver-<version>.zip` as a GitHub Release asset, built by CI from the tag with `pnpm package` (ADR-0006). The zip is the built `dist/` folder: manifest, bundled scripts, popup, icons.
- Users unzip and **Load unpacked** at `chrome://extensions`. README carries the three steps.
- Not submitted to the Chrome Web Store. No store listing, no store screenshots, no developer account.
- Version is the `manifest.json` `version` field; the tag is `v<version>`; CI fails if they disagree.

## Consequences
- Chrome shows the "developer mode extensions" notice; accepted.
- No auto-update. Users re-download. The popup shows the installed version so a drift report (ADR-0002) names it.
- Release provenance is the GitHub Actions run that built the asset, visible from the release page.

## Rejected
- **Chrome Web Store.** Review process and store policy would put the ADR-0003 question in front of a reviewer whose answer we do not control, for a single-user tool.
- **Self-hosted CRX with `update_url`.** Chrome ignores `update_url` for non-store extensions on stable channel; no benefit over the zip.
- **Committing `dist/` to the repo.** Built artifacts in git obscure the diff the review agent reads.
