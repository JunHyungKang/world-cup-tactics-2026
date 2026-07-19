# Five-User Manager-Loop Comprehension Protocol

Status: `READY TO RUN — accepted data and pre-release browser slice passed`

Purpose: test unprompted understanding, manipulation, evidence boundaries, and
memory. A separate optional cohort may compare it with a generic tactics-board
baseline. This is formative product research, not population-level evidence.

## Participants and setup

- Five people who did not design or implement either surface.
- Aim for varied football familiarity: at least one low, two medium, and one high.
- At least two mobile-touch sessions, one desktop-keyboard session, and one
  desktop-pointer session.
- Use the production War Room build in fresh profiles. Before each session,
  assert that all four exposed defensive duties have non-null contact and
  counterexample presets; otherwise do not start the session.
- Hold `prefers-reduced-motion` constant for all five sessions and record its
  value. Because evidence never autoplays, this affects motion only, not discovery.
- Record only anonymous ID, self-described familiarity, device/browser, timings,
  verbatim answers, observed actions, and errors. No name, email, face, voice, or
  unrelated personal data.

## Timing model

Active interface time and moderator-answer time are separate.

- five-second glance: exactly 5 active seconds, no interaction;
- first choice: at most 15 active seconds;
- spontaneous exploration: 40 active seconds;
- total unassisted War Room interaction: at most 60 active seconds;
- pause the active timer while a participant answers a moderator question;
- guided technical checks happen afterward and never count as spontaneous
  discovery or the 60-second loop.

## Neutral unassisted script

Use these sentences exactly. Do not say `결정`, `바뀐 것`, `고정`, `왼쪽/오른쪽`,
`contact`, `반례`, `Skeptic`, or `reset` before spontaneous exploration ends.

1. `이 화면을 5초 동안 봐주세요. 아직 누르지는 마세요.`
2. At exactly five seconds, cover the screen completely, then ask `이 화면에서
   무엇을 하게 될 것 같나요?`
3. Record the answer verbatim while the screen stays covered and the timer is
   paused.
4. Say `이 화면을 사용해 첫 선택을 해보세요.` Reveal the screen and start the
   15-second timer at the same moment.
5. If they ask how, answer only `화면에 보이는 방법으로 시도해 주세요.` This
   neutral prompt is recorded but does not itself fail the attempt.
6. After the first move, say only `이 화면에서 더 확인할 수 있는 것을 찾아보세요.`
   Start 40 seconds of spontaneous exploration.
7. Record whether they independently inspect the evidence sections and play the
   counterexample. Do not direct them to controls.

After the unassisted segment ends (at most 60 active seconds), stop interaction
and ask, without showing the screen:

1. `방금 화면에서 일어난 일을 설명해 주세요.`
2. `보였던 숫자와 선은 무엇을 뜻한다고 생각하나요?`
3. `친구에게 이 화면을 한 문장으로 설명한다면 어떻게 말하겠어요?`
4. `이 기록으로 실제 경기 결과에 대해 무엇을 알 수 있나요?`

Do not correct answers until every scored answer is recorded.

## Guided technical phase

After the unassisted score, reopen the surface and ask the participant to complete
these exact technical paths. These results measure operability, not discovery:

- move to a named duty using their assigned input path;
- play, pause, previous, and next event;
- open `반례 보기`, then use `재생`;
- reset and confirm focus/state restoration.

For stacked mobile panels, refer to `선택에 반응하는 기록` and `당시 수비팀
걷어내기·패스 기록`, never left/right.

## Evidence form

| Field | Evidence |
|---|---|
| Participant | `P1`–`P5` |
| Familiarity | low / medium / high, self-described |
| Device path | mobile-touch / desktop-pointer / desktop-keyboard |
| Browser/viewport | exact version and CSS pixels |
| Five-second answer | verbatim |
| One-role tradeoff | pass / fail / uncertain |
| First valid move | seconds; `>15` fails |
| Neutral prompt used | yes / no |
| Spontaneously opened evidence | yes / no; timestamp |
| Spontaneously played counterexample | yes / no; timestamp |
| Reactive-vs-historical explanation | pass / fail / uncertain; verbatim |
| Causal/reach/2026 misconception | none / present; verbatim |
| Guided input/control path | pass / fail and defect |

