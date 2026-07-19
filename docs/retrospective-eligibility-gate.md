# Retrospective — Eligibility Evidence Is Not A Status String

Date: 2026-07-17 KST

Classification: submission eligibility + data/license admission.

## Observed evidence

The first eligibility validator correctly blocked the canonical unresolved state,
but independent QA reproduced promotion with fabricated alternate inputs, a DAKER-
shaped URL, manually flipped `accepted` statuses, arbitrary evidence strings, and
a pasted 2026-only marker. A second review still reproduced a self-authored answer
capture, a negated `허용되지 않습니다` quote, a tactical capability assigned to
fixture-only OpenFootball, and PASS receipts that were never executed.

These were harness failures, not evidence that any real organizer answer or data
source was invalid. Their judging impact would have been severe: a polished PDF
or build could appear eligible while the product's tactical core still violated
the official 2026 scope.

## Root cause

The harness treated declarative metadata as proof. It validated the shape of
status, URL, reviewer, and hash fields without binding them to live official
content, executable tests, source capability, public data lineage, or the final
release bytes. The earlier success fixture reinforced that local optimum by
teaching the test suite to accept fabricated override files.

## Durable correction

- Production plan/final preflight reads canonical repository files only.
- Official hybrid permission requires a live DAKER response whose bytes match a
  Git-tracked capture SHA and whose exact quote/author/role are rechecked within
  24 hours.
- Rights, capability, audit, test receipt, transform, test, and derived artifacts
  are individually SHA-bound and Git-tracked; accepted sources require cleared
  public submission uses and independently named review.
- Source-specific Vitest commands are argv arrays executed without a shell.
- OpenFootball lineage can own only fixture context, never a tactical 2026
  capability.
- `docs/product-selection.json`, planning/thesis hashes,
  `public/data/product-binding.json`, every public data file's source lineage,
  and `submission-build.json` carry the same route and source set.
- The 2026-only route rejects historical core lineage rather than trusting one
  scope marker.
- Regression tests preserve the reproduced failure cases; the successful route
  fixtures now exercise both file verification and test execution boundaries.

## Remaining uncertainty

Automation cannot decide the competition rule. The prepared official-board
question still needs owner approval, and a human must verify that any live answer
was interpreted faithfully. The canonical state therefore remains `unresolved`,
with planning and final promotion intentionally failing.
