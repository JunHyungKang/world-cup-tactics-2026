# Corner Region and Window Sensitivity Audit

Date: 2026-07-17 KST
Status: `REVISE — repository transform corrected the prior one-off sensitivity
table; independent semantic review remains`

## Question

Does the proposed `outlet player high -> bring role into a defensive priority` interaction keep the
same evidence story when product-defined coordinate boundaries move by two
Wyscout units and the recorded window changes from 8 to 15 seconds?

The audit uses all 42 Brazil corners from the pinned World Cup 2018 Events JSON.
It is a robustness check on the proposed interaction, not evidence that a role
move would have prevented an attack.

## Nominal definitions

All events are normalized into Brazil's attacking frame and laterally mirrored
to one corner side as specified in `docs/corner-transform-contract.md`.

| Region | Nominal rectangle |
|---|---|
| Short-option endpoint / check short option | `85 <= x <= 100`, `0 <= y < 25` |
| Near-post-side delivery lane | `85 <= x <= 100`, `25 <= y < 45` |
| Central-to-far delivery lane | `85 <= x <= 100`, `45 <= y <= 70` |
| Second-ball band / screen | `70 <= x < 85`, `20 <= y <= 80` |
| Defending outlet band | `45 <= x < 70`, `20 <= y <= 80` |

Delivery classification uses only the normalized Brazil Corner terminal point.
Follow-up contact uses Brazil event start markers plus eligible Pass/Clearance
segments. Outlet-band contact uses only defending-team Pass/Clearance evidence. Shot
contact uses only Brazil Shot start locations. Window-level booleans prevent
multiple events in one corner from increasing one receipt row.

## Nominal result at 10 seconds

| Evidence | Short option | Near-post side | Central-to-far | Second-ball band | Outlet band | Other |
|---|---:|---:|---:|---:|---:|---:|
| Delivery endpoint windows | 14 | 17 | 10 | n/a | n/a | 1 |
| Brazil follow-up contact windows | 14 | 18 | 15 | 13 | n/a | n/a |
| Brazil shooting-location contact windows | 0 | 3 | 5 | 3 | n/a | n/a |
| Defending-team outlet-band contact windows | n/a | n/a | n/a | n/a | 10 | n/a |

The endpoint headline is `Near-post-side delivery lane: 17 of 42`. This is a descriptive bin,
not a learned pattern, tactical recommendation, or near-post success rate.

## Coordinate-boundary sensitivity

For delivery regions, independently perturb the shared `x = 85`, `y = 25`,
`y = 45`, and `y = 70` boundaries by `-2 / 0 / +2`, retaining ordered y
boundaries. All 81 valid combinations were evaluated.

| Delivery class | Minimum | Nominal | Maximum | Led in variants |
|---|---:|---:|---:|---:|
| Short option | 14 | 14 | 14 | 27 / 81, using fixed region order for ties |
| Near-post side | 13 | 17 | 17 | 54 / 81 |
| Central-to-far | 9 | 10 | 14 | 0 / 81 |
| Other | 1 | 1 | 2 | 0 / 81 |

For the four second-ball-band boundaries at 10 seconds, all 81 `±2` combinations
produced 13–14 Brazil follow-up-contact windows and exactly 3
shooting-location-contact windows. For the four outlet-band boundaries, all 81
combinations produced 9–11 defending-team contact windows.

Verdict: the nominal near-post headline is not invariant. Short option becomes
the fixed-order leader or ties for the lead in 27 variants; near-post leads in 54.
The existence of the second-ball priority versus outlet-role tradeoff survives,
but the UI must not call any delivery region a robust dominant pattern. Exact counts
must remain visibly tied to the published rectangle and cannot be described as
natural football clusters.

## Temporal-window sensitivity

| Window | Brazil shot windows | Second-ball contact windows | Outlet-band contact windows | First outside-second-ball shot ID |
|---:|---:|---:|---:|---:|
| 6 seconds | 10 | 8 | 6 | `258973935` |
| 8 seconds | 11 | 12 | 7 | `258973935` |
| 10 seconds | 11 | 13 | 10 | `258973935` |
| 12 seconds | 11 | 14 | 10 | `258973935` |
| 15 seconds | 11 | 18 | 10 | `258973935` |

Ten seconds is the shortest tested window that preserves all 11 Brazil-shot
windows found at 15 seconds and all 10 outlet-band-contact windows found at 15
seconds. Extending to 12 seconds adds one second-ball-band contact but no new shot
or outlet-band window; extending to 15 adds four more second-ball contacts and increases the
risk of folding later play into the corner story.

Reviewed decision: replace the arbitrary 12-second window with an inclusive
10-second recorded evidence window. In the raw population, its latest included
event delta is `9.984457` seconds and its earliest excluded delta is `10.035531`.
Synthetic fixtures must own exact `9.999999 / 10.000000 / 10.000001` behavior.

At 10 seconds the full population contains 223 events. Thirty-eight of 42 windows
contain a defending-team event; 16 windows contain 17 defending-team clearances.
The source unit must still be called a recorded window, never possession or a
causal phase.

## Skeptic sensitivity

A naive `earliest shot outside the selected region` rule is boundary-sensitive.
Across the 81 delivery-region variants, the near-post-side candidate is
`258973935` in 27 variants and `258974380` in 54; the central-to-far candidate
shows the inverse split. Therefore one global or nominal-only Skeptic example is
rejected.

The revised Skeptic rule requires a shooting-location marker to remain outside
the selected priority in every `±2` variant. The earliest robust candidates are:

| Selected duty | Robust least-explained shot window |
|---|---:|
| Check short option | `258973935` |
| Near-post-side delivery lane | `258974380` |
| Central-to-far delivery lane | `258974380` |
| Second-ball screen | `258973935` |

This does not prove the plan failed. It is only the earliest recorded shot window
that the selected project-defined priority does not explain under the tested
boundary perturbations.

## Gate

Coordinate robustness passes this bounded exploration, but the source remains
`pending`. Promotion still requires:

1. a fresh-user five-second UX test of the independently reviewed region names,
   one-role instruction, and two-column receipt;
2. the repository-owned transform continues to reproduce this corrected table;
3. deterministic boundary, placeholder, mirroring, and source-ID tests;
4. 42/42 structural audit and at least 38/42 independent semantic agreement;
5. visible attribution and no composite score, prevention claim, player-reach
   claim, or 2018-to-2026 tendency claim.
