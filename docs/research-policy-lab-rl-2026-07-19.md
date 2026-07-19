# Policy Lab RL and Ontology Research — 2026-07-19

Status: `RESEARCH COMPLETE; CAUSAL POLICY MODEL REJECTED; V4 EMPIRICAL CAMPAIGN REVISE`

## Decision

Reinforcement learning is a better interaction metaphor than historical search:
a manager commits a policy, receives sequential feedback, sees failure, and
revises. It is not, however, a defensible model claim for the current defensive
role move. The accepted event source observes 603 corner restarts but observes
zero instances of the four defensive duties offered by the UI. It also lacks
the 22-player positions, velocities, marking assignments, behavior propensity,
and counterfactual reward required to evaluate that action.

The bounded experiment therefore tested an ontology-constrained historical
policy rehearsal. Its first single-corner version failed the product gate. The
current v4 experiment is narrower: a manager allocates two scouting-attention
tokens from a fixed 48-match group-stage reference set, locks or abstains, revises
through eight sealed round-of-16 matches, and applies one final policy to the
untouched eight quarter-final-and-later matches. It scores location coverage only.
A later synthetic simulator may use RL internally only when every intervention
effect and reward coefficient is visibly labeled as an assumption.

## Primary research

### Graph RL for corner optimisation (2026)

Groom et al., *Maximising the Set-Piece Return: Optimising Football Corner
Tactics with Graph Reinforcement Learning*:
https://arxiv.org/abs/2606.06353

- Uses 3,223 Premier League tracking corners and a 22-player graph with position,
  velocity, physical, team, and role features.
- PPO/SAC adjust attacking positions and velocities inside a deterministic
  kinematic environment for 2.5 million steps.
- Reward is the change in a frozen GNN proxy, expected first-contact shot
  probability, rather than an observed match rollout.
- The defence is static and the reward is single-frame; coordinated motion,
  reactive defence, ball flight, and real outcome validation remain outside the
  demonstrated system.

This is simulator RL initialised from historical tracking states, not offline RL
over event logs. Reproducing its claim with event endpoints would be invalid.

### TacticAI (2024)

Wang et al., *TacticAI: an AI assistant for football tactics*:
https://www.nature.com/articles/s41467-024-45965-x

- Uses 7,176 valid Premier League corners with all 22 players' positions,
  velocities, heights, and weights at the kick.
- Separates receiver prediction, shot prediction, retrieval, and generative
  position adjustment.
- Its expert result is a blind qualitative preference over 50 suggestions, not
  evidence that the suggestions improved real match outcomes.

The representation and evaluation scale are qualitatively different from this
project's event-only source.

### Offline policy evaluation under confounding

Kausik et al., *Offline Policy Evaluation and Optimization Under Confounding*:
https://proceedings.mlr.press/v238/kausik24a.html

Khan et al., *Off-Policy Evaluation Beyond Overlap*:
https://proceedings.mlr.press/v235/khan24b.html

These works formalise why unobserved common causes and missing target-policy
support can make observational policy values unidentified or unstable. In this
project, defensive assignments are not merely rare; they are unobserved.

### Event-only football MDP precedent

Robberechts et al., event-stream Markov decision modelling and probabilistic
model checking:
https://doi.org/10.1613/jair.1.13934

This is methodologically closer to the available data than player-graph RL. It
supports typed event transitions and uncertainty-aware policy inspection, not a
claim that an unseen defensive intervention would have changed the result.

## Data spike

Owners:

- `scripts/lib/policy-lab-spike.mjs`
- `scripts/policy-lab-spike.mjs`
- `scripts/policy-lab-spike.test.mjs`
- `data/audit/policy-lab-spike.json`

The spike uses only pre-decision fields in `state`, records the observed delivery
lane separately, and keeps subsequent events/outcomes in post-decision objects.
It rejects `DEFENSIVE_DUTY_CAUSED`, `WOULD_PREVENT`, and `OPTIMAL_POLICY` graph
edges.

Results:

- source population: 603/603 corners across 64 matches and 32 teams;
- 46 delivery endpoints are Wyscout placeholder coordinates and cannot become
  actions, leaving 557 observed-action corners (`92.4%`, below the 95% gate);
- eligible 10-second delivery cells: short 101, near 184, central/far 235, other 37;
- attacking shots: 19, 57, 89, and 8 respectively; goals are only 19 across the
  eligible action rows;
- 31/32 teams have at least one action cell below three;
- 47/64 held-out matches omit at least one action;
- central/far is the top historical shot association in every leave-one-match-out
  training fold, while the lower complete ranking changes at the 8-second
  horizon;
- a 2,000-draw match-cluster bootstrap puts the central/far minus near shot-rate
  difference at `-2.1..+15.5` percentage points (95% percentile interval), so
  the agent must abstain from a top-action recommendation.
- the fixed product campaign uses 397/436 classified group-stage corners,
  84/89 classified round-of-16 corners, and 76/78 classified
  quarter-final-and-later corners; the UI exposes all three missingness rates;
- reference-set delivery-share bounds assume, adversarially, that every one of
  the 39 missing group-stage endpoints could belong to the same lane.

None of these associations is a causal policy value. Random corner splits,
team-specific optimality, goal reward, defensive OPE, and future-derived state
features are rejected.

## Product gate

The original single-corner prototype is `REJECT` as the first-place product
replacement. The v4 fixed-campaign prototype is `REVISE` pending an independent
product re-review; it remains isolated and must not replace the verified app yet.
Any reopened version must:

1. make the manager commit before evidence is revealed;
2. fails closed when historical support is insufficient;
3. shows match-level held-out evidence and uncertainty;
4. exposes one ontology explanation path plus the strongest contradiction;
5. calls synthetic rewards and intervention effects assumptions;
6. beats the current product on five-second comprehension and 60-second story
   before any planning/submission artifact is replaced.
