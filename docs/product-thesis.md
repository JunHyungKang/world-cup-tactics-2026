# Product Thesis

Product selection ID: `corner-policy-lab`

Product data scope: `official-open-historical-tactics`

Product selection status: `PASS — bounded opponent-scouting context`

Implementation refinement status: `PASS — opponent evidence before role placement`

Causal recommendation status: `REJECT`

Empirical campaign status: `REVISE`

Team-conditioned forecast status: `PASS — recorded delivery locations only`

Two-team matchup forecast status: `REJECT — match-cluster uncertainty gate failed`

## 2026-07-27 product correction

The owner correctly rejected the current release's football premise. Tournament-wide
location overlap is not team analysis, and choosing two popular areas does not become
a meaningful tactical decision merely because it is locked before a holdout. The
current public release and demo remain reproducible artifacts, but they are no longer
the product-quality bar and must not be uploaded as the final video.

The bounded replacement question is:

> 조별리그에서 본 상대팀의 코너킥 전달 성향이 대회 전체 평균보다 미공개
> 토너먼트의 전달 구역을 더 잘 예측하는가?

The replacement is an **opponent corner training planner**, not a defensive
placement recommender. The manager sees Portugal's partially pooled group-stage
profile, then allocates ten rehearsal repetitions across all four delivery areas
before revealing the held-out match. There is no default or model-recommended
allocation. The app must show the team sample, the amount borrowed from the
tournament prior, the opponent's four delivery probabilities, and the unchanged
held-out audit.

This preserves the submitted planning PDF's core `48 → 8 → 8`, scarce-resource
choice, precommitment, and no-causal-recommendation structure. The canonical product
now adds one named-opponent scouting dossier before the submitted two-role placement
loop. The separate ten-repetition planner remains a challenger because replacing
the manager loop would break planning-to-implementation consistency. The submitted
PDF is immutable; implementation may refine the service only if the judge can still
recognize the submitted loop without an explanation tax.

## Bounded interaction challenger

Status: `PASS` as an isolated prototype; canonical replacement remains `REJECT`.

The exact first-screen question is:

> 포르투갈전 코너 수비 훈련 10회, 어디에 배분할까요?

The visible evidence is Portugal's 14 classifiable group-stage corners, partial
pooling weights of 47% Portugal evidence and 53% tournament evidence, and the full
four-way distribution: short `33.5%`, near `27.5%`, central/far `35.5%`, other
`3.5%`. Uruguay's five classifiable group-stage defensive exposures are shown
separately. A frozen challenger tests whether they should modify the forecast,
but the product does not pool them because that challenger misses the promotion
gate below.

The manager adds or removes one rehearsal repetition at a time until exactly ten
are allocated, locks the plan, then reveals the fixed Portugal distribution
`5/1/4/0` from ten classifiable corners in Uruguay–Portugal. The result compares
the manager's training plan, the pre-match distribution, and the recorded
locations without scoring the manager's allocation or calling it correct.

The challenger passes three Chromium contracts: named-opponent evidence before
outcome, exact ten-repetition immutable lock and deterministic reveal, and visible
aggregate counterevidence plus zero automated accessibility violations. The
Korean challenger surfaces also pass the repository copy rules. These are machine
and synthetic-persona results, not human comprehension evidence.

## Team-scouting data gate

Status: `PASS` for a bounded forecast; `REJECT` for optimal tactics.

- Fit population: 397 classifiable group-stage corners from 48 matches.
- Evaluation population: 84 classifiable round-of-16 corners, untouched during
  model selection.
- Final audit population: 76 classifiable quarter-final-and-later corners,
  untouched during fitting and model selection.
- Raw per-team rates remain unsafe: 31 of 32 teams have at least one delivery
  category with fewer than three observations.
- The replacement therefore uses a Dirichlet-multinomial partial-pooling model.
  Its prior concentration is selected from `[0.5, 1, 2, 4, 8, 16, 32, 64, 128]`
  using group-stage leave-one-team-out evidence only; the selected value is `16`.
- Against the tournament-wide probability baseline, the unchanged team-conditioned
  forecast lowers multiclass log loss by `2.14%` in the round of 16 and `7.21%`
  in the final audit, `4.59%` across all 160 knockout corners.
- Multiclass Brier score improves by `4.66%` across the same 160 corners.
- Team conditioning improves log loss for 12 of 16 knockout teams; it harms four.
  The UI must expose uncertainty and never describe every team profile as useful.
