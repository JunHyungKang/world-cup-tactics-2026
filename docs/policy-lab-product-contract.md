# Corner Prep Lab Product Contract

Status: `PROMOTION IN PROGRESS — FIVE-SIGNATURE PRODUCT PASS; CANONICAL RELEASE RESET`

## One-sentence product

Corner Prep Lab compares Portugal's repeated recorded corner sequences with
the corner situations Uruguay had already defended, lets a manager lock two
training questions before the historical matchup is shown, and then opens the
first shot-bearing counterexample outside that choice.

It is not a location-frequency dashboard, a weakness detector, an optimal-tactic
recommender, or a player-position simulation.

## Why this is team analysis

The unit of analysis is not a pitch area alone. Each admitted scene binds:

1. a named attacking or defending team;
2. the corner taker;
3. the restart family: short, aerial follow-up, or other non-short;
4. the team of the first recorded follow-up;
5. the first recorded attacking and defending actors when present;
6. a ten-second attacking-shot record; and
7. match, corner, and follow-up source IDs.

The app asks three team-specific questions in order:

`Portugal repeated what? → Uruguay had faced what? → What appeared in their matchup?`

This is a descriptive comparison of event chains. It becomes a training agenda
only when the manager chooses two questions. The data does not choose them.

## Canonical manager loop

1. See Portugal's `14/14` classifiable group-stage attacking corners and
   Uruguay's `5/6` classifiable group-stage defensive exposures as separate
   records.
2. Compare five exact `restart family × first recorded follow-up team`
   signatures:

   | Signature | Portugal | Uruguay |
   |---|---:|---:|
   | short + attacking first | 7 | 2 |
   | aerial + attacking first | 1 | 2 |
   | aerial + defending first | 4 | 0 |
   | other non-short + attacking first | 1 | 0 |
   | other non-short + defending first | 1 | 1 |

3. Open the source event chains, actors, and ten-second shot context when needed.
4. Select exactly two training questions. There is no default, ranking, score,
   model recommendation, or “best” answer.
5. Lock the two questions before any Uruguay–Portugal corner is visible.
6. Reveal the fixed held-out counts `5 / 2 / 0 / 0 / 3` and shot counts
   `2 / 0 / 0 / 0 / 2`.
7. Open the first shot-bearing scene among the unselected questions. In the
   official path it is `other non-short + defending first`, corner `261095314`,
   Bernardo Silva → L. Suárez, followed by a recorded clearance and a Portugal
   shot within ten seconds.
8. Save one next-meeting decision and reason without changing the locked
   questions, revealed counts, or source receipts.

The official demonstration selects `aerial + defending first` and
`short + attacking first`. This is a legible editorial path, not an optimal
selection.

## Small-sample and semantic boundaries

- `0` means “no scene in this small admitted sample,” not “Uruguay is weak.”
- Counts describe recorded events, not team intent or tactical quality.
- `playerId` identifies the player associated with a source event. The UI may
  say `키커`, `첫 후속 기록의 선수`, and `첫 수비 기록`; it must not invent a
  receiver, physical first contact, duel winner, marker, or reachable area.
- A shot within ten seconds is a later historical event, not an effect caused
  or prevented by the manager's training choice.
- The source contains no continuous tracking, marking assignment, rehearsed
  routine label, or counterfactual outcome. Full tactical weakness and optimal
  response claims remain rejected.

## Knowledge-graph boundary

Allowed nodes include `Team`, `Match`, `CornerRestart`, `RestartFamily`,
`RecordedFollowUp`, `RecordedActor`, `RecordedShot`, `TrainingQuestion`, and
`SourceReceipt`.

Allowed edges bind only recorded association and provenance:
`ATTACKED_IN`, `DEFENDED_IN`, `TAKEN_BY`, `FOLLOWED_BY`, `RECORDED_FOR_TEAM`,
`FOLLOWED_WITHIN_10S_BY`, `SELECTED_AS_QUESTION`, and `SUPPORTED_BY_RECEIPT`.

`IS_WEAK_AGAINST`, `MARKED_BY`, `RECEIVED_BY`, `WOULD_PREVENT`,
`OPTIMAL_TACTIC`, and `CAUSED_SUCCESS` are forbidden.

## Fail-closed behavior

The release must not build unless Events, Matches, and Players are rights-cleared
and accepted in `data/source-manifest.json`. Missing or duplicate joins, invalid
names, wrong team identities, any count other than the exact five-signature
contract, a non-PASS matchup board, or an invalid release marker must stop the
build or show one contained error page. No synthetic substitute is allowed.

## Planning consistency

The submitted PDF's unsupported location/role mechanic is retained only as a
falsified hypothesis. The implementation preserves the planning thesis's useful
structure—two priorities, precommitment, hidden evidence, counterevidence, and a
next-meeting decision—but moves the visible choice onto evidence admitted for
both named teams. `docs/product-thesis.md` and `docs/decision-registry.md`
record the correction.

## Promotion gate

Product concept, raw reproducibility, player-identity semantics, initial
responsive review, and the first static-release browser suite pass. Promotion
still requires canonical Korean-copy QA, the complete regression and browser
matrix, a new stamped public release, new gallery images, a newly narrated
60-second video, public-URL-bound evidence, and submission preflight.
