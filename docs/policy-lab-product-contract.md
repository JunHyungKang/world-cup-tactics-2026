# Corner Policy Lab Product Contract

Status: `PROMOTED OFFICIAL CANDIDATE — PUBLIC CANDIDATE LIVE; FINAL STAMP PENDING`

## Product identity

Corner Policy Lab is a match-held-out scouting-policy stress test. It is not an
offline-RL value estimator, a defensive-effect simulator, or an optimal-tactics
recommender. The manager allocates scarce attention before seeing an excluded
match, observes where the historical deliveries actually went, inspects a
deterministic representative contradiction, and revises or abstains.

## Manager loop

1. See only summaries derived from the fixed 48-match group-stage reference set.
2. Allocate two scouting-attention tokens across four delivery lanes, or declare
   `판단 보류` because support is insufficient.
3. Declare `40%`, `50%`, or `60%` as the minimum delivery-location overlap that
   will count as meeting the policy's inspection criterion. This is not a
   defensive-success, shot-prevention, or win-probability threshold.
4. Lock the areas and criterion before the test match name or outcomes are visible.
5. Reveal every eligible corner from each still-sealed round-of-16 match.
6. Inspect location coverage, the predeclared criterion verdict, the full source-event ledger, and the deterministic
   representative contradiction.
7. Review the evidence path and forbidden-inference guardrail.
8. Save the policy, criterion verdict, coverage, and counterexample in an evaluation-receipt ledger.
   A receipt records an evaluation, not a claim that the policy changed. If the
   next selection differs, the two visible policy labels provide the actual diff.
9. After eight rehearsals, lock one final policy and reveal all eight untouched
   quarter-final-and-later matches without further revision.

### Judge Quick Trial

The primary judging path creates one immutable policy snapshot and applies it to
two sequential held-out audits. After two priorities are selected, `이 정책을
잠가 두 시험에 적용` commits that snapshot before any held-out identity or
outcome appears. `16강 8경기 평가 요약 공개` then evaluates all eight round-of-16
matches and creates eight match-specific receipts with the same policy
fingerprint and predeclared criterion. The final eight matches remain sealed and the selection controls
stay disabled. `같은 정책으로 봉인 검증 8경기 공개` applies the identical
snapshot once more; the final receipt states `정책 변경 0회`. The detailed
one-match-at-a-time revision loop remains available under progressive disclosure.
After the sealed receipt, the manager chooses `다음 미팅도 이 구역 유지`, `다음 미팅에서 우선 구역
수정`, or `다음 미팅 결정 보류` and saves one reason. This separate next-meeting note
cannot mutate the sealed policy, criterion verdict, overlap result, or receipts. The eight-activation
judge path never moves a match or changes the policy.

## Data invariants

- Source population is 603 World Cup 2018 corners across 64 matches.
- Forty-six placeholder endpoints are never converted into actions.
- The split is fixed before interaction: 48 reference, 8 rehearsal, and 8 final
  audit matches in ascending source match-ID order, which corresponds to the
  group stage, round of 16, and quarter-final-and-later tournament phases.
- The three match-ID partitions are pairwise disjoint.
- Revealed rehearsal or final-audit matches never enter the reference summary.
- All 557 valid-action corners appear exactly once across the fixed campaign.
- Segment classification is visible and fixed: group stage `397/436` (`91.1%`),
  round of 16 `84/89` (`94.4%`), and quarter-final-and-later `76/78` (`97.4%`).
- Reference-lane shares include adversarial lower/upper bounds that place all 39
  missing group-stage endpoints outside or inside the lane; no hidden imputation
  narrows those bounds.
- Shot and goal fields are post-decision observations only.
- The user score is delivery-location coverage, never shot prevention or match
  outcome change.

## Ontology contract

Allowed nodes are `MatchContext`, `ScoutingPolicy`, `CornerRestart`, `DeliveryAction`,
`ObservedEvent`, `OutcomeProxy`, and `Source`. Allowed edges describe recorded
membership, action, transition, outcome, and provenance. The graph is presented
as an evidence path and forbidden-inference guardrail, not as a reasoning engine.
The UI must expose the
forbidden relations `DEFENSIVE_DUTY_CAUSED`, `WOULD_PREVENT`, and
`OPTIMAL_POLICY` wherever a counterexample is interpreted.

## Fail-closed behavior

The report remains `REJECT` for causal policy recommendation because observed
action coverage is 557/603, team-level support is sparse, horizon ranking changes,
and the match-cluster confidence interval crosses zero. The app may still run the
historical stress test, but it must recommend no winning lane and must offer a
user abstention path.

## Promotion decision

An earlier exact-artifact comparison selected Policy Lab over Corner War Room;
that internal benchmark is not presented as a judge score. The promotion
preserves causal recommendation `REJECT`, empirical campaign `REVISE`, and human
evidence `unavailable/no-claim`. Public hosting and GitHub are live as candidate
evidence. YouTube, DAKER final submission, final commit binding, and final
public-URL browser evidence are still required before completion can be claimed.
