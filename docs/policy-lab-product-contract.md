# Corner Prep Lab Product Contract

Status: `PROMOTION IN PROGRESS — PRODUCT AND MOBILE PASS; SOURCE AND RELEASE BINDING REQUIRED`

## Product identity

Corner Prep Lab is a historical match-preparation rehearsal for one named
matchup. It is not a success predictor, an optimal-tactics recommender, or a
simulation of player positioning. The manager reads Portugal's attacking-corner
records and Uruguay's defensive-situation records separately, allocates ten
training repetitions, locks the allocation, and then inspects a held-out match.

## Manager loop

1. See Portugal's `14/14` classifiable group-stage attacking corners and
   Uruguay's `5/6` classifiable group-stage defensive situations.
2. Compare three deterministic recorded categories:
   `숏 구역 전달`, `비숏·공중 후속 기록`, and `비숏·기타 후속 기록`.
3. Open evidence only when needed: source-linked kicker, first recorded
   follow-up actor, first-event team role, event type, and ten-second shot record.
4. Allocate exactly ten rehearsal repetitions. There is no default or model
   recommendation.
5. Lock the allocation before the historical Uruguay–Portugal match is visible.
6. Reveal the held-out `5 / 2 / 3` record, raw differences, three event receipts,
   and the `4/10` ten-second shot context.
7. Save the next meeting decision and reason without changing the allocation or
   revealed records.

The official demonstration uses `5 / 4 / 1`, the largest-remainder conversion
of Portugal's visible `7 / 5 / 2` group-stage counts to ten repetitions. It is a
reproducible demonstration choice, not an optimal allocation.

## Data and semantic invariants

- The wider transform contains 603 World Cup 2018 corners across 64 matches;
  557 endpoints are classifiable and 46 remain unclassified.
- The wider audit retains the fixed `48 → 8 → 8` match split. The product's
  first historical example is selected by the lowest source match ID in the
  fixed round-of-16 partition, not by its result.
- Portugal's attack record is `7 / 5 / 2`; Uruguay's separate defensive-situation
  record is `2 / 2 / 1`, with one additional unclassified endpoint.
- The hidden Uruguay–Portugal attack record is `5 / 2 / 3`.
- The two teams are never pooled into one success rate or matchup recommendation.
- `playerId` identifies the player associated with a recorded source event. The
  UI must say `첫 후속 기록의 선수` or `첫 수비 기록`; it must never say
  receiver, physical first contact, duel winner, marking assignment, or reach.
- Event IDs, offsets, team roles, event/sub-event names, deterministic selection
  rules, and join status remain bound in the public derivative.
- A count of ten-second shots is a subsequent historical record, not an effect
  attributed to the manager's allocation.

## Knowledge-graph boundary

The evidence path may connect `Team`, `Match`, `CornerRestart`, `CornerTaker`,
`RecordedSituation`, `RecordedFollowUp`, `RecordedShot`, and `SourceReceipt`.
Allowed edges mean only source-recorded association and provenance.
`WOULD_PREVENT`, `OPTIMAL_TACTIC`, `MARKED_BY`, and `CAUSED_SUCCESS` remain
forbidden.

## Fail-closed behavior

The release must not build unless Events, Matches, and Players are all
rights-cleared and accepted in `data/source-manifest.json`. Missing player joins,
duplicate player IDs, invalid names, a non-PASS situation artifact, or an invalid
bound report must stop the build or show an error page. No synthetic replacement
record is allowed.

## Planning consistency

Validation rejected the planning PDF's two-role, two-area hypothesis because the
team-conditioned proper-score gain disappeared when reduced to the two displayed
areas. The implementation keeps the submitted scarce-resource choice,
precommitment, hidden evidence, counterevidence, and next-meeting decision, but
moves the visible action onto admitted team-event records. The correction is
stated in-product and in `docs/product-thesis.md`.

## Promotion decision

Product meaning, Korean copy, desktop interaction, and mobile first-action flow
are `PASS`. Promotion still requires Players acceptance evidence, canonical
static-build binding, the rebuilt multi-browser matrix, new gallery and video
artifacts, and exact public-deployment verification. Causal recommendation
remains `REJECT`; the wider empirical campaign remains `REVISE`.
