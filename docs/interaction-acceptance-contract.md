# Corner Prep Lab Interaction Acceptance Contract

Status: `CURRENT PRODUCT CONTRACT — CANDIDATE RELEASE; STAMPED PUBLIC BG-12 PENDING`

## Five-second decision

Without login, payment, or an API key, the first screen must make these facts
understandable:

1. the matchup is Uruguay vs Portugal in the 2018 World Cup round of 16;
2. Portugal's attacking corners and Uruguay's defensive exposures are separate;
3. the app compares repeated event chains, not only pitch locations;
4. the manager must choose two training questions;
5. the Uruguay–Portugal records stay hidden until those questions are locked;
6. `0` means an observation gap, not a weakness.

The canonical headline is:

> 포르투갈이 반복한 코너 전개, 우루과이는 이미 겪어봤을까요?

The first-screen explanation is:

> 포르투갈이 공격한 코너 14개에서 반복 전개를 찾고, 우루과이가 수비한
> 코너 6개에서 같은 이벤트 연쇄가 있었는지 대조합니다. 그 차이로
> 훈련에서 먼저 볼 질문 두 개를 정합니다.

## Canonical manager loop

1. The manager compares all five sequence signatures and can open their source
   event ledgers.
2. Exactly two controls may be selected. The canonical demonstration selects
   `aerial-defending-first` and `short-attacking-first`.
3. `선택한 훈련 질문 2개를 맞대결 공개 전에 잠그기` freezes the two
   questions. Every question control becomes unavailable.
4. No held-out match count, shot count, or receipt is present before lock.
5. `가려 둔 우루과이–포르투갈 코너 기록 보기` reveals all five held-out
   counts and focuses the result.
6. The result labels each signature as `선택` or `선택 밖`; it never scores the
   manager or calls a selection correct.
7. The first shot-bearing unselected signature is highlighted deterministically.
   In the canonical path the visible receipt is corner `261095314`.
8. The manager saves one of `유지`, `다시 선택`, or `보류` with a reason of at
   most 120 characters. The saved note cannot mutate the locked questions or
   historical evidence.

## Exact deterministic evidence

- Product population: 603 World Cup 2018 corners across 64 matches.
- Pre-match Portugal/Uruguay signature counts:
  `7/2`, `1/2`, `4/0`, `1/0`, `1/1`.
- Held-out signature counts:
  `5`, `2`, `0`, `0`, `3`.
- Held-out ten-second shot counts:
  `2`, `0`, `0`, `0`, `2`.
- The unclassified Uruguay corner `260303991` remains disclosed and is not
  assigned to a five-signature category.
- Player and event receipts are bound to accepted Events, Matches, and Players
  sources and their SHA-256 hashes.
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
- `첫 후속 기록의 팀/선수`;
- `같은 분류를 사전 기록에서 찾지 못함`;
- `10초 안 슈팅 기록`;
- `훈련에서 먼저 볼 질문`.

It must not say:

- `우루과이의 약점`;
- `포르투갈의 성공 공식`;
- `최적 훈련` or `AI 추천`;
- `수비가 막았다` or `훈련이 예방했다`;
- receiver, first-contact winner, marking assignment, or player reach.

## Browser gates

- `BG-01`: named teams, analysis path, small-sample boundary, first controls;
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
- `BG-12`: stamped public marker, release, source hashes, and URL parity;
- `BG-13`: immutable next-meeting note;
- `BG-14`: initial, selected, and revealed screenshots;
- `BG-15`: recommendation, weakness, causality, and outcome claims absent.

Pre-release runs every gate except public-only `BG-12`. Physical VoiceOver,
human comprehension, and player likeness rights remain separate and are not
claimed by browser automation.
