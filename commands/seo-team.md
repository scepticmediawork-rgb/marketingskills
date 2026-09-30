---
description: Run the SEO team — dispatch the SEO subagents in parallel on a site or codebase and merge their findings into one prioritized plan
argument-hint: "[site URL, path, or SEO question]"
---

Run the **SEO team** on: $ARGUMENTS

If no target was given, ask for a site URL, a codebase path, or the SEO question to answer, then continue.

## 1. Get context

Read `.agents/product-marketing.md` (or `.claude/product-marketing.md`) if it exists. Ask only for what's missing and what changes the plan: the business goal for SEO, priority topics, target markets, and whether Search Console or SEO tool credentials are available.

## 2. Pick the squad

Seat only the specialists the question needs. For a full audit or "help with SEO," seat all five.

| Subagent | Seat when |
|----------|-----------|
| `seo-technical-auditor` | Rankings/traffic problems, indexing, speed, on-page, any full audit |
| `seo-keyword-strategist` | What to rank for, content gaps, topic clusters, briefs, comparison pages |
| `seo-site-architect` | Structure, URLs, internal linking, navigation, programmatic page sets |
| `seo-schema-specialist` | Structured data, rich results, or a teammate flagged schema to check |
| `seo-ai-search-specialist` | AI Overviews, ChatGPT/Perplexity/Claude citations, llms.txt, agent readiness |

## 3. Dispatch in parallel

Launch every seated subagent in a single message so they run concurrently. Give each one the target, the context from step 1, and its specific brief. Tell each one to diagnose only (no file edits) unless the user asked for implementation.

## 4. Merge

When they report back:

1. **De-duplicate** — merge findings that more than one specialist raised; keep the strongest evidence
2. **Resolve conflicts** — where specialists disagree (e.g. new pages vs. consolidating existing ones), state both views and pick one with a reason
3. **Prioritize** — rank by impact × effort, and put crawl and indexation blockers first because nothing else matters until they're fixed
4. **Route handoffs** — if a specialist flagged work for a teammate who wasn't seated, run that teammate now

## 5. Report

- **Summary** — the three changes that matter most, in plain language
- **Action plan** — one table: **# · Action · Owner (specialist) · Evidence · Impact · Effort**, grouped into *This week*, *This month*, *This quarter*
- **Not verified** — what couldn't be checked and what data would unlock it
- **Next step** — offer to implement the top items, or hand off to `copywriting` for page copy
