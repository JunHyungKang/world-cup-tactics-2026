# Organizer Data-Scope Question

Status: `WITHDRAWN — NOT NEEDED`

Purpose: preserved historical record of the question prepared before the official
DAKER Data-tab rule was discovered. It was never sent. The first-party competition
record now explicitly says there is no restriction on a specific year,
tournament, or player composition, so posting this question would add delay and
ambiguity rather than resolve one.

Latest useful posting time: `2026-07-18T12:00:00+09:00`

Owner decision required: none. Do not post this withdrawn question unless the
official Data-tab wording materially changes.

## Canonical message

Post the exact UTF-8 subject/body bytes in
`docs/organizer-data-scope-message.txt`. Do not retype from chat or paraphrase
inside the board composer. Current SHA-256:
`5913d595426f2de71208ac9eb6ce8c1874da7c8b3e3e13971e2647142e431d71`.
Recompute it immediately before posting and record the matching value in the
posting evidence.

## Posting receipt

Immediately after the owner posts, record all of the following without changing
the question wording or claiming that posting is an answer:

- exact public/authenticated board URL;
- DAKER post ID if shown;
- owner-observed RFC3339 KST posting time;
- screenshot SHA-256 or exported page bytes SHA-256;
- Markdown status `POSTED — AWAITING ANSWER`;
- `question_status: posted-awaiting-answer` plus a `question_evidence` object in
  the canonical resolution state, containing the URL, shown post ID or `null`,
  real owner identity, posting time, repo-contained capture path/SHA-256,
  canonical posted-message path/SHA-256, and an owner content-review receipt.

The content-review JSON must bind the exact question URL/post ID, owner,
capture SHA-256, full canonical message SHA-256, and exact `A 구성` proposition
SHA-256; it must say `wording_matches: true` only after comparing the visible
post with the canonical file. This supports either an exported HTML/text capture
or a screenshot without pretending OCR is proof.

After posting, first run the recorder without `--apply`. Replace every angle
placeholder; use `--post-id none` only when the board exposes no stable ID:

```bash
pnpm eligibility:record-question -- \
  --question-url <EXACT_POST_URL> \
  --post-id <POST_ID_OR_none> \
  --owner <REAL_OWNER_NAME> \
  --posted-at <RFC3339_KST> \
  --reviewed-at <RFC3339_KST> \
  --capture-path <OWNER_OBSERVED_SCREENSHOT_OR_EXPORT> \
  --confirm-wording-match I_CONFIRMED_VISIBLE_POST_MATCHES_CANONICAL_MESSAGE
```

Inspect the dry-run bindings, compare the visible post to the canonical message
again, then rerun the same command with `--apply`. The recorder refuses the
wrong source state, missing/duplicate/unknown options, an omitted explicit
`--post-id`, non-`+09:00` or future/reversed times, generic URLs, placeholder
owners, symlinks, empty/unsupported captures, the canonical local message reused
as its own capture, missing confirmation, or existing evidence files. Text/HTML
captures must contain the exact post URL or ID, subject, and A proposition;
screenshots retain the explicit owner wording-parity boundary. It does not post,
stage, or commit anything. Apply writes through temporary files and rolls the
state, Markdown, capture, and review back together if a late write/rename fails.
Capture/review publication uses same-filesystem no-replace links, so a file that
appears concurrently is preserved rather than overwritten or removed. An
incomplete rollback is reported distinctly instead of claiming recovery.

After `--apply`, inspect the four changed/generated artifacts, stage exactly the
paths printed by the command, and run `pnpm eligibility:audit`. The audit stays
red for an untracked capture by design.

Do not record browser-draft text, a local screenshot, or a generic board URL as
proof that the question was posted.

## Answer admission checklist

An answer may promote Route H only when every item is captured:

- exact answer URL and response bytes;
- exact quote that affirmatively permits the proposed 2026-context plus
  clearly-labeled historical-tactical combination;
- responder identity and evidence that the responder represents the organizer;
- owner semantic review confirming that the answer is not conditional,
  ambiguous, or answering a different question;
- RFC3339 KST `checked_at`, content SHA-256, and the canonical tracked capture;
- all three route sources independently admitted by the data contract.

An answer such as “actual World Cup data is allowed” is not sufficient if it
does not resolve whether the tactical core may be historical. Silence, a reply
from another participant, or a positive reaction icon is not an official answer.

## Decision rule

- If the organizer confirms that clearly labeled historical World Cup tactical
  evidence plus rights-cleared 2026 match context is eligible, retain Corner War
  Room and quote the confirmation in the submission ledger.
- If 2026 tactical evidence is mandatory, do not imply compliance. Keep the
  historical concept out of the final submission unless a rights-cleared 2026
  tactical source passes the data gate; otherwise switch or withdraw the thesis.
- If no qualifying answer is captured by `2026-07-23T18:00:00+09:00`, Route H
  remains blocked. Do not submit the historical-core planning PDF merely with a
  disclosure. Promote only an admitted Route T replacement; otherwise escalate
  the plan-submission go/no-go decision to the owner.
