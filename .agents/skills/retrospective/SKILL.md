---
name: retrospective
description: Turn product failures, repeated manual work, and judging evidence into durable World Cup tactics harness improvements.
---

# Retrospective

1. Record observed evidence and user/judging impact; keep hypotheses uncertain.
2. Classify the failure: concept selection, football logic, data/license,
   interaction/UX, implementation, browser/deployment, demo, or submission.
3. Put the smallest durable fix in `AGENTS.md`, a repo skill, a tested script,
   domain code/test, or the decision registry.
4. If a failure changes what should be built, update `product-gate`; prose alone
   is insufficient for a repeated reject condition.
5. Check for local-optimum behavior: polishing visuals while the manager choice,
   data credibility, or feedback loop remains weak.
6. After any product promotion, close the product-identity chain before trusting
   green tests. Trace the selected product through `package.json` dev/build
   commands, candidate and stamped builders, invalid fixture, pre-release and
   final browser suites, Pages workflow, demo capture/narration/captions, and
   current judging/interaction documents. Archive or reject predecessor surfaces;
   do not keep them as active harness dependencies.
7. Put this identity check in a deterministic command called by `pnpm verify`.
   A file-existence audit or a passing predecessor suite is not sufficient.
8. Before public deployment, run the release builder from an isolated snapshot
   containing only Git-tracked and explicitly nonignored evidence. The default
   suite may read committed derivatives and tracked contracts only. Keep ignored
   raw inputs, local media, generated PDFs, handoff packets, and external
   receipts in explicit reproduction or submission lanes that fail closed when
   invoked; never make a default test silently skip because one is absent.
9. Run `pnpm verify` and `pnpm submission:drill`, list remaining risks, and select
   the next concrete artifact.