- A two-area compression destroys that aggregate advantage: the tournament top
  two and each team profile's top two both cover `65/84` round-of-16 endpoints
  and `59/76` later endpoints. Therefore the old "pick two areas for all teams"
  campaign remains rejected. The replacement must preserve the four-way
  probability profile and make a specific opponent the unit of the decision.
- A deterministic 10,000-draw knockout-match-cluster bootstrap gives a 95% mean
  log-score-gain interval of approximately `[0.0040, 0.1071]` per corner with
  `P(gain > 0) = 0.9814`.
- All 46 placeholder endpoints remain excluded and disclosed. The forecast is for
  **classifiable recorded endpoints**, not all corners.

The fixed first example is the lowest source match ID in the predeclared round-of-16
partition, Uruguay–Portugal. Portugal has 14 classifiable group-stage attacking
corners; Uruguay has only five classifiable group-stage defensive exposures, so the
two histories are shown separately and the latter is not pooled into the forecast.
In the ten held-out Portugal corners, the tournament-wide top two areas cover five
and the team-conditioned top two cover nine. This example is not sufficient proof
by itself; the 16-match aggregate audit above owns the product claim.

## Two-team matchup challenger gate

Status: `REJECT` for the displayed forecast; `GO` only as disclosed sensitivity
evidence.

The owner's second criticism is also correct: an opponent attacking profile is
not yet a two-team matchup analysis. We therefore tested, rather than assumed,
whether Uruguay's group-stage defensive exposure should alter Portugal's attacking
profile. The frozen challenger is:

`normalize(opponent attack posterior × (manager defensive-exposure posterior /
tournament probability)^γ)`.

The shared Dirichlet concentration remains `16`. The interaction weight
`γ ∈ [0, 0.25, 0.5, 0.75, 1]` is selected only by leave-one-complete-match-out
group-stage validation; the selected value is `0.5`. Neither knockout partition
enters fitting or hyperparameter selection.

- Round of 16: log loss `1.1654 → 1.1493`, a `1.39%` reduction.
- Quarter-final and later: `1.1356 → 1.1290`, a `0.59%` reduction.
- All 160 knockout corners: `1.1513 → 1.1396`, a `1.01%` reduction.
- Brier score is non-worse in both held-out partitions.
- The 10,000-draw knockout-match-cluster interval for mean log-score gain is
  `[-0.0040, 0.0274]`, with `P(gain > 0) = 0.9226`.

The mean moves in the right direction, but the interval still crosses zero and
the improvement probability misses the predeclared `0.975` promotion gate.
Therefore the displayed probabilities remain opponent-only. The UI names the
Uruguay sample, the observed mean gain, the failed uncertainty gate, and the
decision not to use the two-team correction. It must not describe this rejected
challenger as matchup intelligence, model superiority, or a tactical
recommendation.

## Research boundary

Recent primary work confirms why the product must stop at opponent delivery
forecasting with this dataset:

- TacticAI uses 7,176 valid corners plus all 22 players' positions, velocities,
  and profiles to predict receivers and shots and recommend adjustments
  (`https://www.nature.com/articles/s41467-024-45965-x`).
- Recent defensive-role inference uses tracking to distinguish man marking and
  zonal roles and fits team- and delivery-specific context
  (`https://arxiv.org/abs/2601.00748`).
- A recent graph-RL corner model uses more than 3,000 corners plus player positions
  and velocities (`https://arxiv.org/abs/2606.06353`).

Our 603 event endpoints contain no player tracking, marking roles, reach, action
propensities, xG, or defensive counterfactual rewards. RL, optimal placement,
marking assignments, shots prevented, and 2026 persistence remain `REJECT`.

## Superseded release record

The sections below describe the submitted PDF and currently deployed position-only
release. They remain as provenance and planning-consistency constraints. They do
not override the 2026-07-27 product correction or constitute approval to upload
the old demo.

### Winning goal

Build the entry judges remember as **the set-piece policy lab that tries to
disprove the manager before it explains the model**. The manager chooses two
corner-delivery areas to prioritize, locks one observation policy before seeing
held-out matches, and applies the same immutable policy to two sequential tests:
eight round-of-16 matches and eight still-sealed quarter-final-and-later matches.

