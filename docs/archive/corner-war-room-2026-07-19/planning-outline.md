# Planning PDF Source Contract

Status: `PLANNING CANDIDATE — CURRENT IMPLEMENTATION, NOT SUBMITTED`

Product: `Corner War Room`

Product data scope: `official-open-historical-tactics`

Product selection ID: `corner-war-room`

This is the page-level source of truth for the eight-page DAKER planning PDF.
It represents the implemented data-bound app, not the rejected synthetic
prototype. The PDF may report automated and source evidence that exists; it may
not claim human preference, intuitive usability, comparative memorability,
physical VoiceOver, deployed-build BG-12, or public submission evidence before
those observations exist.

Official evaluation contract: first-round top ten by submitter `60%`, participant
`20%`, and public `20%` voting; second-round internal score is originality `30`,
manager-experience design `25`, completeness `25`, and planning/implementation
consistency `20`.

## Page 1 — The manager decision

**Required content:** service overview and manager-experience intent.

**Headline:** `코너 수비에 한 명 더. 역습에는 한 명 덜.`

Corner War Room gives the judge one scarce outlet role. Keep it high for the
break, or move it into one of four corner-defending priorities. The first screen
shows the tradeoff, the movable role, four native mission buttons, and the exact
boundary `2018 브라질 경기 기록 · 결과 예측 아님 · 프로젝트에서 정의한 구역`.

Use the current-build three-frame gallery composite, not a conceptual wireframe:
`역습 1명` → `역습 1명 수비 전환` → `설명되지 않는 슈팅 · 출처 ID`. The
first-round gallery promise is the same as the product promise: one more for the
corner means one fewer for the break. No login, AI avatar, formation editor,
score, or method table precedes the decision.

**Official mapping:** originality `30` and manager-experience design `25`.

## Page 2 — The app argues back

**Required content:** differentiation and design intent.

Generic formation boards reward movement with a score. Corner War Room puts the
manager's promise on trial with immutable evidence. After a duty move it shows a
record touching the selected project-defined priority, then offers
`반례 보기: 이 선택으로 설명되지 않는 슈팅 기록`.

The current UI states before the number: `전술 효과를 나타내는 점수가 아닙니다. 선택한
우선 구역과 과거 기록이 겹친 횟수입니다.` The counterexample states:
`이 슈팅 기록에는 선택한 우선 구역과 겹치는 지점이 없습니다. 이 선택이
슈팅을 막았을지는 알 수 없습니다.` These are observation boundaries, not a prevention, reach, xG,
optimality, or alternate-result claim.

Show current selected and counterexample screenshots. The distinctive product
mechanism is not “AI recommends”; it is “the evidence is allowed to disagree.”
No human preference, usability, comprehension, or memorability result is claimed.
The challenge is not hand-picked after the choice: the same fixed rule runs over
all 42 windows; all four duties own both a contact record and a non-contact shot
counterexample; the source bytes and fingerprint never change with selection.

**Official mapping:** originality `30`.

## Page 3 — The 60-second manager loop

**Required content:** primary user flow.

Use six visible beats rather than an engineering timeline:

1. `0–5s` — cold-open the real initial, role-reclaimed, and counterexample
   frames; then begin the continuous manager take.
2. `5–12s` — move `역습 1명` to a defensive priority; see `내 약속` and the
   explicit `전술 효과를 나타내는 점수가 아닙니다` boundary.
3. `12–25s` — replay a source-linked recorded window; distinguish selected
   emphasis from fixed historical context.
4. `25–32s` — hold selected and fixed records together.
5. `32–38s` — switch duty once and reset, proving reversibility while the source
   fingerprint and fixed counts remain unchanged.
6. `38–60s` — select again, open and replay the non-contact shot, and end on its
   verdict plus source ID.

End the demo on the counterexample message and source badge, not on methodology
or an unsupported success claim. Reset remains available as reliability proof.

**Evidence boundary:** synthetic persona review informed hierarchy and copy but
is not human user evidence. Human study is unavailable; no `4/5` claim appears.

**Official mapping:** manager-experience design `25`.

## Page 4 — One page, every input

**Required content:** page composition and core interaction specification.

The implemented one-page flow progressively reveals evidence:

| State | Visible product surface |
|---|---|
| Initial | headline, pitch, movable outlet role, four 44px mission buttons, limitation badge |
| Selected | snapped role, visible evidence anchor, `내 약속`, non-causal count boundary, replay |
| Challenge | focused counterexample heading, explicit non-contact verdict, synchronized transcript |
| Reset | initial semantic state and immutable-source status |

