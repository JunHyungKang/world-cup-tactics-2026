# Corner Evidence Transform Contract

Status: `PASS — implementation and 42/42 structural/semantic audit complete;
human study unavailable, so no preference, usability, or memorability claim`

This contract defines the smallest defensible transformation from the pinned
World Cup 2018 event files to the `Corner War Room` product. It deliberately
avoids possession, interception, expected-goal, and counterfactual claims that
the source cannot support.

## Product question

> When Brazil took a corner in the 2018 World Cup, which recorded attacking
> locations touched the defensive priority selected by the user, which recorded
> window is least explained by that priority, and what outlet role did the user
> give up to add it?

The answer is historical evidence about 42 observed corners. It is not a Brazil
2026 tendency and not a prediction of whether a defender would stop the play.

## Pinned inputs

| Input | Contract |
|---|---|
| Events | `data/raw/pappalardo/events_World_Cup.json` from the pinned archive |
| Matches | `data/raw/pappalardo/matches_World_Cup.json` from the pinned archive |
| Attacking team | Brazil, Wyscout `teamId == 6380` |
| Corner selector | `subEventName == "Corner"` and `teamId == 6380` |
| Expected population | 42 corners across five matches |

The transform must verify both archive and extracted-file hashes. The extracted
inputs are pinned as:

- Events JSON: `d789b7cd80671a0dd1263150e997d1450e1ed22cddc8beb7bb2a6266b374a869`;
- Matches JSON: `1ddab20c8605c063a62341eb846466c8d040885a5f0f9a3e26d023123786abb6`.

It must also verify that the ZIP entry bytes equal the extracted JSON bytes. It
fails closed if any hash differs, if the population is not exactly 42, or if a
corner does not have exactly two finite positions inside inclusive `0..100`.

## Canonical event window

For each corner:

1. group events by `matchId` and `matchPeriod`;
2. convert `eventSec` to integer microseconds using `Math.round(eventSec * 1e6)`
   and order by that value, then numeric event `id` as the stable tie-breaker;
3. locate the selected corner in that sorted array and consider only its suffix,
   so an earlier event with an equal timestamp cannot enter the window;
4. include events whose integer-microsecond delta is in inclusive
   `0..10_000_000`;
5. never cross a match-period boundary;
6. preserve events from both teams and preserve their source event IDs.

The corpus contains no event at exactly 10 seconds: the latest included delta is
`9.984457` and the first excluded delta is `10.035531`. Synthetic tests therefore
own `9.999999 / 10.000000 / 10.000001` behavior. This is named a **recorded
10-second corner window**, never a possession,
attacking phase, chance, or causal sequence. The window may include a clearance,
counterattack, foul, restart, or sparse provider recording. Those are evidence,
not reasons to silently extend or truncate the rule.

Ten seconds is selected by the bounded sensitivity audit, not convenience. The
8/10/12/15-second variants all contain the same 11 Brazil-shot windows; defending
outlet-band contact reaches its 10-window plateau at 10 seconds, while 12 seconds
adds only one second-ball-band contact and 15 seconds adds four more, indicating
greater later-play drift. The UI discloses `13 contacts at 10 seconds / 14 at 12`
for the second-ball band.

## Coordinate normalization

The UI uses the corner-taking team's frame: Brazil attacks toward `x = 100`.

- Brazil event positions remain unchanged.
- Opponent event positions are mirrored as `(100 - x, 100 - y)`.
- If the corner begins with `y > 50`, mirror every already team-normalized point
  laterally as `(x, 100 - y)` so every replay starts from the same touchline.
- Retain source coordinates and normalized coordinates in the derived audit
  record so each point is reversible.

The mirroring rule is an empirical corpus invariant, not independently licensed
tracking truth. Five fixed opposing-duel fixtures must co-locate after mirroring
and round-trip back to their exact source positions:

| Match | Event IDs |
|---|---|
| Brazil - Switzerland | `258974211 / 258974225` |
| Brazil - Costa Rica | `259862940 / 259863064` |
| Serbia - Brazil | `260715386 / 260716054` |
| Brazil - Mexico | `261386180 / 261386387` |
| Brazil - Belgium | `262120303 / 262120286` |