The product does not retrieve a similar past scene and ask for approval. It makes
the manager commit under scarcity, preserves the commitment as a fingerprint,
then lets the historical record argue back through a full match ledger, a
deterministic representative contradiction, and source-linked ontology paths.

> 조별리그에서 세우고, 토너먼트에서 검증하세요.

### Selection evidence

An earlier exact-artifact same-reviewer comparison informed the internal product
choice across originality, manager-experience design, functional completeness,
and planning-to-implementation consistency. It is selection history, not a score
claimed to DAKER judges. Policy Lab was selected for its one-policy/two-holdout
campaign and exact artifact binding while keeping the causal boundary unchanged.

Corner War Room remains preserved as a byte-bound runner-up under
`docs/archive/corner-war-room-2026-07-19/`. It is not the selected submission
product.

### Manager fantasy

Target user: a football fan acting as the set-piece coach before a knockout
meeting.

The first screen exposes three fixed phases:

1. `48경기 조별리그 참고`;
2. `8경기 16강 중간 평가`;
3. `8경기 8강 이후 봉인 검증`.

The submitted planning path remains intact: the manager places two scarce
attention roles across `숏 코너`, `니어포스트`, `중앙·파포스트`, and
`그 밖의 전달`, then declares `40%`, `50%`, or `60%` as the minimum
location-overlap criterion, or explicitly chooses `판단 보류`.

The final implementation names the two tokens so the football cost is visible.
The first token is the set-piece defensive leader. The second is one outlet role
that the manager may either keep high or move into a second priority area. The
primary PDF and 60-second judging path still moves that second role into the
second area. The optional `역습 역할 1명 전방 유지` branch is an implementation
refinement of the same two-token scarcity, not a replacement product loop.

The primary judge path is eight activations:

1. place the defensive leader in the first area;
2. move the outlet role into the second area;
3. declare the minimum location-overlap criterion;
4. lock one policy for both tests;
5. reveal the round-of-16 evaluation;
6. reveal the final sealed evaluation with the same policy;
7. choose `다음 회의에서도 이 구역 유지`, `다음 회의에서 우선 구역 수정`, or
   `다음 회의에서 결정 보류`;
8. save one short reason as the next-meeting note.

The final receipt must show `선택 변경 0회` and the same policy fingerprint used
for both held-out partitions. The next-meeting note is a separate decision record
and cannot mutate that receipt, the overlap results, or the sealed policy. The
one-match-at-a-time revision path remains available under progressive disclosure
but is not the primary judging path.

The optional outlet-retained path closes honestly as a different role
commitment: one priority area plus one role kept high. It never earns a combined
score. Every partition shows two fixed observations side by side:

- selected-area delivery overlap;
- defending-team pass or clearance records touching the attacking outlet band
  in the same ten-second historical window.

The outlet-band context is `64/397` in the group-stage reference, `14/84` in the
round of 16, and `12/76` in the final audit. These counts do not prove an outlet
player was available, reached the ball, or completed a counterattack. They make
the sacrificed role legible without fabricating its effect.

### Real data and fixed split

The source is Pappalardo and Massucco's Figshare Soccer Match Event Dataset. Its
World Cup 2018 Events and Matches items are admitted under CC BY 4.0. The fixed
population is 603 corners across 64 matches.

- 557 corners have classifiable delivery endpoints;
- 46 placeholder endpoints remain unclassified and are never converted into an
  observed action;
- group-stage reference: `397/436` classifiable corners from 48 matches;
- round-of-16 evaluation: `84/89` from eight matches;
- quarter-final-and-later final audit: `76/78` from eight matches.

The split is by complete match, fixed before interaction, and pairwise disjoint.
The final eight matches never enter the reference summary or the round-of-16
evaluation. Missing group-stage endpoints are disclosed through lower and upper
bounds that place all 39 missing endpoints outside or inside each area. No hidden
imputation narrows the range.

The official DAKER rule permits the participant to choose the year, tournament,
and player composition. The app still uses 2018 only as a labeled historical
evidence lens and **must not imply that a 2018 pattern describes a 2026 team**.

### What the calculation means

The evaluated criterion is delivery-location overlap only. The manager predeclares a minimum
criterion before either holdout is exposed, so the result closes as `사전 기준
충족` or `사전 기준 미달` without post-hoc reinterpretation. It answers:

> Of the historical deliveries whose endpoints can be classified, how many fell
> inside the two areas the manager chose to inspect first?

