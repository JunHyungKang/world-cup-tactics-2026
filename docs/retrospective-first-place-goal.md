# Retrospective — From Technical Pass To First-Place Proof

Date: `2026-07-18 KST`

Status: `PRODUCT AND APPROVED HARNESS ACTIONS APPLIED`

## Evidence and impact

### What worked

- Fail-closed eligibility and data admission prevented the synthetic Touchline Lab
  shell from being mistaken for an evidence-backed product.
- Independent data and UX adversaries found material errors: corrected boundary
  sensitivity, missing straight-line disclosure, non-snapping role token, direct
  public-folder import, inaccessible invalid state, and final-contract surfaces.
- The pre-authored final browser contract turned those findings into reproducible
  proof. At this retrospective checkpoint the build passed 54 unit/contract
  tests; subsequent canonical verification is 68/68. The 56/56 pre-release
  contracts across Chromium, mobile Chromium, Firefox, and WebKit remain current.

### What failed or created drag

1. **Canonical state drift — harness/state management.** Eligibility and product
   implementation passed while active docs still said zero accepted sources,
   implementation unauthorized, or Touchline Lab current. Manual correction was
   repeated across the board, gate, thesis, planning source, README, and handoff.
2. **Final browser contract entered too late — browser/implementation.** The normal
   E2E slice was green while the existing final suite still required semantic
   snapshots, fixed aggregates, synchronized transcript metadata, invalid-data
   alert behavior, and reduced-motion evidence. Running it earlier would have
   avoided a separate correction loop.
3. **Unsupported runtime remained executable — reliability.** Corepack failed on
   a signature-key mismatch and Node 22.11 repeatedly warned below Vite's 22.12
   floor, yet direct commands could still appear green. The instructions already
   name a supported runtime, but enforcement is absent.

## Local-optimum check

The project is no longer blocked on visual polish, another feature, or another
dataset. The dominant uncertainty is human: whether fresh users understand the
role loss, discover and remember the counterexample, and avoid causal/reach/2026
misreads. D38 therefore rejects feature expansion before the primary and delayed
cohorts pass.

## Applied product actions

- Added `docs/first-place-goal.md` with measurable completion and stop conditions.
- Updated the differentiation gate and decision registry to current technical
  evidence and the human-proof bottleneck.
- Added anonymous `primary-wave-1` evidence, a fail-closed validator, and three
  adversarial tests. Pending rows cannot claim results; complete rows must satisfy
  device/familiarity diversity, exact summaries, `4/5` thresholds, and the
  misconception hard stop.

## Approved durable harness changes

### Proposal 1

Observed friction: canonical promotion left stale active-state claims in several
documents.

Evidence: manual searches found `zero accepted`, `Touchline Lab current`, and
`implementation unauthorized` after the accepted manifest, final product, and
strict promotion were already green.

Smallest surface: extend the existing project `scripts/check-harness.mjs`; do not
create a new skill.

Applied change: added semantic drift assertions that bind product-selection and
eligibility status to the active board, judge gate, README, and authoritative
handoff checkpoint, rejecting known stale-state markers.

Expected benefit: a canonical gate transition cannot pass `verify` while the
next session is told to resume an obsolete product state.

Risk or false-positive control: inspect only the authoritative top checkpoint and
current-status sections; allow stale wording inside explicitly historical logs.

### Proposal 2

Observed friction: the normal browser slice passed while final-contract surfaces
were missing.

Evidence: the first pre-release final run exposed semantic/failure/accessibility
gaps after the basic manager-loop tests were green.

Smallest surface: amend `.agents/skills/browser-acceptance/SKILL.md`.

Applied change: before claiming implementation/browser PASS, run the local final
suite excluding only release-bound BG-12, verify all configured browser runtimes
exist, and record which cases are deferred for a real deployment.

Forward-test result: the first required run reproduced a stale post-drag click
suppression flag that intermittently swallowed the next keyboard Enter action in
BG-02/BG-03. Limiting that flag to the pointer event turn removed the input-path
contamination; the rerun passed all 56 required cases.

Expected benefit: accessibility, semantic parity, invalid-data, and multi-browser
requirements enter the first implementation loop instead of the final freeze.

Risk or false-positive control: permit explicit pre-release exclusion only for a
case that structurally requires stamped deployment/release inputs; no functional
or accessibility case may be skipped.

No global skill, hook, or plugin change is warranted. The runtime warning is real,
but existing repository instructions already specify Node 22.12+ and bundled Node
24; enforce it in project build configuration during the release-hardening loop
rather than adding another harness surface now.

## Verification

- Browser-acceptance skill structure: official `quick_validate.py` PASS.
- Focused drift/user-study tests: 6/6 PASS.
- At this retrospective checkpoint, full repository verification under bundled
  Node 24 passed 54/54 tests and a 49-surface/7-skill harness. Subsequent
  canonical verification is 68/68 and 83 surfaces; typecheck, production build,
  manifest, eligibility, and planning audits remain PASS.
- Pre-release browser contract under bundled Node 24: 56/56 PASS across Chromium,
  mobile Chromium, Firefox, and WebKit; only deployment-bound BG-12 deferred.
