# Corner Prep Lab Interaction Acceptance Contract

Status: `CURRENT PRODUCT CONTRACT — CANDIDATE RELEASE; STAMPED BG-12 PENDING`

This is the canonical manager loop. The planning PDF's two-role/two-area
interaction is retained only as a falsified product hypothesis: its team-level
information gain disappeared after the categories were compressed. The release
keeps the useful structure—scarce resource, precommitment, hidden reveal, and a
next-meeting decision—and replaces the unsupported placement claim with a
record-backed rehearsal allocation.

## Five-second decision

The first screen must expose, without login, payment, or an API key:

1. `포르투갈 코너 상황 3유형. 훈련 10회를 어떻게 나눌까요?`;
2. Portugal's `14/14` classifiable attacking corners and Uruguay's `5/6`
   classifiable defensive situations as separate ledgers;
3. the three deterministic categories:
   `숏 구역 전달`, `비숏 · 공중 후속 기록`, and
   `비숏 · 기타 후속 기록`;
4. the observed Portugal counts `7/5/2` and Uruguay counts `2/2/1`;
5. exactly ten manager-controlled rehearsal repetitions;
6. the fact that Uruguay–Portugal's ten corners remain hidden until the
   allocation is locked;
7. the boundary that recorded players and events do not establish marking,
   positioning, rehearsal effectiveness, defensive success, or an optimal
   tactic.

This is a historical match-preparation rehearsal, not an AI recommendation,
formation simulator, reward model, win prediction, or causal evaluation.

## Canonical manager loop

1. The manager allocates all ten repetitions across the three observed
   situations. The demonstration path is `5/4/1`, proportional to Portugal's
   group-stage `7/5/2` record after integer rounding.
2. `훈련 10회를 결과 전에 잠그기` freezes the allocation before any
   Uruguay–Portugal result appears. All add and subtract controls become
   unavailable.
3. `가려 둔 맞대결 첫 전개 보기` separately reveals the held-out `5/2/3`
   record.
4. The product shows the signed differences as `횟수 차이 0`,
   `훈련 배분이 2회 많음`, and `실제가 2회 많음`. These are descriptive
   counts, not a score or correctness verdict.
5. Each category exposes a deterministic source receipt using `키커`,
   `첫 후속 기록의 선수`, match ID, and corner event ID. It must not relabel
   an actor as a receiver, contact winner, or marking assignment.
6. The manager records one next-meeting choice and a reason of at most 120
   characters with `다음 회의 메모 저장`. The memo cannot mutate the sealed
   allocation, revealed counts, event receipts, or claim boundary.

The held-out match also reports that four of Portugal's ten corners were followed
by an attacking shot within ten seconds. The product explicitly states that the
data cannot identify which rehearsal allocation would have prevented those
shots.

## Deterministic evidence

- `team_scouting.corner_situation_rehearsal.status` must be `PASS`.
- Portugal, Uruguay, and held-out match identities are fixed to
  `Portugal`, `Uruguay`, and `Uruguay - Portugal`.
- The reference, defensive-situation, and held-out totals are exactly
  `14/14`, `5/6`, and `10/10`.
- The three category counts are exactly `7/5/2`, `2/2/1`, and `5/2/3`.
- Player joins for the displayed receipt fields are provenance-bound to the
  admitted Events, Matches, and Players sources.
- The source files and product data binding are SHA-256-bound in the stamped
  release marker.
- `MARKING_ASSIGNMENT`, `REHEARSAL_EFFECTIVENESS`,
  `DEFENSIVE_SUCCESS_CAUSED_BY_PLAN`, and `OPTIMAL_MATCHUP_TACTIC` remain
  forbidden inferences.
- Invalid or incomplete situation data produces one `role=alert` state and no
  allocation controls, reveal action, receipts, or synthetic substitute.

## Input and accessibility behavior

- Pointer and keyboard must create the same `5/4/1` semantic allocation; a real
  touch path is exercised by the mobile browser project.
- Add, subtract, lock, reveal, meeting choice, save, and restart actions remain
  keyboard-operable with visible focus.
- Primary actionable targets are at least `44×44` CSS pixels.
- At `320×568`, the first allocation control is reachable, the commit bar stays
  operable, and no page-level horizontal overflow appears.
- The revealed comparison may scroll inside its labelled table container, but
  must not widen the document.
- Color is never the only carrier of team identity or count differences.
- `prefers-reduced-motion` and forced-colors modes preserve the same text
  evidence and deterministic state.
- Axe must report no violations on initial, revealed, and invalid states in the
  tested browser matrix.

## Browser gates

The final suite maps one-to-one to:

- `BG-01`: first-fold named-team evidence, controls, and hit targets;
- `BG-02`: pointer, touch, and keyboard allocation paths;
- `BG-03`: hidden held-out result and immutable precommit;
- `BG-04`: exact `5/2/3` reveal and `0/-2/+2` descriptive differences;
- `BG-05`: player-linked event receipts without invented football roles;
- `BG-06`: structural correction, provenance, and causal boundary;
- `BG-07`: clean-profile, keyless, stateless, same-origin loading;
- `BG-08`: responsive states and contained invalid data;
- `BG-09`: reduced-motion determinism;
- `BG-10`: Axe and forced-colors evidence;
- `BG-11`: recommendation, causality, and outcome claims absent;
- `BG-12`: stamped public marker, selected release, and exact data parity;
- `BG-13`: focus, status, and immutable next-meeting memo;
- `BG-14`: initial, allocated, and revealed screenshots;
- `BG-15`: invalid situation data fails closed.

Pre-release runs `BG-01`–`BG-11` and `BG-13`–`BG-15` across Chromium, Firefox,
WebKit, and mobile. `BG-12` remains excluded until the exact stamped public
release exists. Physical VoiceOver, real-user comprehension, and player image or
likeness rights remain separate evidence gates and are not claimed by browser
automation.
