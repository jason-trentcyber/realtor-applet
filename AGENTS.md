# AGENTS.md

Instructions for any AI coding agent (Claude Code, Codex, OpenCode, Qwen, Hermes subagents) working in this repo. Claude Code reads `CLAUDE.md`; this is the vendor-neutral copy plus provenance rules.

## Start here
Read in order: `REQUIREMENTS.md`, `docs/AI-GOVERNANCE.md`, `docs/conventions.md`, then the ADR for the directory you will edit (map in `CLAUDE.md`).

## Provenance (required, enforced by CI)
- Exactly one label: `agent:claude-code`, `agent:hermes`, or `agent:human`. Hermes subagents use `agent:hermes`. Non-Claude CLI agents driven by Jason use `agent:human` with the tool named in the PR body.
- Fill the `Model:` line in the PR template with the actual model id.
- Keep `Co-Authored-By` trailers; never strip them.
- model budget PRs: this repo's reviewer is free, so the frontdesk `model:budget` extra-pass rule does not apply here (0005 §3). The human gate and the review agent gate always apply.

## Policies that are easy to violate here
- **Never fetch a listing site.** No crawling realtor.com, zillow.com, homes.com, running their pages, or adding a job/step that does either (0003 §4, blocking rubric item 6). Fixture capture is human-only.
- One adapter file per site behind the interface + fixtures; do not branch the core on site name (0001).
- Leave the repo runnable: `pnpm lint && pnpm typecheck && pnpm test` green before opening the PR.
- Never commit full page HTML from a listing site; fixtures are trimmed and anonymised (0006 §5).
- No new runtime dependencies without an ADR note; no generated `dist/` committed.

## When you disagree with an ADR
Same as frontdesk: new superseding ADR in the same PR, index updated. Never edit a decided ADR's decision text.
