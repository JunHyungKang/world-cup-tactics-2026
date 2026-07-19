# Corner War Room Interaction Acceptance Contract

Status: `MACHINE PASS — 78/78 unit/contract and 56/56 four-project pre-release;
BG-12 public release pending; physical VoiceOver and human comprehension
unavailable / no claim`

This contract turns the selected thesis into observable browser behavior. The
former `Touchline Lab` shell has been replaced with Corner War Room. Chromium,
mobile Chromium, Firefox, and WebKit now prove the native-button, keyboard,
mouse drag/invalid-drop, replay, counterexample, reset, Axe, and `320×568`
paths from a repository-style deployment subpath. BG-12 still requires the
stamped public release. Physical VoiceOver and human comprehension were not
observed and support no usability, preference, or memorability claim.

## Five-second first screen

The first viewport has four layers only:

1. `코너 수비에 한 명 더. 역습에는 한 명 덜.`
   `One more for the corner. One fewer for the break.`
2. one role slot labeled `역습 1명` and the instruction `역습 1명을 남길지,
   코너 수비 임무로 돌릴지 선택하세요`;
3. four pitch-edge mission slots: `숏 코너 견제`, `니어포스트 수비`,
   `중앙·파포스트 수비`, `세컨드볼 대비`;
4. `2018 브라질 경기 기록 · 결과 예측 아님 · 프로젝트에서 정의한 구역`.

No full receipt, Council tabs, methodology paragraph, loading step, or author
instruction appears before the first move. The 42-row receipt opens only after a
duty is selected. The role snaps to a mission slot at a region edge, not a player
coordinate inside the region. A visible legend says `노란 표시는 정확한 선수
위치나 도달 범위가 아니라 추가 수비 임무입니다.`

At 320×568, all four layers, the role button, and all four mission buttons must
have bounding rectangles inside the initial viewport at `scrollY = 0`; hiding,
clipping, or shrinking a hit target does not pass. The visual pitch must retain at
least 294 CSS px usable width or provide separate non-overlapping 44×44 px mission
buttons.

## State and derived presets

```text
duty = outlet | check-short | near-post-side | central-to-far | second-ball
windowId = null | one source-linked Brazil corner window ID
windowKind = none | contact | counterexample
frameIndex = 0 when windowId is null; otherwise integer 0..N-1
playback = idle | playing | paused | complete
view = observation | promise | counterexample
moveMode = inactive | choosing-destination
```

The derived artifact owns, per defensive duty:

```text
contactWindowId = one audited window touching that duty, or null
counterexampleWindowId = one boundary-robust shot window, or null
orderedEventIdsByWindow
fixed endpoint/outlet counts, rectangles, sensitivity ranges, source hashes
evidenceFingerprint
```

A missing preset is shown honestly as `검증된 예시 기록이 없습니다.`; the UI never substitutes
a nearby scene. A missing contact preset resolves to `windowId = null`,
`windowKind = none`, `frameIndex = 0`, and `playback = idle`; replay controls are
absent. A missing counterexample preset leaves the active contact state unchanged
and makes `반례 보기` absent with the same unavailable message. `duty = outlet`
has no selected priority and no counterexample.
Its explicit state is `먼저 수비 임무를 선택하면 선택과 닿지 않은 슈팅 기록을
확인할 수 있습니다.`

Initial state is `outlet / null / none / 0 / idle / observation / inactive`.
The full receipt and evidence panels are closed.

## Exact transitions

| Trigger | State transition | Consequence |
|---|---|---|
| Commit a defensive destination with a contact preset | set `duty`; `windowId = contactWindowId[duty]`; `windowKind = contact`; `frameIndex = 0`; `playback = paused`; `view = promise` | Role snaps to mission slot; receipt opens; selected contact highlights; replay waits for explicit `재생` |
| Commit a defensive destination without a contact preset | set `duty`; `windowId = null`; `windowKind = none`; `frameIndex = 0`; `playback = idle`; `view = promise` | Receipt opens with `검증된 예시 기록이 없습니다.`; replay controls are absent |
| Play | `playing` from current frame | Ordered events advance only within active window |
| Pause | `paused` | Current transcript and frame remain |
| Previous/next event | decrement/increment `frameIndex`; stay paused | One source event changes |
| Playback reaches last event | `complete` | Last event stays visible; replay button becomes `처음부터 재생` |
| Previous at frame 0 / next at frame N-1 | no transition; boundary button is disabled | Frame and transcript remain unchanged |
| `처음부터 재생` from complete | `frameIndex = 0`; `playback = playing` | Active window restarts from its first ordered event |
| Open available `반례 보기` | `windowId = counterexampleWindowId[duty]`; `windowKind = counterexample`; `frameIndex = 0`; `playback = paused`; `view = counterexample` | Boundary-robust non-contact shot window appears and waits for explicit `재생` |
| Counterexample preset is missing | no state transition; action is absent | `검증된 예시 기록이 없습니다.` remains visible |
| Keep `역습 1명` high | set initial state | Receipt closes; no defensive-priority claim |
| Invalid drop, Escape, pointer cancel/lost capture | restore pre-gesture state | No evidence projection changes |
| Reset | initial state; focus returns to role button | Receipt closes; status says `처음 상태로 돌아왔습니다. 과거 기록과 고정 집계는 그대로입니다.` |