Mouse drag, native touch buttons, and keyboard reach the same semantic snapshot.
The pitch is hidden from assistive technology; the synchronized transcript exposes
team, event type, clock, contact/non-contact state, and source ID. The PDF uses
uncropped `390×844` current-build mobile captures; the separate `320×568`
browser contract, reduced motion, forced colors, focus, and invalid-data alert
have automated proof. Synthetic touch is not physical-device evidence.

**Official mapping:** manager-experience design `25` and completeness `25`.

## Page 5 — Real World Cup evidence, honest limits

**Required content:** data use, provenance, license, and limitations.

The product uses exactly two accepted Figshare CC BY 4.0 sources: Pappalardo and
Massucco World Cup 2018 Events and Matches. Pinned raw hashes feed a deterministic
transform that publishes a minimum attributed derivative: 42 Brazil corner
windows across five matches, with source match/event IDs and one immutable
evidence fingerprint.

Accepted reproduced facts include 11 shot windows, one goal-tagged shot window,
delivery endpoints short `14`, near-post-side `17`, central-to-far `10`, other
`1`, and defending-team outlet-band Pass/Clearance contact in `10/42` windows.
The two event channels remain separate and never become a combined score.

Required limitation: recorded points/endpoints are not continuous ball
trajectories, player tracking, reach, possession, causality, or an unobserved
alternate result. The role regions are project-defined priorities, not learned
player assignments. OpenFootball and FIFA research do not ship as product data.

Attribution: `Soccer Match Event Dataset — Luca Pappalardo and Emanuele Massucco,
Figshare, CC BY 4.0; transformed by this project. No endorsement implied.`

**Official mapping:** completeness `25` and planning/implementation consistency
`20`.

## Page 6 — A deterministic adversary, not a prediction model

**Required content:** decision engine and feedback method.

Data flow: `pinned raw files → checksum/schema gate → 42 recorded windows →
coordinate normalization → project-defined regions → immutable derivative →
selected emphasis + fixed context + least-explained shot`.

Promotion proof is current: two accepted sources, deterministic transformation,
`42/42` structural and semantic review, all `4/4` duties owning a contact preset
and counterexample, visible source attribution, fail-closed invalid data, and no
synthetic fallback. The UI reads every exposed count and source identifier from
the validated artifact.

Forbidden claims remain: stopped, covered, saved, prevented, optimal, xG change,
win probability, completed counterattack, Brazil 2026 tendency, or AI
recommendation.

**Official mapping:** originality `30` and completeness `25`.

## Page 7 — What is proven now

**Required content:** technical architecture and evaluation readiness.

Architecture: static React/TypeScript, build-time imported derived JSON, no
runtime model, server calculation, external API, login, payment, secret key,
randomness, or warm profile dependency.

| Evidence | Current status |
|---|---|
| Unit and contract suite | `78/78 PASS` |
| Core Chromium manager loop | `4/4 PASS` |
| Pre-release browser contract | `56/56 PASS` across Chromium, mobile Chromium, Firefox, WebKit |
| Data lineage and audit | two accepted sources; `42/42 PASS` |
| Input race regression | BG-03 repeated `40/40 PASS` after reset-focus fix |
| Deployed build fingerprint BG-12 | `PENDING — requires stamped public deployment` |
| Physical touch and VoiceOver | `PENDING — human observation unavailable` |
| Human preference and memorability | `UNAVAILABLE — no claim` |

Synthetic novice, coach, and accessibility personas were adversarial design
input only. They did not create participant results or a usability PASS.

**Official mapping:** completeness `25`.

## Page 8 — Plan-to-build consistency and delivery

**Required content:** evaluation readiness, schedule, risks, and delivery.

| Official criterion | Points | Bound product proof |
|---|---:|---|
| Originality | `30` | scarce-role promise challenged by a source-linked shot |
| Manager experience | `25` | direct move → replay → reversible reset → counterexample/source ID |
| Completeness | `25` | accepted data, deterministic state, fail-closed app, major-browser proof |
| Planning/implementation consistency | `20` | same wording, flow, data hash, screenshots, repository, video, and release commit |

First round: top ten by submitter `60%`, participant `20%`, and public `20%`
voting. Gallery title, first image, PDF page 1, and video first five seconds use
the same tradeoff. Submit the earliest fully valid package after all preflights;
never submit an incomplete draft merely for timestamp advantage.

Hard deadlines: planning PDF `2026-07-27 10:00 KST`; deployed URL, public GitHub,
and YouTube `2026-08-03 10:00 KST`; no later Git commits. Public deployment,
BG-12, manual VoiceOver/visual evidence, video, repository, owner submission, and
freeze receipts remain future final-phase proof.

## PDF production gate

The planning candidate may be rendered now from current implementation evidence.
It may be submitted only after `pnpm verify`, source/PDF hash binding, eight-page
render inspection, an independent-human visual-QA ledger row, plan preflight,
and owner confirmation. The external upload and confirmation remain owner-only.
