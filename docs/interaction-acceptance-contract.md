# Corner Scout Lab Interaction Acceptance Contract

Status: `CURRENT PRODUCT CONTRACT — CANDIDATE RELEASE; STAMPED PUBLIC BG-12 PENDING`

## Five-second decision

Without login, payment, or an API key, the first screen must make these facts
understandable:

1. the matchup is Uruguay vs Portugal in the 2018 World Cup round of 16;
2. the exact same-receipt connection is corner taker Ricardo Quaresma followed
   by the first recorded follow-up actor Raphaël Guerreiro in three scenes across
   two matches;
3. that connection does not establish a receiver, first contact, possession
   continuation, or rehearsed routine;
4. Uruguay support is split into three-axis direct receipts and situation-only
   adjacent receipts;
5. the manager must choose two concrete video-review questions;
6. the Uruguay–Portugal records stay hidden until those questions are locked;
7. `0` means no direct comparison receipt was found, not a weakness.

In short: an observation gap, not a weakness.

The canonical headline is:

> 16강 전날, 포르투갈 코너 영상은 무엇부터 볼까요?

The first-screen explanation is:

> 포르투갈의 코너마다 키커와 이후 10초 기록을 연결하고,
> 우루과이 기록은 세 조건이 모두 같은 직접 비교와 전개만 비슷한
> 참고 장면으로 나눕니다. 감독은 먼저 볼 영상 두 묶음을 고릅니다.

## Canonical manager loop

1. The manager first sees the exact Quaresma/Guerreiro player-event connection,
   its three scenes and two matches, the no-contact boundary, and sparse Uruguay
   source context.
2. Five compact review controls show Portugal match recurrence plus Uruguay
   three-axis direct and adjacent support. Source event ledgers remain available
   through progressive disclosure. The partial-pooling model stays collapsed.
3. Exactly two controls may be selected. The canonical demonstration selects
   `aerial-defending-first` and `short-attacking-first`.
4. `선택한 영상 검토 안건 2개를 맞대결 공개 전에 잠그기` freezes the two
   questions. Every question control becomes unavailable.
5. No held-out match count, shot count, or receipt is present before lock.
6. `가려 둔 우루과이–포르투갈 코너 기록 보기` reveals the fixed
   one-match model check, all five held-out
   counts and focuses the result.
7. The result labels each signature as `선택` or `선택 밖`; it never scores the
   manager or calls a selection correct.
8. The first shot-bearing unselected signature is highlighted deterministically.
   In the canonical path the visible receipt is corner `261095314`.
9. The manager saves one of `유지`, `다시 선택`, or `보류` with a reason of at
   most 120 characters. The saved note cannot mutate the locked questions or
   historical evidence.

## Exact deterministic evidence

- Product population: 603 World Cup 2018 corners across 64 matches.
- Team-forecast fit: 397 classifiable group-stage corners; frozen evaluation:
  160 classifiable knockout corners.
- Portugal evidence/tournament-prior weights: `46.7% / 53.3%`.
- All-knockout team-model log-loss reduction: `4.59%`; match-cluster 95%
  log-score-gain interval: `[0.0040, 0.1071]`.
- Team-level direction: `12/16` evaluated knockout teams improve and `4/16`
  worsen; the mean result is not a universal team guarantee.
- Uruguay-conditioned challenger: `REJECT`; `P(gain > 0) = 0.9226 < 0.975`.
- Pre-match Portugal/Uruguay signature counts:
  `7/2`, `1/2`, `4/0`, `1/0`, `1/1`.
- Exact same-receipt player-event connection:
  Quaresma `32597` → first recorded follow-up actor Guerreiro `28907`,
  three scenes across two matches, corner IDs `258702651`, `258702667`,
  `260341439`.
- Three-axis direct/adjacent support by signature:
  `2/0`, `0/2`, `0/2`, `0/1`, `1/0`.
- Held-out signature counts:
  `5`, `2`, `0`, `0`, `3`.
- Held-out ten-second shot counts:
  `2`, `0`, `0`, `0`, `2`.
- The unclassified Uruguay corner `260303991` remains disclosed and is not
  assigned to a five-signature category.
- Player and event receipts bind source period, corner time, match, corner,
  follow-up, and first-defending event IDs to accepted Events, Matches, and
  Players sources and their SHA-256 hashes.
- Invalid or incomplete data produces one `role=alert` state and no selection,
  lock, reveal, receipt, or synthetic substitute.

## Input, responsive, and accessibility behavior

- Pointer, keyboard, and real mobile-touch paths create the same selected set.
- Selection, lock, reveal, evidence details, meeting decision, save, and restart
  remain keyboard-operable with visible focus.
- Primary action targets are at least `44×44` CSS pixels.
- At `320×568`, the first selection control is reachable, the commit action
  remains operable, and the page has no horizontal overflow.
- The five-column result comparison may scroll only inside its labelled
  container.
- Color is never the sole carrier of team identity, selection, or observation
  gap.
- Reduced-motion and forced-colors modes preserve the same text evidence and
  deterministic state.
- Axe reports no violations on initial, revealed, saved-note, and invalid states
  in the tested browser matrix.

## Claim boundary

The UI may say:

- `포르투갈이 공격한 코너`;
- `우루과이가 수비한 코너`;
- `첫 기록의 팀/선수`;
- `직접 비교` and `참고 장면`;
- `이 작은 표본에서 직접 비교 장면을 찾지 못함`;
- `10초 안 슈팅 기록`;
- `영상 검토 안건`;
- `포르투갈 3/3경기`;
- `우루과이 0/3경기 · 관찰 공백`.

It must not say:

- affirmative `우루과이의 약점` claims;
- `포르투갈의 성공 공식`;
- `최적 훈련` or `AI 추천`;
- `수비가 막았다` or `훈련이 예방했다`;
- receiver, first-contact winner, marking assignment, or player reach.
- rehearsed routine, pass target, or possession continuation.

## Browser gates

- `BG-01`: named teams, exact player-event connection, semantic boundary,
  three-axis support, analysis path, and first controls;
- `BG-02`: pointer, touch, and keyboard select the same two questions;
- `BG-03`: exact two-question lock and immutable controls;
- `BG-04`: held-out match absent before reveal;
- `BG-05`: exact five-signature counts and shot counts after reveal;
- `BG-06`: deterministic unselected counterevidence `261095314`;
- `BG-07`: source actors and receipts without invented football roles;
- `BG-08`: keyless, stateless, same-origin loading;
- `BG-09`: responsive layout and contained invalid state;
- `BG-10`: reduced-motion determinism and forced-colors evidence;
- `BG-11`: axe and keyboard focus evidence;
- `BG-12`: stamped public marker, release, source hashes, model evidence, and URL parity;
- `BG-13`: immutable next-meeting note;
- `BG-14`: initial, selected, and revealed screenshots;
- `BG-15`: recommendation, weakness, causality, and outcome claims absent.

Pre-release runs every gate except public-only `BG-12`. Physical VoiceOver,
human comprehension, and player likeness rights remain separate and are not
claimed by browser automation.
