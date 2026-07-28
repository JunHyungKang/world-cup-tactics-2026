# Corner Scout Lab Product Contract

Status: `PLAYER-FIRST SOURCE-SCENE CANDIDATE — RELEASE VALIDATION PENDING`

## One-sentence product

Corner Scout Lab starts from same-receipt player-event connections in Portugal's
recorded group-stage corners, separates Uruguay evidence into three-axis direct
and adjacent receipts, and lets a manager lock two video-review questions before
the historical matchup is shown.

It is not a raw location-frequency dashboard, a weakness detector, an
optimal-tactic recommender, or a player-position simulation.

## Why this is team-specific scene analysis

The first layer is an exact same-receipt player-event connection:

1. corner taker Ricardo Quaresma (`32597`);
2. first recorded follow-up actor Raphaël Guerreiro (`28907`);
3. three receipts across two group-stage matches;
4. restart source IDs `258702651`, `258702667`, and `260341439`; and
5. no receiver, first-contact, pass-target, possession-continuation, or
   rehearsed-routine claim.

The second layer compares teams only through explicit recorded axes. Each
admitted scene binds:

1. a named attacking or defending team;
2. the corner taker;
3. the restart family: short, aerial follow-up, or other non-short;
4. the team of the first recorded follow-up;
5. the first recorded attacking and defending actors when present;
6. a ten-second attacking-shot record; and
7. source period and corner time; and
8. match, corner, follow-up, and first-defending source IDs; and
9. direct support only when situation family, first recorded team role, and
   first recorded event/sub-event all match.

The app asks three team-specific questions in order:

`Which player-event links repeat for Portugal? → Which Uruguay receipts directly
match or sit adjacent? → What appeared in their matchup?`

The event ledger becomes a review agenda only when the manager chooses two
questions. A collapsed partial-pooling forecast discloses how Portugal's
14-corner sample was regularized, but it does not lead the interaction, assign a
defender, or claim a training effect.

## Canonical manager loop

1. See the Quaresma/Guerreiro same-receipt connection, its three scenes and two
   matches, and the no-contact boundary.
2. See Portugal recurrence and sparse Uruguay source context without combining
   independent totals into a routine.
3. Compare five exact `restart family × first recorded follow-up team`
   signatures:

   | Signature | Portugal | Uruguay direct | Uruguay adjacent |
   |---|---:|---:|---:|
   | short + attacking first | 7 | 2 | 0 |
   | aerial + attacking first | 1 | 0 | 2 |
   | aerial + defending first | 4 | 0 | 2 |
   | other non-short + attacking first | 1 | 0 | 1 |
   | other non-short + defending first | 1 | 1 | 0 |

4. Compare match recurrence, then open source event chains, actors, and
   ten-second shot context when needed.
5. Select exactly two video-review questions. There is no default, ranking, score,
   model recommendation, or “best” answer.
6. Lock the two questions before any Uruguay–Portugal corner is visible.
7. Reveal the held-out counts `5 / 2 / 0 / 0 / 3` and shot counts
   `2 / 0 / 0 / 0 / 2`; keep the model check collapsed.
8. Open the first shot-bearing scene among the unselected questions. In the
   official path it is `other non-short + defending first`, corner `261095314`,
   with kicker Bernardo Silva and first recorded follow-up actor L. Suárez,
   followed by a recorded clearance and a Portugal shot within ten seconds.
9. Save one next-meeting decision and reason without changing the locked
   questions, revealed counts, or source receipts.

The official demonstration selects `aerial + defending first` and
`short + attacking first`. This is a legible editorial path, not an optimal
selection.

## Small-sample and semantic boundaries

- `0` means “no three-axis direct receipt in this small admitted sample,” not
  “Uruguay is weak.”
- Counts describe recorded events, not team intent or tactical quality.
- `playerId` identifies the player associated with a source event. The UI may
  say `키커`, `코너 뒤 첫 기록의 선수`, and `첫 수비 기록`; it must not invent a
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