Changing `windowId` legitimately changes the rendered event IDs. Replay may only
render the ordered prefix/current item belonging to the active window.

## Immutable source versus reactive projection

The following never change across duties, replay, counterexample, or reset:

- evidence fingerprint and ordered corpus;
- 42 source windows and 11 Brazil-shot windows;
- endpoint receipt `14 / 17 / 10 / 1`;
- outlet-band aggregate `10 / 42`;
- source hashes, rectangles, sensitivity ranges, and event ordering;
- separation between Brazil attacking and defending-team event channels.

Only these projections may react to a duty:

- role slot, selected mission outline, and current-duty label;
- highlighted Brazil contact membership and selected-duty counts;
- `내 약속 (Coach)` sentence;
- contact preset and boundary-robust counterexample preset.

Only `frameIndex/playback` may react during replay. The active-window transcript
and markers change with the ordered frame; fixed aggregates and fingerprint do
not. Shot terminal placeholders never render as paths.

Expose the build-time fingerprint in testable metadata. Capture the input-path
equivalence snapshot synchronously after commit and before any replay input.
Mouse, touch, and keyboard flows must then match exactly:

```text
{ duty, windowId, windowKind, frameIndex, selectedContacts,
  promiseCopyKey, counterexampleWindowId, evidenceFingerprint }
```

## Post-move evidence hierarchy

After the first move, reveal in this order:

1. `내 약속 (Coach)`: for example `세컨드볼 대비 우선 · 역습 1명 수비 전환`.
2. one source-linked recorded contact window and explicit replay controls.
3. two evidence sections under `두 기록은 서로 다른 장면이므로 하나의 점수로
   합치지 않습니다`:

| 브라질 공격 기록 · 선택한 구역만 강조 | 당시 수비팀 걷어내기·패스 기록 · 고정 |
|---|---|
| 선택 구역과의 겹침 강조만 바뀜 | `선택해도 바뀌지 않음` |
| delivery/follow-up/shot-location contact | defending-team Pass/Clearance segment touching outlet band |

4. one primary next action: `반례 보기 (Skeptic)` with the literal description
   `이 선택으로 설명되지 않는 슈팅 기록`.
5. `관찰 (Scout)` as supporting trust detail: `코너킥 전달 지점 42개: 숏 코너
   14, 니어포스트 17, 중앙·파포스트 10, 기타 1`; the sensitivity disclosure states
   that fixed-order delivery wins are short `27/81` and near side `54/81`; this
   sensitivity is a boundary warning, not evidence of one universally dominant
   bucket.

There are no Council tabs. Role names are secondary labels, not AI avatars. There
is no plus/minus, grade, traffic-light score, recommendation, or combined total.
The defending-team panel never claims the user caused, lost, or completed an
outlet/counterattack; it is fixed historical context.

## Input and focus contract

Use Pointer Events with pointer capture for the mouse/pen drag enhancement. The
complete native-button path owns touch and keyboard; do not use HTML drag-and-drop.

### Native selection path

- `역습 역할 1명을 수비 임무로 옮기기` is a button with `aria-controls`; it is only a
  focus jump and does not expose `aria-expanded` because the controlled buttons
  are always visible.
- Keep-high and the four mission buttons are visible and enabled from the first
  frame; clicking one directly commits. Activating the role sets
  `moveMode = choosing-destination` and focuses the first already-visible
  destination without revealing or enabling a second control set.
- Tab/Shift+Tab move through native buttons; Enter/Space commits. Do not invent
  arrow-key behavior for a button group.
- Escape or commit returns focus to `역습 1명 옮기기`.
- Selected destination uses text/icon plus `aria-pressed` or a radio equivalent;
  color is not the only signal.

