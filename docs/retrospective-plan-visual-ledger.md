# Retrospective — Planning Visual Ledger False PASS

Date: 2026-07-17 KST

Status: durable correction implemented; independent-agent document route added
without creating human evidence

## Observed failure

An adversarial data/compliance review showed that the planning preflight could
accept a `plan-visual-qa` row when it merely contained the expected PDF/source
hash substrings, `visual 8/8 PASS`, and a timestamp-shaped value. A future row,
duplicate row, wrong external status, anonymous placeholder reviewer, creator
self-review, extra cells, or a PASS mixed with a non-pass token was not reliably
rejected.

The defect had not promoted the current draft because eligibility is still
unresolved, but it could have converted a machine-rendered artifact into false
evidence of independent human visual inspection near the deadline.

## Root cause

The validator searched for evidence fragments inside free-form Markdown rather
than parsing the seven-cell ledger contract. It bound content hashes but did not
bind who reviewed which exact artifact path, when the review occurred relative
to artifact creation and the deadline, or whether contradictory status tokens
were present.

## Durable correction

`validateVisualQaLedger` now parses exact cells and rejects:

- missing or duplicate `plan-visual-qa` rows;
- a row with anything other than seven cells;
- a timestamp that is malformed, future-dated, after the plan deadline, or
  earlier than the PDF modification time;
- an artifact path, PDF/source hash cell, page count, Checks cell, or external
  status that is not exact;
- `FAIL`, `PENDING`, `SKIP`, or `N/A` anywhere in the row;
- Notes without `reviewer=<name> role=independent-human
  renderer=<tool/version> packet=<review-manifest-sha256>`;
- a packet manifest or any of its eight page-image digests that does not match;
  and
- placeholder or creator-role reviewer identities.

Regression tests exercise each rejected shape as well as the honest passing
shape and the production preflight path. `docs/submission-ledger.md` owns the
same machine-readable contract so deadline operators do not have to infer it
from code.

## Remaining intentional human boundary

Code can prove the row is internally consistent and bound to the final PDF. It
cannot prove that the named person actually inspected all eight rendered pages.
The owner must reserve an independent reviewer, retain the review evidence, and
record the row only after the review. The later `plan-submitted` and
`final-submitted` receipts likewise require an owner-observed official
confirmation; preflight cannot perform or invent those external actions. It now
validates either receipt whenever that optional post-submission row is present,
so malformed evidence cannot hide behind a green freeze-integrity rerun.

## 2026-07-19 amendment — remove the unnecessary reviewer dependency

The official planning requirement is a visually sound PDF, not a participant or
human-preference result. Requiring a real person after an independent subagent
had already inspected every exact render created an avoidable submission
dependency and conflicted with the owner-approved no-recruitment lane.

The validator now accepts either the original named-human attestation or a
distinct non-creator subagent route. The agent route fails closed unless a
canonical JSON review binds all eight packet page hashes, byte counts, 1404×993
dimensions, the exact criteria, zero findings, PDF/source/packet/renderer hashes,
and the review timestamp. Its ledger row says `role=independent-agent` and binds
the review SHA-256. It cannot be parsed or presented as human, participant,
usability, preference, comprehension, or memorability evidence. Owner-observed
DAKER upload/submission receipts remain irreducibly external.
