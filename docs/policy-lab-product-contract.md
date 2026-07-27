# Corner Scout Lab Product Contract

Status: `LOCAL RELEASE VERIFIED — TEAM MODEL + SOURCE SCENE REVIEW PASS; PUBLIC STAMP PENDING`

## One-sentence product

Corner Scout Lab partially pools Portugal's 14 recorded group-stage corners with
the 397-corner tournament profile, shows the resulting team-specific delivery
shift, links Portugal and Uruguay source scenes without pooling the sparse
Uruguay sample into the forecast, and lets a manager lock two video-review
questions before the historical matchup is shown.

It is not a raw location-frequency dashboard, a weakness detector, an
optimal-tactic recommender, or a player-position simulation.

## Why this is team analysis

The first layer is a validated team forecast rather than a raw rate:

1. Portugal evidence weight `46.7%`;
2. tournament-prior weight `53.3%`;
3. all-knockout evaluation on 160 unseen corners;
4. log-loss reduction `4.59%` against the tournament-only baseline;
5. `12/16` evaluated knockout teams improve while `4/16` worsen; and
6. a positive match-cluster 95% log-score-gain interval.

The second layer is not a pitch area alone. Each admitted scene binds:

1. a named attacking or defending team;
2. the corner taker;
3. the restart family: short, aerial follow-up, or other non-short;
4. the team of the first recorded follow-up;
5. the first recorded attacking and defending actors when present;
6. a ten-second attacking-shot record; and
7. source period and corner time; and
8. match, corner, follow-up, and first-defending source IDs.

The app asks four team-specific questions in order:

`What changes after small-sample correction? → Portugal repeated what? → Uruguay
had faced what? → What appeared in their matchup?`

The forecast narrows the scouting range. The event ledger then becomes a review
agenda only when the manager chooses two questions. Neither layer assigns a
defender or claims a training effect.

## Canonical manager loop

1. See Portugal's `14/14` classifiable group-stage attacking corners and
   Uruguay's `5/6` classifiable group-stage defensive exposures as separate
   records.
2. See how partial pooling changes the top two delivery areas from tournament
   `central/far + near` to Portugal `central/far + short`, plus the frozen
   160-corner evaluation.
3. See that the Uruguay-conditioned challenger failed the `0.975` uncertainty
   gate and is not used in the displayed probabilities.
4. Compare five exact `restart family × first recorded follow-up team`
   signatures:

   | Signature | Portugal | Uruguay |
   |---|---:|---:|
   | short + attacking first | 7 | 2 |
   | aerial + attacking first | 1 | 2 |
   | aerial + defending first | 4 | 0 |
   | other non-short + attacking first | 1 | 0 |
   | other non-short + defending first | 1 | 1 |

5. Compare match recurrence, then open source event chains, actors, and
   ten-second shot context when needed.
6. Select exactly two video-review questions. There is no default, ranking, score,
   model recommendation, or “best” answer.
7. Lock the two questions before any Uruguay–Portugal corner is visible.
8. Reveal the fixed one-match team-model check (`9/10` for Portugal's
   conditioned top two, `5/10` for the tournament top two), held-out counts
   `5 / 2 / 0 / 0 / 3`, and shot counts
   `2 / 0 / 0 / 0 / 2`.
9. Open the first shot-bearing scene among the unselected questions. In the
   official path it is `other non-short + defending first`, corner `261095314`,
   Bernardo Silva → L. Suárez, followed by a recorded clearance and a Portugal
   shot within ten seconds.
10. Save one next-meeting decision and reason without changing the locked
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

Product concept, raw reproducibility, player-identity semantics, Korean-copy QA,
`122/122` unit/contract checks, `17/17` source interactions, the `12/12` static
release matrix, and the `56/56` pre-release browser matrix pass. Promotion still
requires a new stamped public release, refreshed gallery review, a newly
narrated 60-second video, public-URL-bound evidence, and submission preflight.