### Pointer and touch paths

- Mouse/pen drag is a progressive enhancement. The token uses
  `setPointerCapture`, a movement threshold, and
  post-drag click suppression;
- `pointerup` releases capture; `pointercancel`, `lostpointercapture`, scrolling,
  invalid drop, or unmount restores the pre-gesture duty;
- hit testing uses the rendered mission-button rectangles, not data-coordinate
  rectangles, so responsive transforms cannot move the drop target;
- shared visual boundaries never decide a drop because mission slots are distinct
  buttons outside overlapping evidence geometry.
- Touch uses the visible native select-then-destination buttons. Touch drag is
  explicitly unsupported until a physical-device drag/cancel/scroll ledger exists;
  synthetic `dispatchEvent` evidence cannot promote it to a supported path.

One commit produces one `role=status`, `aria-live=polite`, `aria-atomic=true`
announcement outside the replay subtree:

`역습 역할 1명을 [임무]로 전환했습니다. 과거 기록과 고정 패널 수치는
그대로이고, 선택 구역과의 겹침 표시만 바뀌었습니다.`

## Replay and nonvisual evidence

Controls have exact labels: `재생`, `일시정지`, `처음부터 재생`, `이전 장면`,
`다음 장면`, and visible `현재 n / 전체 N`. Reset returns focus to the role
button. No evidence autoplays after commit. Reduced-motion mode disables all
path-drawing transitions; explicit stepping produces the same final semantic
snapshot.

SVG/canvas pitch evidence is `aria-hidden`. A synchronized semantic event list
provides, for each rendered/current event:

- team channel (`브라질 공격` or `당시 수비팀`);
- event kind;
- period and match clock;
- selected-region contact/not-contact where applicable;
- source event ID.

Evidence panels are `<section aria-labelledby>`. The transcript, live message, and
controls must let a screen-reader user complete role move → contact replay →
counterexample → reset without consulting the visual pitch.

## Visual and responsive gates

- Brazil evidence: solid line/filled marker plus `BRA`; defending-team evidence:
  dashed line/hollow marker plus `DEF`.
- Selected mission: thicker outline plus check icon/text.
- Pass/Clearance legend: `기록된 시작·끝점을 직선으로 연결한 표시`.
- Shot is a shooting-location marker only.
- Normal text contrast is at least 4.5:1; large text, focus indicators, essential
  line/marker/region boundaries are at least 3:1.
- Forced-colors/high-contrast mode preserves solid/dashed, filled/hollow, and
  selected-state distinctions.
- Every target is at least 44×44 CSS px and center hit-testing reaches the intended
  button.

Desktop uses pitch/receipt columns without overlays. Tablet stacks when two
panels cannot each retain 280px. Mobile order after a move is headline → pitch →
mission tray → observation/promise → reactive evidence → fixed historical
evidence → counterexample. No `position: fixed` element may cover content.
Korean labels may wrap but never truncate.

## Data loading and failure

Use build-time JSON import. Pass the imported raw object into a child below the
React ErrorBoundary. During render, the child calls `validateArtifact`; on `Err`
it throws a typed `ArtifactValidationError`, and the boundary renders the error
UI. Do not validate/throw at module top level.

- missing file or hash mismatch fails the production build, proven by a negative
  check that builds against a temporary missing/tampered fixture and expects a
  non-zero exit;
- an invalid imported object reaches an ErrorBoundary that says `검증된 기록을
  불러오지 못했습니다. 합성 결과를 대신 표시하지 않습니다`;
- no URL query, local storage, cookie, or production code path selects a bad test
  fixture;
- invalid-object behavior belongs in component integration tests using a separate
  test dependency/alias, not a switch shipped in normal `dist`;
- production dependency and asset inspection must find zero references to
  `evaluatePrototypeTactic`, formation/press/width controls, old metric labels,
  or a bad-fixture token.

No external API, server-side calculation, service worker, runtime model, random
number, clock, or warm browser state affects a result.

## Required browser evidence

Playwright projects before submission:

- Chromium desktop mouse;
- touch-enabled Chromium mobile;
- WebKit mobile;
- Firefox desktop.

Tests must use a production build and cover:

1. first-fold bounding boxes, `scrollY = 0`, 44px targets, center hit tests,
   clipping and label overflow—not visibility alone;
2. real mouse pointer sequence, touch select-then-destination, keyboard path, plus
   component tests for pointer cancel/lost capture;