Do not dynamically infer duel pairs without a separately specified one-to-one
matching algorithm.

## Honest visual primitives

Every primitive retains `eventId`, event/sub-event names, team, time offset,
source positions, and normalized positions.

| Source event | Visual primitive | Region-contact rule |
|---|---|---|
| Corner | Solid delivery segment between its two recorded positions | Delivery endpoint inside a delivery-priority region; segment is visual context only |
| Brazil pass-family event or `Clearance` with two usable positions | Thin follow-up segment | Segment/region contact, separately labeled as a straight-line rendering assumption |
| Brazil shot | Shooting-location marker at the recorded start position | Point inside region; never draw toward its terminal placeholder |
| Duel, touch, foul, save, acceleration, or other event | Event marker at the recorded start position | Point inside zone only |

Brazil attacking primitives and defending-team primitives are separate evidence
channels and must never contribute to the same count. In this population, 38 of
42 windows contain a defending-team event and 16 contain a total of 17 defending
team clearances; mixing them would materially change the headline.

Position validity is event-role-specific:

- a Corner start at `(100, 100)` is valid; it occurs in 20 of 42 corners;
- every Shot uses its start only and ignores its corpus-observed terminal
  placeholder `(0, 0)` or `(100, 100)`;
- Pass/Clearance terminals that equal either placeholder are too ambiguous for a
  segment, although their start may remain a marker;
- all other segment endpoints must be finite and inside inclusive `0..100`.

The UI must not call a rendered segment a continuous ball trajectory or
player-tracking path.

## One manager role move, two evidence channels

The first slice has one draggable role: `outlet player`. The user may leave the
role high in the outlet band or bring that role back into exactly one defensive
priority. This is a role-allocation decision, not a claim that one player covers
a rectangle.

Provisional product-defined regions in the normalized Brazil attacking frame:

| Region | Half-open rectangle | Evidence allowed |
|---|---|---|
| Short-option endpoint / check short option | `85 <= x <= 100`, `0 <= y < 25` | Brazil corner endpoint and follow-up only |
| Near-post-side delivery lane | `85 <= x <= 100`, `25 <= y < 45` | Brazil corner endpoint and follow-up only |
| Central-to-far delivery lane | `85 <= x <= 100`, `45 <= y <= 70` | Brazil corner endpoint and follow-up only |
| Second-ball band / screen | `70 <= x < 85`, `20 <= y <= 80` | Brazil follow-up markers/eligible segments only |
| Defending outlet band | `45 <= x < 70`, `20 <= y <= 80` | Defending-team Clearance/Pass events only |

These are explicitly project-defined coordinate regions, not the laws-of-the-game
six-yard box, player reach envelopes, or learned tactical clusters. The short
region is first-class because 14 of 42 normalized delivery endpoints fall at
`x >= 85, y < 25` and 12 of those carry the accurate tag. The three delivery
regions are mutually exclusive; all other endpoints are reported as `other`.

Independent football review approved these project-defined names. The repository
transform corrected the earlier one-off `±2` table: near-post leads under the
fixed region order in 54/81 variants, while short option leads or ties first in
27/81. The UI must show sensitivity and must not call the nominal near-post count
a robust dominant pattern.

The interaction changes only which Brazil attacking evidence is marked as
`touched the selected priority region`. It never changes source replay or fixed
counts. The outlet column separately reports when a recorded defending-team
Clearance/Pass segment touched the project-defined outlet band; it never calls
that event a successful release/counterattack or says an outlet player caused it.

The two columns must not be combined into a score:

- defensive priority evidence: delivery endpoint `N / 42`, any Brazil follow-up
  contact `N / 42`, and Brazil shooting-location contact `N / 11 Brazil-shot-window
  corners`;
- recorded outlet-band evidence: defending-team Clearance/Pass contact `N / 42`,
  fixed regardless of the user's move;
- the selected priority, the relinquished outlet role, and the deterministic
  least-explained window ID.

`shot_in_window` means `teamId == 6380 && eventName == "Shot"`; a goal-tagged
shot additionally has tag `101`. The expected discovery counts are 11 and one.
Counts are window-level booleans, so multiple events in one window count once.

## Evidence Council selection

