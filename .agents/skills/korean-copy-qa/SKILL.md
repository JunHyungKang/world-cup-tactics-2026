---
name: korean-copy-qa
description: Audit and revise Korean copy in the World Cup tactics product, planning PDF, gallery, demo, captions, and submission contracts. Use when Korean wording sounds translated, AI-generated, inconsistent, overly technical, or when a copy change must preserve facts, claim boundaries, accessibility names, tests, and hash-bound artifacts.
---

# Korean Copy QA

## Preserve Before Polishing

1. Preserve facts, counts, dates, IDs, source names, licenses, direct quotes, and
   forbidden-claim boundaries exactly.
2. Exclude official organizer quotes, historical review logs, evidence receipts,
   and third-party license text from rewriting.
3. Change only spans tied to a diagnosed problem. Keep the original register and
   keep the total wording change below 30 percent unless the user requests a
   rewrite.
4. Never make an observation sound causal, predictive, optimal, human-validated,
   or participant-preferred.

Read `references/benchmark.md` before the first audit in a session. It records the
adapted `im-not-ai` principles and the project-specific exceptions.

## Run The Loop

1. Run `pnpm copy:audit` and inventory Korean in the active surfaces with `rg`.
2. Inspect the canonical copy first:
   - `src/App.tsx` and `src/domain/cornerEvidence.ts`
   - `docs/submission-story.json` and `docs/demo-narration.json`
   - `docs/demo-script.md`, `docs/demo-captions.ko.srt`, and
     `docs/planning-outline.md`
   - `scripts/render-planning-draft.py` and
     `scripts/render-gallery-first-image.mjs`
3. Classify each finding as translationese, mixed-language leakage, unclear
   football terminology, missing spacing, UI-action mismatch, or claim-boundary
   risk. Do not edit clean spans.
4. Apply surgical edits to the canonical source, then update exact-string tests,
   capture locators, narration, captions, and planning references together.
5. Run `pnpm copy:audit`, `pnpm verify`, and
   `pnpm test:e2e:pre-release`.
6. If visible or hash-bound copy changed, regenerate screenshots, gallery,
   storyboard, planning PDF, narrated rehearsal, review packet, and owner
   handoff. Re-run independent document/copy review and submission preflight.

## Accept Only Evidence-Bound Copy

- Prefer `숏 코너`, `니어포스트`, `파포스트`, and `세컨드볼` when those names
  match the project-defined regions.
- Describe geometric overlap as overlap, not player reach, prevention, or
  tactical effectiveness.
- Keep source/event identifiers visible in Korean UI labels without changing the
  underlying IDs.
- Treat machine and synthetic-persona review as design input, never human user
  evidence.
- Record current wording decisions in the existing product thesis, decision
  registry, or submission contracts; chat-only approval is not durable state.
