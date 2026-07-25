# Corner Policy Lab Interaction Acceptance Contract

Status: `CURRENT PRODUCT CONTRACT — LOCAL RELEASE PASS; STAMPED BG-12 PENDING`

This is the active interaction contract. The predecessor Corner War Room contract
is preserved only under `docs/archive/corner-war-room-2026-07-19/`.

## Five-second decision

The first screen must expose, without a login or API key:

1. `조별리그에서 세우고, 토너먼트에서 검증하세요.`;
2. the fixed `48경기 참고 → 8경기 중간 평가 → 8경기 봉인 검증` split;
3. four delivery-location lanes and exactly two scarce attention tokens;
4. a predeclared `40%`, `50%`, or `60%` minimum location-overlap criterion;
5. `판단 보류`;
6. the limitation `전달 위치 겹침만 계산`.

This is a policy stress test, not a formation dashboard, reward model, win
prediction, defensive-success simulator, or optimal-tactics recommender.

## Immutable quick trial

1. The manager selects two lanes and one overlap criterion, or abstains.
2. `이 정책을 잠가 두 시험에 적용` freezes one policy fingerprint before
   either held-out result appears.
3. `16강 8경기 평가 요약 공개` evaluates all eight round-of-16 matches.
4. `같은 정책으로 봉인 검증 8경기 공개` evaluates the untouched final eight
   matches with the identical fingerprint and records `정책 변경 0회`.
5. The manager records one separate next-meeting decision and reason. This note
   cannot mutate the sealed policy, criterion, overlap result, or receipts.

The demonstration policy selects `숏 코너`, `니어포스트`, and `50%`. Its first
held-out result is `48%` and misses the predeclared criterion; its final result is
`51%` and meets it. These are delivery-location overlaps only.

## Deterministic evidence

- The three match-ID partitions are pairwise disjoint.
- All eligible held-out corners are evaluated; the UI does not choose favorable
  examples.
- Every receipt carries the same policy fingerprint, source match/event IDs,
  selected lanes, predeclared criterion, and observed overlap.
- The representative contradiction is selected by deterministic source order.
- The evidence path exposes `MatchContext`, `ScoutingPolicy`, `CornerRestart`,
  `DeliveryAction`, `ObservedEvent`, `OutcomeProxy`, and `Source`.
- `DEFENSIVE_DUTY_CAUSED`, `WOULD_PREVENT`, and `OPTIMAL_POLICY` remain
  explicitly forbidden inferences.
- Invalid or incomplete policy data produces one `role=alert` state and no
  manager controls, receipts, or synthetic substitute.

## Input and accessibility behavior

- Lane cards and pitch zones must produce the same semantic state.
- Pointer, touch, Enter, and Space must create the same policy fingerprint.
- Every actionable target is at least `44×44` CSS pixels.
- At `320×568`, the pitch, four lanes, criterion, lock, and abstention remain
  operable without horizontal overflow.
- Focus remains visible; selection is non-color-only in forced colors.
- Lock moves focus to the next reveal action. Restart restores focus to the first
  pitch zone.
- `prefers-reduced-motion` removes decorative motion without changing state.
- Axe must report no serious or critical violations on the tested states.

## Browser gates

The final suite maps one-to-one to:

- `BG-01`: first-fold hierarchy, controls, and hit targets;
- `BG-02`: pointer, touch, and keyboard policy paths;
- `BG-03`: deterministic input parity;
- `BG-04`: one immutable policy across both held-out audits;
- `BG-05`: honest abstention without a fabricated criterion;
- `BG-06`: provenance and forbidden causal inference;
- `BG-07`: clean-profile, keyless, same-origin loading;
- `BG-08`: responsive states and contained invalid data;
- `BG-09`: reduced-motion determinism;
- `BG-10`: Axe and forced-colors evidence;
- `BG-11`: forbidden positive conclusions absent;
- `BG-12`: stamped public marker, selected product, and admitted data parity;
- `BG-13`: focus, status, and immutable next-meeting semantics;
- `BG-14`: initial, selected, and contradiction screenshots;
- `BG-15`: invalid policy data fails closed.

Pre-release runs `BG-01`–`BG-11` and `BG-13`–`BG-15` across Chromium, Firefox,
WebKit, and mobile. `BG-12` is deliberately excluded until the exact stamped
public release exists. Physical VoiceOver and human comprehension remain
unavailable/no-claim.
