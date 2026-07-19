# Research and UX Review — 2026-07-18

Status: `HISTORICAL SHELL REVIEW CLOSED — CORNER WAR ROOM IMPLEMENTED; HUMAN
STUDY UNAVAILABLE / NO CLAIM`

This review asks one question: can the entry be remembered as a manager's
decision under evidence, rather than as another polished football dashboard?
It combines recent primary research, a real-browser review at `1440x900` and
`320x568`, and Apple Human Interface Guidelines. No local Apple-style
`design.md` was found in the repository, the broader `/Users/jhkang/code`
workspace, or the local Codex configuration, so the official Apple guidance is
the design reference.

## Review persona

**Park Seoyun — Principal Sports Product Designer** is a fictional composite
persona created for this review, not a real person or claimed external reviewer.

- 14 years in product design, including eight years in live-sports
  visualisation and coaching tools;
- specialises in mobile direct manipulation, explainable data products,
  VoiceOver, and WCAG-oriented interaction design;
- judges whether the decision appears before the data, each action receives one
  clear state response, claims remain beside their evidence, every exploration
  is reversible, and AI is neither decoration nor an omniscient recommender.

## Research shortlist

| Research | What is novel | Product use | What the entry must not claim |
|---|---|---|---|
| [TacticAI: an AI assistant for football tactics (Nature Communications, 2024)](https://www.nature.com/articles/s41467-024-45965-x) | Models 7,176 Premier League corners as graphs; supports receiver/shot prediction, similar-corner retrieval, and position adjustments. Liverpool experts preferred the generated suggestion in 45 of 50 evaluated situations. | Borrow the evidence flow: retrieve comparable recorded corners, show one that touches the manager's promise, then show a record the promise does not explain. Use transparent rule-based retrieval, not a fake learned similarity score. | Do not say this app reproduces TacticAI, recommends an optimal tactic, or inherits its expert preference result. Its tracking data and model are not available for reuse. |
| [A Machine Learning Framework for Off Ball Defensive Role and Performance Evaluation in Football (arXiv preprint, 2026)](https://arxiv.org/pdf/2601.00748) | Uses 14,678 EPL corners and a covariate-dependent HMM to infer changing man-marking and zonal duties, then constructs role-conditioned ghosting counterfactuals. | Make the **duty contract**, not a player's supposed exact coordinate, the protagonist. The yellow token moves from the break role into a short, near, far, or second-ball duty. | Do not infer marking assignments, player reach, learned zones, or ghost trajectories from event endpoints. This is a preprint and the tracking data/model are not licensed product inputs. |
| [Action-Evaluator: A Visualization Approach for Player Action Evaluation in Soccer (IEEE TVCG, 2024)](https://doi.org/10.1109/TVCG.2023.3326524) | Places action choice, team tactic, player locations, and explanation in one pitch-centred view instead of relying on one score. Its workflow is navigation, investigation, and explanation. | Put `내 약속`, the recorded evidence, and the counterexample on one pitch stage. Differentiate by avoiding an invented alternative outcome: replay a real supporting record and a real contrary record. | A recorded contact is not proof that the manager's alternative would have prevented a shot, improved xG, or changed the result. |

Supporting evidence: a [2023 study of opponent reports in elite football](https://doi.org/10.1177/17479541231187871)
found that analysts relied much more on annotated video than quantitative data,
while coaches valued comprehensibility and relevance. The product should lead
with a short replay and one legible promise, not more headline metrics.

## Research-to-product decision

The differentiator is not a new AI model. It is a directly manipulated tactical
promise placed on trial:

> **선택 -> 기록 -> 반례 -> 재선택/초기화**

The current data can support rule-based recorded-window comparison. It cannot
support a learned recommendation, tracking-like motion, causal outcome, or
optimality score. Research supplies interaction and representation precedents;
it does not supply product data or inherited validation.

## Historical rejected implementation review

The former `Touchline Lab` shell was rendered in a real browser at desktop and
mobile sizes. It was visually coherent but was the wrong product and has since
been replaced. The verdict table below is retained as decision history, not as
the current Corner War Room state.

| Criterion | Verdict | Evidence |
|---|---|---|
| Goal fit | `REJECT` | Formation, press, width, and synthetic scores form a generic tactic configurator rather than Corner War Room. |
| First five seconds | `REJECT` | The giant wordmark is the protagonist; the scarce-role tradeoff and the user's task are absent. |
| Sixty-second demo | `REJECT` | Sliders change numbers, but there is no recorded replay, counterexample, duty switch, or reset story. |
| `320x568` first viewport | `REJECT` | The full page is approximately 1,718px tall. The pitch begins below the first viewport and the result card begins much later. |
| Direct manipulation | `REJECT` | Range inputs configure values but do not let the user place a tactical duty on trial. |
| Accessibility | `REVISE` | Native controls and numerical labels help, but explicit `:focus-visible`, forced-colors, reduced-motion, semantic pitch narration, and 44pt-equivalent slider hit areas are missing. |
| Visual hierarchy | `REJECT` | Three equal cards and the oversized serif brand compete with the decision. |

The danger is precisely that the shell looks competent: it can be mistaken for a
finished but ordinary tactics dashboard. It should be replaced, not restyled.

## Apple-style interpretation

Use [Apple's design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles),
[layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout),
[accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility),
and [materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials)
as principles, not as a visual costume.

- **Purpose before branding:** `Corner War Room` is a small eyebrow. The
  32–40px tradeoff sentence and the movable role own the first glance.
- **One content stage:** the solid pitch is the content layer. Do not scatter
  evidence into equal glass cards. If translucency is used, reserve it for one
  compact control tray and preserve contrast.
- **Agency and reversibility:** drag, tap, keyboard selection, and reset must
  produce the same state. Never autoplay the evidence.
- **Accessible redundancy:** yellow is reserved for the movable duty and selected
  state. Supporting and contrary evidence also differ by line, fill, icon, and
  text—not colour alone. Targets are at least 44pt-equivalent.
- **Motion with meaning:** use one 180–220ms snap tied to the token move. Under
  `prefers-reduced-motion`, transition immediately.
- **Progressive disclosure:** methodology, counts, receipt details, attribution,
  and analyst-role vocabulary appear only after the first move.

## Required first fold at `320x568`

1. Small `CORNER WAR ROOM` eyebrow.
2. `코너 수비에 한 명 더. 역습에는 한 명 덜.`
3. One corner pitch around 220px tall.
4. A 48px `역습 1명` token.
5. A 2-by-2 mission tray with short visible labels: `짧게`, `니어`,
   `중앙→파`, `세컨드볼`; accessible names retain the full tactical wording.
6. One line: `2018 브라질 기록 · 결과 예측 아님`.

After the move, keep the primary labels to `내 약속`, `기록`, and
`설명하지 못한 기록`. Show supporting evidence as solid/filled and the
counterexample as dashed/hollow on the same pitch. Place detailed counts and
source receipt below the stage.

## Resolution and remaining evidence boundary

The replacement build now proves the following machine-observable targets:

- all six first-fold elements fit at `320x568` without hiding a mission target;
- pointer, touch, and keyboard routes reach identical duty states;
- pointer, touch-button, keyboard, focus order, forced colours, and reduced motion
  pass the four-project pre-release suite;
- the deterministic four-act loop and claim boundaries remain identical across
  those projects.

The build passes 68/68 unit/contract tests and BG-01–11 plus BG-13–15 in Chromium,
mobile Chromium, Firefox, and WebKit, 56/56 total. BG-12 remains pending until the
exact stamped public release exists. Physical VoiceOver, fresh-user completion,
five-second comprehension, causal-misread observation, preference, and recall
are unavailable; no result is claimed. Synthetic personas informed hierarchy
only and are not human evidence.
