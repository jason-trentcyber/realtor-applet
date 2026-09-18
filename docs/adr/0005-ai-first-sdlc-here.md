# ADR-0005: AI-first SDLC in this repository

Status: decided 2026-09-18.

## Context
frontdesk (`jason-trentcyber/frontdesk-intake`, its ADR-0008) established six guardrails for building with coding agents alongside a human: a context pack agents must read, provenance labels on every PR, a blocking review agent, an eval gate, a governance document, and an operations loop. That repo has services, a database, a cluster and a cloud bill. This one has a zip of JavaScript. The question is which mechanics transfer unchanged, which change shape, and which do not apply.

frontdesk's review agent runs Claude Code headless with `Read`/`Grep`/`Glob` against the checkout, capped at $1 per push, ~$0.25–0.75 observed per PR. It has two known false-positive classes: it reports "X is missing" for files that exist on `main` but are not in the diff, and it cites superseded ADRs as current. Both come from seeing the diff without the whole context pack. The author wants this repo's reviewer to cost nothing.

## Decision
1. **Context pack — unchanged.** `CLAUDE.md`, `AGENTS.md`, `REQUIREMENTS.md`, `docs/conventions.md`, `docs/AI-GOVERNANCE.md`, `docs/adr/`. Same read-first order, same "supersede, never edit" rule for ADRs.
2. **Provenance — unchanged.** `pr-lint.yml` copied from frontdesk: exactly one of `agent:human`, `agent:claude-code`, `agent:hermes`; a filled `Model:` line; `Co-Authored-By` trailers kept. Dependabot is exempt for the same reasons as frontdesk's ADR-0011 (bot identity is the provenance; its runs cannot read Actions secrets), stated here rather than in a separate ADR because it is inherited, not decided anew.
3. **Review agent — same contract, different engine.** `review-agent.yml` posts a review and fails the check on any `blocking` finding, using the same JSON schema and the same seven-item rubric shape (`docs/review-rubric.md`, adapted). The engine is **Gemini 2.5 Flash via the Generative Language API, non-agentic**: one request per push containing the rubric, the *entire* context pack, the changed-files list and the diff (capped at 150 KB, with the truncation flagged), with `responseSchema` enforcing the output. Free tier. The API key is a repo Actions secret set by a human. If the API errors or the quota is exhausted the check fails with the reason; it never passes silently.
4. **Eval gate — becomes fixture tests.** Each adapter has fixtures (ADR-0006) and tests asserting photo count, order, `listingId`, and `toLargest()` on every known URL pattern. `pnpm test` is a required check. A fixture change is a human commit and is called out in the PR body, as `evals/baseline.json` was in frontdesk.
5. **Governance — adapted.** `docs/AI-GOVERNANCE.md` drops the cluster/secrets/tenancy rows and adds the ADR-0003 rule: agents never contact the listing sites.
6. **Ops loop — none.** There is no deployment and no telemetry. Runtime drift is reported by the person using the extension (ADR-0002 §drift). This is a deliberate absence, not an omission.
7. **Project management — issues and milestones only.** Five milestones (scaffold, realtor, zillow, homes.com, release). No Projects board.
8. **Division of labour.** Hermes: ADRs, context pack, CI, issues, briefs, review on request. Jason drives a coding agent interactively for extension code. Humans capture fixtures and verify against live sites. Nobody merges but a human.

## Consequences
- The reviewer sees every ADR and every rule on every run, which removes the "missing file" and "superseded ADR" false positives by construction. It cannot open a file that is not in the prompt; for this repo the whole pack is a few thousand tokens, so nothing is left out.
- Review cost is zero; the free tier's rate limits are far above this repo's PR volume. Google's free-tier terms allow prompt use for training; the repository is public, so nothing enters the prompt that is not already published.
- Swapping the engine while keeping the rubric and posting contract is itself evidence that the guardrail is not vendor-bound; the two workflows can be diffed side by side.
- Fixture tests as the eval gate means the gate is only as good as the fixtures; keeping them current is a human task and is listed as such.

## Rejected
- **Claude Code headless (frontdesk's engine).** Works, but costs real money per push; the author asked for free. The rubric and contract are kept so it can be swapped back by changing one job.
- **Gemini CLI agentic (`run-gemini-cli` action).** Closest analog to the Claude setup, but adds a tool-using loop, output-format wrangling and the same "sees the diff, greps the rest" failure mode. Full-context is simpler and better here.
- **DeepSeek / Qwen via OpenRouter.** Cheap but metered; the author's standing rule is to avoid paid OpenRouter spend when a free path exists.
- **Skipping the review agent because the codebase is small.** The guardrail is one of the deliverables.
- **A Projects board.** Ceremony this repo's size does not justify.
