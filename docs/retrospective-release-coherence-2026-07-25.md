# Release-coherence retrospective — 2026-07-25

## Scope

Long-running conversion from Corner War Room to Corner Policy Lab, ending at the
candidate-release and final-submission harness.

## Observed evidence

1. The root candidate build served Policy Lab, but `scripts/build-release.mjs`
   still built the predecessor Vite app until the final harness was inspected.
2. `tests/final-e2e/final-manager-loop.spec.ts` and the invalid-data fixture
   initially exercised Corner War Room while local Policy Lab tests remained
   green.
3. After that repair, a second trace found `scripts/run-pre-release-browser.mjs`,
   the frozen-public demo recorder, narration inputs, captions, and the active
   interaction/judging documents still bound to Corner War Room.

These are not isolated copy errors. They are one browser/deployment/demo class of
failure: product promotion changed the canonical app without closing every
release consumer. A file-presence harness could therefore pass while different
products were built, tested, documented, and prepared for submission.

## User and judging impact

- A public URL could have shown a different product from the final browser report.
- A frozen-URL recording could have narrated the predecessor interaction over the
  promoted product.
- Judges could have found conflicting active documents in the public repository.
- Green unit and candidate-browser checks were too weak to prove final-submission
  consistency.

## Durable correction

Classification: `browser/deployment`, `demo`, and `submission`.

The existing project `retrospective` skill now requires a product-identity
closure after every promotion. A deterministic release-coherence audit is added
to `pnpm verify`; it binds the selected product to the build, invalid fixture,
browser, deployment, demo, and current-document surfaces. Predecessor artifacts
may remain only under `docs/archive/` and cannot satisfy the active harness.

## Claim boundary

This correction proves internal artifact identity. It does not prove a public
deployment, human usability, VoiceOver behavior, YouTube publication, or DAKER
submission.