- `Scout` compares only Brazil corner terminal endpoints across the three delivery
  regions plus `other`, states the largest count and denominator, and uses fixed
  region order for ties. A rendered segment crossing does not change this count.
- `Skeptic` selects a boundary-robust `least-explained recorded window`: first the
  earliest Brazil-shot window whose shooting-location marker is outside the
  selected priority under every tested `±2` rectangle variant; then apply the
  same all-variants rule to delivery endpoint plus later Brazil markers; then use
  a short/sparse/clearance-only edge case. The expected shot candidates are
  `258973935` for check-short and second-ball duties and `258974380` for the two
  delivery-lane duties. If no candidate exists, the UI states that instead of
  inventing one.
- `Coach` describes exactly one role move: `you prioritized X and brought the
  outlet role back`. It may say `touched the selected priority region` or `not
  selected`; it may not say `covered`, `escaped`, `stopped`, `saved`, `prevented`,
  `optimal`, or `recommended by AI`.

The three roles are deterministic views of one derived record, not runtime model
opinions.

## Full-population audit

Because the Brazil population is only 42 corners, review all 42 rather than a
30-row sample. The future transform must emit
`data/audit/brazil-corner-window-review.csv` with one row per corner and these
columns:

```text
corner_event_id,match_id,match_label,period,corner_sec,corner_tags,
source_start,source_end,window_event_ids,window_event_count,
shot_in_window,goal_tagged_shot_in_window,normalization_side,
structural_check,semantic_check,reviewer_note
```

Audit rules:

- structural extraction, ordering, 10-second inclusion, IDs, and normalization
  must be correct for `42 / 42`; any error requires a transform fix and full rerun;
- at least 38 of 42 rows must independently agree that the UI wording `recorded
  10-second corner window` and `touched the selected priority region` are not
  interpreted as possession or successful defending;
- the semantic reviewer must not be the transform implementer; each row records
  `pass`, `fail`, or `uncertain`, with `uncertain` counting against the 38-row
  threshold and every disagreement retained verbatim;
- all disagreements and sparse/restart/counterattack cases remain in the audit
  file and may become Skeptic least-explained or edge-case windows;
- the accepted derived JSON publishes only the minimum fields required by the
  browser and includes source DOI, archive SHA-256, transform version, assumptions,
  and this exact attribution shape: both Pappalardo/Massucco Events and Matches
  DOIs, `https://creativecommons.org/licenses/by/4.0/`, `transformed and coordinate-normalized by this
  project`, and a non-endorsement statement. Keeping raw rows out of the browser
  is a product-minimization policy, not a claim that CC BY forbids redistribution.

## Required deterministic tests

1. input checksums and exact 42-corner population;
2. stable ordering for equal timestamps;
3. inclusive `10.000` boundary and period isolation;
4. opponent and lateral mirroring with reversible source positions;
5. the five fixed paired-duel fixtures normalize to the same position and reverse
   to exact source coordinates;
6. event-role-specific placeholder rules preserve all 42 Corner segments and
   never render a Shot terminal segment;
7. window-level contact counts cannot exceed 42;
8. the 11 shot-window and one goal-tagged-shot discovery counts reproduce;
9. Scout tie-breaking plus Skeptic all-variants robustness and no-candidate
   fallback are stable;
10. every public record maps back to source match and event IDs;
11. two equal-timestamp Brazil-window events order by numeric event ID, using raw
    fixture `259862940` before `259863064` plus a synthetic corner-suffix fixture;
12. display clocks distinguish period time (for example `2H 04:10`) from absolute
    match minute (for example `49:10`).

## Promotion gate

`REVISE` until all required tests pass, the 42-row audit reaches its thresholds,
the transform reproduces the independently reviewed region names and passing
`±2` sensitivity, the two evidence channels remain visually separate,
attribution is visible, and the
derived output is the only dataset shipped to the browser. Stop if fewer than
38 of 42 semantic reviews agree, sensitivity changes the headline or primary
tradeoff, short-option endpoints cannot be represented, outlet-band evidence
cannot be kept defending-team-only, or two of five fresh viewers interpret
contact as `this defender would have stopped it`. Only then may the two Figshare sources move from
`pending` to `accepted`.