`Uncertain` counts as failure. Explanatory help invalidates that scored attempt;
do not restart the same person as a new participant.

## Scoring

### Five-second tradeoff — required 4/5

Pass only if both sides appear without prompting:

- leave one attacking-transition/outlet role high or bring it into corner defence;
- bringing it back reduces/deprioritizes the attacking-transition option.

Region names are not required.

### Direct manipulation — required 4/5

Pass when a valid role move is completed within 15 active seconds without
explanatory help. Drag, select-then-destination, or keyboard are equivalent.

### Evidence distinction — required 4/5

Pass when the participant independently explains that their choice changes which
Brazil records are emphasized, while the historical defending-team context and
source aggregates remain fixed. Do not award this from a prompted left/right or
changed/unchanged answer.

### Claim boundary — hard stop at 2/5

Stop if two participants say the product proves that the role:

- stopped, covered, saved, or prevented the attack;
- could physically reach every point in a region;
- caused or completed the historical outlet/counterattack;
- changed a shot, goal, xG, or historical result;
- represents a Brazil 2026 tendency.

### Spontaneous loop — required 4/5

Within the unassisted segment, the participant must understand the role, make a
move, inspect evidence, and independently find/play the counterexample. Reset is
guided operability only. Guided technical success cannot repair a spontaneous-
discovery failure.

### Delayed differentiation — separate fresh cohort

Do not use the five comprehension participants to claim comparative
differentiation. Recruit a separate five-person cohort, counterbalanced three
`War Room → baseline` and two `baseline → War Room`. Match both research-only
surfaces for visual finish, information density, and exactly 45 active seconds.
Use one written neutral script with the same action count and no product-specific
terms. The baseline must never enter competition `dist` or use a production
query/storage switch. After a three-minute distractor with neither surface
visible, ask `두 화면 각각에서 기억나는 것을 말해주세요.`

If no separate cohort is recruited, same-person or unequal-exposure observations
are labeled `exploratory` and cannot satisfy or fail the product gate.

Required:

- 4/5 recall `one more for corner means one fewer for the break` in substance;
- at least 3/5 spontaneously recall the shot record the selection did not explain;
- fail differentiation if two participants describe both products only as
  `선수를 옮기고 점수 보는 전술판` or equivalent.

## Product gate

The manager-loop comprehension `PASS` requires every primary positive threshold
and no hard stop. The separate delayed cohort is additionally required to pass a
first-place differentiation or comparative-memory claim. Do not average them.

- revise copy/hierarchy when five-second understanding fails;
- revise interaction/focus when manipulation fails;
- remove the dual-panel structure when two users read historical context as a
  simulated consequence;
- remove Council tabs permanently if counterexample discovery requires them;
- reject the concept after two revisions with the same 2/5 causal/reach failure;
- if the optional fresh comparison cohort fails after two hierarchy revisions,
  reject the generic-board differentiation claim without changing the primary
  comprehension score.

## Result table

Canonical Wave 1 evidence belongs in
`evidence/user-studies/primary-wave-1.json`. Keep it `pending` with null fields
until real observations exist. After all five anonymous rows are complete, set
the exact computed summary and run `pnpm user:audit`; the validator rejects PII,
missing device/familiarity diversity, summary drift, threshold failures, and an
averaged-away `2/5` misconception hard stop.

| ID | Device | 5s tradeoff | Move ≤15s | Evidence distinction | Counterexample found | Misconception | Guided reset/path | Decision |
|---|---|---|---|---|---|---|---|---|
| P1 | pending | pending | pending | pending | pending | pending | pending | pending |
| P2 | pending | pending | pending | pending | pending | pending | pending | pending |
| P3 | pending | pending | pending | pending | pending | pending | pending | pending |
| P4 | pending | pending | pending | pending | pending | pending | pending | pending |
| P5 | pending | pending | pending | pending | pending | pending | pending | pending |

Screen recordings require consent. The planning PDF reports aggregate results and
failure-driven revisions, never identities or raw personal recordings.
