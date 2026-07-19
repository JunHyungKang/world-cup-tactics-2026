# Synthetic Persona Review — 2026-07-18

Status: `ADVERSARIAL DESIGN INPUT — NOT HUMAN USER EVIDENCE`

Three independent subagents reviewed the implemented Corner War Room as fictional
personas: a low-football-familiarity Korean mobile user, a set-piece coach and
data-sceptical judge, and a Korean web-product accessibility specialist. Their
responses are heuristic model output. They do not populate participant rows,
satisfy the five-user gate, prove memorability, or replace physical touch and
VoiceOver evidence.

## Consensus

- The first-screen tradeoff, `one more for the corner means one fewer for the
  break`, is the clearest focal element in this synthetic design critique.
- After selection, mobile users may miss the evidence and counterexample below
  the fold.
- A selected-zone contact count can be misread as an effectiveness or prevention
  score if its non-causal meaning appears after the number.
- The counterexample is the differentiator, but it needs one immediate sentence
  explaining why the shot record challenges the chosen priority.
- A screen reader needs contact/non-contact as text; a `data-contact` attribute
  alone is not an accessible explanation.

## Applied bounded changes

1. Added an in-flow `selection complete -> inspect record and counterexample`
   anchor after a duty choice; no automatic scroll or focus theft.
2. Put `not an effectiveness score` before the contact count.
3. Added a bounded counterexample verdict: the shot record did not contact the
   selected priority region, while explicitly refusing a prevention claim.
4. Added visible and accessible contact/non-contact text to the event transcript.
5. Replaced the compressed `central -> far` label with clearer Korean wording.

The product hierarchy and evidence artifact remain otherwise frozen. Human study
state remains `pending`; planning and demo copy may call this an adversarial
synthetic review, never a user result or preference score.

## Verification

- At this review checkpoint, repository verification was 54/54; the current
  canonical planning evidence is 68/68. Typecheck, build, harness, data,
  eligibility, planning, and pending-user-evidence audits pass.
- Core Chromium manager loop: 4/4 pass.
- Pre-release browser contract: 56/56 pass across Chromium, mobile Chromium,
  Firefox, and WebKit; deployment-bound BG-12 remains deferred.
- The repeated BG-03 parity probe exposed a reset-focus race. Reset had queued a
  next-frame focus move that could steal focus after a fast Enter action. The
  queued move was removed, then BG-03 passed 40/40 repeated runs across the four
  projects before the full 56/56 rerun.
