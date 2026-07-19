# Retrospective — Missing Posted-Awaiting-Answer State

Date: 2026-07-18 KST

Status: durable correction implemented

## Observed failure

The owner posting packet required `question_status: posted-awaiting-answer` plus
URL, time, and capture evidence. Eligibility schema v2 allowed an unresolved
state only when both Markdown and JSON still said the question was unsent. An
honest post would therefore make the audit fail, while leaving the old value
would falsely erase the external action.

No post had been made, so no evidence was lost or mislabeled. The mismatch was
found by comparing the runbook transition against the validator before owner
approval.

## Impact and root cause

The state machine modeled three outcome labels—unresolved, hybrid, and 2026-only
—but collapsed the asynchronous middle of an organizer inquiry. Documentation
added an operational transition without a corresponding tested canonical state.

## Durable correction

Schema v3 distinguishes:

- `draft-not-sent` with no posting evidence;
- `posted-awaiting-answer` with exact Markdown status and a DAKER URL, optional
  shown post ID, real owner, non-future posting time, and repo-contained
  SHA-bound capture plus canonical posted-message bytes and a SHA-bound owner
  content review tying the visible post to the exact A proposition;
- `answered` only inside the fully evidenced hybrid route; and
- `withdrawn-not-needed` for the admitted 2026-tactical-only route.

The honest-state audit now verifies posted capture bytes/hash, canonical message
markers, exact proposition hash, owner wording-parity receipt, and Git tracking.
The URL gate rejects root/generic board pages. Regression tests reject
status-only edits, broad URLs, unrelated tracked bytes, altered A wording,
missing bytes, hash drift, and untracked artifacts. Strict promotion still fails
for both unresolved states.

`scripts/record-organizer-question.mjs` turns this transition into an explicit
dry-run/apply workflow. It accepts only an owner-observed post URL, times,
identity, capture, and exact wording confirmation; derives every hash and review
receipt; refuses overwrite; and leaves Git staging/commit to an explicit later
action. Its option allowlist makes `--post-id none` deliberate rather than an
omission fallback, timestamps must be RFC3339 KST, and capture bytes cannot equal
the canonical local message. A temporary-repository test proves dry-run has no
writes, injected late failure rolls every output back, invalid inputs fail, and
apply emits a validator-compatible three-artifact chain. Evidence publication
uses hard-link no-replace semantics: a simulated raced-in final file is neither
overwritten nor removed by rollback. Restoration results are checked, and an
empty directory created by a failed transaction is removed. The exclusive lock
is ownership-tracked: contention leaves another recorder's exact lock bytes
untouched, and rollback removes only a lock acquired by this transaction.

## Remaining human boundary

The owner must approve and perform the external post. A valid receipt proves
which bytes were recorded, not that DAKER will answer or that a later answer
authorizes the hybrid. Route H still requires the independent answer, semantic,
rights, source, and product bindings.