3. equal semantic snapshots for all three input paths;
4. fingerprint/fixed aggregates unchanged across all duties, frames,
   counterexamples, and reset; rendered IDs equal the expected active-window
   prefix/current event;
5. contact preset and counterexample preset for each duty, or honest unavailable
   UI; outlet state has neither;
6. SVG/path primitive assertions proving no Shot placeholder segment;
7. dirty local/session storage and cookies before refresh still produce the clean
   initial snapshot; same-origin static requests only, service worker count zero,
   console/page errors zero;
8. production Playwright checks 1440×900, 768×1024, 390×844, and 320×568 across
   initial, every duty, replay, and counterexample states. A component browser
   test injects invalid data and checks the error state at the same viewports;
   normal `dist` has no fixture alias/switch. Both paths assert no horizontal
   overflow, hidden clipping, obscured control, or overlay intersection;
9. reduced motion: computed animation/transition duration zero,
   same stepped result;
10. Axe scans in the initial, every-duty post-move, counterexample, and isolated
    invalid-data states, plus keyboard/forced-colors browser evidence and the
    SHA-bound independent-agent artifact review in `docs/submission-ledger.md`;
    physical VoiceOver remains unavailable/no-claim;
11. exact forbidden conclusion checks for `막았다`, `방어 성공`, `예방`, `최적`,
    `승률`, `xG 변화`, and `AI 추천`, with disclaimers evaluated separately;
12. normal `dist` contains no synthetic engine/copy or test-fixture switch;
13. role Enter/Space focuses the intended already-visible destination; Escape
    restores role focus without semantic/status change; commit restores role
    focus with exactly one status update; replay steps emit no live update; reset
    restores initial state; the role button never exposes `aria-expanded`;
14. the pitch is `aria-hidden`; current event/team/clock/contact/source ID in the
    transcript stays synchronized at every step; focus is visible and unobscured,
    and forced-colors selection remains non-color-only;
15. invalid-data component state has `role=alert`, zero manager controls/receipts,
    and zero synthetic substitute copy.

The final suite maps these items one-to-one to report IDs `BG-01` through
`BG-15`; all IDs must pass in all four Playwright projects. The implementation
exposes test-only semantic read surfaces, never switches: `semantic-snapshot`,
`evidence-fingerprint`, `fixed-aggregates`, `current-event-transcript`,
`evidence-pitch`, `evidence-receipt`, `selected-indicator`, `data-layout-critical`,
and `data-motion`. The snapshot contains the documented state plus ordered and
rendered event IDs, event kinds, current event metadata, and deterministic
`announcementCount`. Production data is imported through `@corner-scenarios`;
only `vite.invalid-artifact.config.ts` aliases that import to the invalid fixture.
The normal production build must contain neither the fixture nor a runtime switch.

## 60-second demo

- `0–5`: headline and one role tradeoff;
- `5–12`: move `역습 1명` to one duty and immediately see `내 약속`;
- `12–25`: user selects `재생`; the source-linked contact preset advances;
- `25–35`: reactive Brazil evidence and fixed historical context appear;
- `25–32`: selected and fixed records remain visibly separate;
- `32–38`: switch duty once and reset to prove a reversible state transition;
- `38–55`: select second-ball again, open `반례 보기: 이 선택이 설명하지
  못한 슈팅 기록`, and replay the non-contact shot;
- `55–60`: hold the non-contact verdict and source event ID. The counterexample,
  not a closed reset state, is the final frame.

Coach is the immediate post-move promise receipt, the source-linked replay follows,
Skeptic is the only explicit next action, and Scout is supporting trust detail
after the primary scene. Do not require opening three agent tabs.

## Stop signals

Stop/revise when any of the following is true:

- 320×568 cannot show the four-layer first action with 44px targets without
  clipping/hidden content;
- mouse/touch/keyboard semantic snapshots differ;
- the accessibility tree does not identify current event, contact state, and source ID;
- a duty changes the fingerprint, ordered corpus, or fixed aggregate;
- a duty lacks a contact/counterexample preset but the UI implies one exists;
- invalid data falls back to synthetic/empty success or a test switch enters
  production assets;
- two of five fresh users infer prevention, player reach, actual outlet use,
  counterattack success, or historical-result change after two revisions.

The machine-verifiable portion of this contract passes. The separate human
comprehension protocol remains unavailable and cannot be replaced by synthetic
personas or browser automation. Animation, visual polish, or a changing highlight
alone never pass. If a future comprehension session becomes possible, all four
exposed defensive duties must have non-null contact and counterexample presets;
otherwise that session is ineligible.