It does not estimate defensive success, shot prevention, player reach, win
probability, expected goals, or a different match result. Shot and goal fields
are post-decision observations used to choose a representative contradiction,
not rewards for an optimized policy.

The global data report remains `REJECT` for causal policy estimation because
observed-action coverage is below 95 percent, team-specific support is sparse,
horizon and reward rankings are unstable, and the match-cluster interval does
not separate the leading areas. The empirical campaign remains a product-safe
historical stress test, not an offline-RL value estimator.

The fixed outlet-band count is displayed as adjacent historical context and is
never added to the location-overlap criterion. It is derived from defending-team
Pass/Clearance segments in the same recorded ten-second window and remains
unchanged when the manager moves a role.

### Final product gate — role tradeoff refinement

Status: `PASS`

- Target: a set-piece coach deciding whether a second defensive priority is
  worth giving up one outlet role.
- Direct manipulation: place the leader, then keep or move the outlet role; the
  pitch, policy label, fingerprint, receipt, and inspected-area count all change.
- Real data: 603 licensed 2018 World Cup corners provide location overlap and
  fixed outlet-band context under one reproducible ten-second transform.
- Differentiation: the product records a scarce staffing promise, freezes it
  before two held-out audits, and returns a counterexample rather than drawing
  an unconstrained formation or issuing a recommendation.
- Primary 60-second path: the exact submitted two-area path remains; the new
  branch is optional and cannot mutate the 48–8–8 split or claim boundary.
- Verified prototype: raw-derived contract `7/7`, policy interaction `10/10`,
  built browser loop `12/12`; full pre-release matrix must be rerun after all
  story and release surfaces are re-bound.
- Stop signal: reject the refinement if outlet context is combined with overlap,
  described as a caused counterattack, or allowed to change with the role move.

### Ontology as a safety mechanism

Allowed node types are:

- `MatchContext`;
- `ScoutingPolicy`;
- `CornerRestart`;
- `DeliveryAction`;
- `ObservedEvent`;
- `OutcomeProxy`;
- `Source`.

Allowed edges describe fixed membership, recorded action, observed transition,
observed outcome, and provenance. The UI exposes `DERIVED_FROM` and the forbidden
relations `DEFENSIVE_DUTY_CAUSED`, `WOULD_PREVENT`, and `OPTIMAL_POLICY`.

The ontology does not fill missing actions or invent counterfactual effects. It
is an inspectable evidence path and forbidden-inference guardrail, not a graph
reasoning engine. Its job is to make provenance visible and prohibited inference
machine-checkable.

### Representative contradiction

After a held-out partition is revealed, every classifiable corner is available
in the record table. The representative contradiction is selected
deterministically:

1. first unselected-area delivery followed by a recorded attacking shot;
2. otherwise first unselected-area delivery;
3. otherwise first selected-area delivery followed by a shot;
4. otherwise first observed record.

This is a stable demonstration example, not the statistically strongest
counterexample. The exact match, corner event ID, observed action, outcome proxy,
source, and forbidden relations remain visible.

### Current verified evidence

- policy data/release contracts: `7/7`;
- source Chromium interaction contracts: `10/10`;
- built static release: `12/12` across Chromium, Firefox, WebKit, and mobile;
- Korean copy audit: 16 canonical surfaces with zero high-confidence findings;
- narrated local rehearsal: `59.520s`, VP8 + Opus, burned Korean captions,
  SHA-256 `4a145fc82614a8cec124b071dce905f4e2f94eb5aa018d03979a2956bd9f88c1`;
- all `12/12` timed events land within 0.11 seconds; the criterion-aware final
  receipt appears at `34.011s` and the immutable next-meeting note is saved at
  `48.041s`.

These are product and machine-verification results. Public hosting and public
GitHub are live as candidate evidence. The final stamped release, YouTube, DAKER
final submission, physical VoiceOver, and human comprehension or preference
evidence remain incomplete and must not be claimed.

### Submission completion gate

The selected product is not submission-ready until all of the following bind to
one clean commit:

1. root static build and exact public data;
2. canonical eight-page planning PDF and independent visual review;
3. gallery image, storyboard, narration, captions, and sub-60-second demo;
4. public GitHub repository and keyless HTTPS deployment;
5. public-URL final browser evidence including the deployed fingerprint check;
6. YouTube URL and DAKER submission receipt.

No external or human evidence may be replaced by an agent persona or a local
manifest.
