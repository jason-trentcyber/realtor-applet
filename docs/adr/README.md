# Architecture decision records

Format: context, decision, consequences, alternatives rejected. One file per decision. Superseding an ADR means a new file that references the old one; never edit a decided ADR's decision text.

| # | Title | Status |
|---|---|---|
| 0001 | Extension architecture: MV3, Chrome only, per-site adapters, content script fetches and zips | decided |
| 0002 | Photo source: embedded listing JSON first, gallery DOM fallback, per-site CDN upsizing | decided |
| 0003 | Scope and use policy: personal use, detail pages only, no automation, agents never contact the sites | decided |
| 0004 | Distribution: GitHub Release zip loaded unpacked; no Chrome Web Store | decided |
| 0005 | AI-first SDLC here: frontdesk's mechanics with a Gemini Flash full-context review agent, fixture tests as the eval gate, no ops loop | decided |
| 0006 | Toolchain: TypeScript, esbuild, Vitest, `fflate`, trimmed anonymised fixtures | decided |
| 0007 | Service-worker fetch relay for CDNs that refuse page-origin fetch (supersedes one ADR-0001 clause; homes.com) | decided |
