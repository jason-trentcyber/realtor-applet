# AI governance for Listing Photo Saver

This repo is built with AI coding agents alongside a human. These rules apply to Claude Code in the IDE, Hermes and its subagents, and any other agent that opens a PR.

## Who may do what

| Action | Human | Coding agents (Claude Code, Hermes subagents) | Review agent |
|---|---|---|---|
| Write application code | yes | yes | no |
| Open a PR | yes | yes | no |
| Approve / merge | yes | no | no |
| Capture or fetch listing-site content (fixtures, live checks) | yes (own browser) | **no** | no |
| Change ADRs / governance / convention policy | yes | yes, with a superseding ADR where the change is behavioural | no |
| Touch secrets (the `GOOGLE_API_KEY` repo secret) | yes | no | no |

## Provenance

- Every PR has exactly one `agent:*` label: `agent:human`, `agent:claude-code`, or `agent:hermes`.
- The PR template includes a `Model:` line; fill it with the real model id.
- `Co-Authored-By` trailers added by tools stay in the commit.
- **Dependabot is the one exemption** (0005 §3): its PRs carry no label/no model and skip the review agent, because bot identity is the provenance and its runs cannot read Actions secrets. Gated by `ci` plus a human reading the changelog.

## The listing sites (ADR-0003)

- Agents never contact realtor.com, zillow.com or homes.com: no fetching pages, no CI job that does, no scheduled probe.
- Fixtures are captured by a human in their own browser and anonymised before commit.
- The extension itself is a human, on demand, on detail pages only, saving what their browser already loaded.
- This rule is enforced by review (rubric item 6, blocking) and by the workflow: no CI step has network access to those hosts.

## Review agent rubric

Checks in order, `blocking` where noted:
1. Secrets or credentials in the diff (blocking)
2. Fixture files that are not trimmed/anonymised, or full page HTML committed (blocking)
3. Any code, test, or workflow change that fetches a listing site (blocking)
4. ADR compliance for the touched area (blocking if the change contradicts a decided ADR without a superseding ADR)
5. Tests present for new adapter/core behaviour (blocking)
6. Obvious injection / SSRF / path traversal in URL or filename handling (blocking)
7. Style and clarity, suggestions only

## Secrets

- No secrets in the repo. gitleaks runs in CI.
- Only secret here is `GOOGLE_API_KEY` (a repo Actions secret) consumed by `review-agent.yml`. Agents never see its value.

## Human-required decisions

- Anything that changes the ADR-0003 boundary (scope, sites, automation, personal-use policy).
- Adding Chrome Web Store distribution, a server component, analytics, remote config, or a third-party service.
- Changing the review model/provider.
- A fixture that cannot be anonymised.

## When an agent is wrong

Reject the PR with a reason. If the same mistake repeats, add the rule to `docs/conventions.md`, not to a chat.
