# First-Place Methodology Review — Predeclared Criterion

Date: `2026-07-24 KST`

Status: `PRODUCT GATE PASS — CLAIM BOUNDARIES UNCHANGED`

## Question

Does Corner Policy Lab become a more defensible manager experiment by requiring
one location-overlap criterion before either held-out partition is revealed?

## Primary-source findings

1. Pappalardo et al.'s public soccer event dataset supports reproducible event
   types, event locations, match IDs, and event-to-match provenance. It does not
   contain continuous player tracking, player reach, logged defensive
   assignments, or counterfactual outcomes. The product can therefore evaluate
   recorded delivery-location overlap, but not defensive effect.
   Source: https://www.nature.com/articles/s41597-019-0247-7
2. TacticAI learns from player-and-ball tracking at 25 frames per second and
   combines predictive and generative models over player graphs. Its
   recommendation and expert-preference evidence depends on inputs and expert
   evaluation that this repository does not possess. TacticAI supports the
   importance of corner-set-piece interaction, not reuse of its predictive
   claims here.
   Source: https://www.nature.com/articles/s41467-024-45965-x
3. Recent 2026 graph-RL and generative-tactics preprints likewise depend on
   multi-player positions, velocities, learned rewards, or continuous
   trajectories. They define a useful future-data route, but do not license an
   RL, counterfactual, or optimization claim from event endpoints alone.
   Sources: https://arxiv.org/abs/2606.06353 and
   https://arxiv.org/abs/2604.11786
4. Off-policy evaluation estimates a target policy's return from trajectories
   collected under other policies and requires the policy/reward structure
   needed by its estimator. This repository has neither logged scouting
   behavior probabilities nor a validated tactical reward. The product must
   remain a fixed-split historical stress test, not OPE or offline RL.
   Sources: https://ojs.aaai.org/index.php/AAAI/article/view/9541 and
   https://ojs.aaai.org/index.php/AAAI/article/view/33765
5. W3C PROV-O represents and exchanges provenance among entities, activities,
   and agents. It supports the product's source and derivation path, but does
   not make a recorded association causal. The UI therefore names this surface
   `근거·출처 경로` and separately exposes forbidden inferences.
   Source: https://www.w3.org/TR/prov-o/

## Product-gate card

- Target user: a football fan acting as the set-piece coach before a knockout
  meeting.
- Manager fantasy: choose two attention areas and a minimum location-overlap
  criterion, lock both, then let two unseen tournament phases judge the same
  commitment.
- Decision and direct manipulation: two pitch tokens plus one of `40%`, `50%`,
  or `60%`; all three fields enter the immutable policy fingerprint.
- Visible consequence: the round of 16 closes at `48% — 사전 기준 미달`; the
  sealed quarter-final-and-later audit closes at `51% — 사전 기준 충족` for the
  demo's 50% policy.
- Data need: observed, licensed delivery endpoints determine both overlap
  values. No shot, goal, xG, tracking, or inferred player position determines
  the criterion verdict.
- Differentiation: unlike a formation board or similar-scene RAG result, the
  manager commits to a falsifiable threshold before exposure and cannot tune it
  between holdouts.
- Demo path: choose two areas and 50%, lock, reveal one miss, reveal one pass,
  inspect the evidence path, then save a next-meeting revision without changing
  either result.
- First-screen signal: `48 → 8 → 8`, two-token scarcity, 40/50/60 criterion,
  and the location-only limitation are visible before locking.
- Smallest implementation: one state field, three accessible buttons, criterion
  in the fingerprint, one deterministic verdict, and regression tests.
- Stop signal: reject if the copy implies defensive success, the criterion can
  change after locking, mobile direct manipulation disappears, or the demo
  exceeds 60 seconds.
- Data/license risk: unchanged; no new source or derived field.
- Football-validity risk: users may misread criterion pass as tactical success;
  every criterion surface must say `위치 겹침` and retain the causal warning.
- Deployment complexity: static and deterministic; no login, key, model, or
  server.

## Decision

`PASS`. The criterion adds manager commitment and a non-post-hoc evaluation
without introducing a recommendation model. Causal recommendation remains
`REJECT`, empirical campaign remains `REVISE`, and human evidence remains
`unavailable/no-claim`.
