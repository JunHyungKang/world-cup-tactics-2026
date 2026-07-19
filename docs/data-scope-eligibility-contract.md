# Data-Scope Eligibility Contract

Status: `SCOPE CONFIRMED — DATA ADMISSION PENDING`

The official DAKER Data-tab record explicitly says that player, team, and match
data have no restriction on a particular year, tournament, or player
composition. This specific rule resolves the broader 2026 tagline: clearly
labeled 2018 historical tactical evidence is eligible without a separate board
answer. External sources must still have commercially usable rights.

Machine state lives in `docs/data-scope-resolution.json`. Run:

```bash
pnpm eligibility:audit
node scripts/check-eligibility.mjs --promotion
```

The first command validates the scope-confirmed state and its canonical official
evidence. The second still fails until the selected sources, transformations,
tests, independent audit, and deployed lineage pass. Both planning and final
submission preflight call the strict promotion validator.

## Route O — official open year scope (selected)

1. Preserve the exact first-party API URL, record `updatedAt`, quote, canonical
   stable-field hash, and a SHA-bound `docs/official-state.md` capture.
2. Mark the unsent organizer question `WITHDRAWN — NOT NEEDED`; never imply a
   board response was received.
3. Use historical evidence only with its actual year and limitation. It must not
   be described as a 2026 tendency or prediction.
4. Admit each external source independently. The DAKER rule resolves competition
   scope but does not grant third-party data rights.
5. Promotion remains blocked until the selected product data and all required
   source evidence are accepted and content-bound.

## Honest question states

Before posting, the Markdown and canonical JSON must say `DRAFT — NOT SENT` and
`draft-not-sent`, with `question_evidence: null`. After an owner-approved post,
they must say `POSTED — AWAITING ANSWER` and `posted-awaiting-answer`. The latter
requires a non-placeholder DAKER board URL, shown post ID or `null`, real owner,
non-future posting time, a Git-tracked repo-contained capture path/SHA-256, the
canonical `docs/organizer-data-scope-message.txt` bytes/SHA-256, and a tracked
owner content-review receipt. The receipt binds URL/post ID/owner, capture hash,
full posted-message hash, exact A-proposition hash, wording parity, and review
time after posting.

Both states remain `unresolved`; strict promotion fails in either case. A posted
status without the bound bytes, a root/generic board or competition URL,
unrelated message bytes, altered A proposition, missing capture/review, hash
mismatch, untracked artifact, or status-only JSON edit fails the honest-state
audit.

## Route H — organizer-confirmed hybrid (fallback only)

Use Corner War Room only if all conditions hold:

1. the prepared question is posted to the official DAKER board with owner
   approval;
2. an official `daker.ai` answer explicitly permits rights-cleared 2026 context
   plus clearly labeled historical World Cup tactical evidence;
3. the non-placeholder board URL, exact positive authorization quote, organizer
   author/role, owner-reviewed disposition, 24-hour check time, Git-tracked raw
   capture hash, and quote-hash-bound owner semantic checklist are recorded;
4. the OpenFootball 2026 fixture transform and both Figshare 2018 evidence
   sources are `accepted`, each with cleared rights, structured capability,
   independent implementer/reviewer, and Git-tracked rights/capability/transform/
   test/audit/derived/receipt artifacts whose individual SHA-256 values reproduce
   and whose bound Vitest argv passes again at promotion;
5. the product continues to say `2018 historical rehearsal`, never a 2026 team
   tendency or 2026 tactical recommendation.

## Route T — 2026 tactical-only pivot (fallback only)

An organizer answer is unnecessary only if the historical core is replaced:

1. the product thesis contains the exact marker
   ``Product data scope: `2026-tactical-only` ``;
2. at least one rights-cleared 2026 tactical source is accepted with the full
   acceptance-evidence bundle;
3. the question is marked `WITHDRAWN — NOT NEEDED` and no answer is fabricated;
4. fixture-only OpenFootball data cannot count as tactical evidence.

## Forbidden shortcuts

- changing a manifest record to `accepted` without acceptance evidence;
- citing an unofficial or non-DAKER answer;
- presenting a 2026 schedule badge beside a 2018 calculation as `2026-based`;
- using OpenFootball fixtures to support formation, pressure, event, or tactical
  claims;
- promoting the plan because the PDF or browser harness passes while data scope
  or source admission remains unresolved.
- passing alternate eligibility, official-state, question, thesis, planning, or
  manifest paths to production preflight;
- changing a scope marker without matching canonical file hashes,
  `docs/product-selection.json`, `public/data/product-binding.json`, and the
  release build marker;
- using a non-normalized, traversing, absolute, backslash, or symbolic-link data
  path, or omitting a selected data file from the deployed `dist/data` tree;

The validator prevents accidental state drift and binds the final build to the
same eligibility files. A human must still read the live official answer and
verify that the recorded quote is faithful before changing the resolution state.
