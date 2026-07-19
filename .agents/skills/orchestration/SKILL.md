---
name: orchestration
description: Coordinate rubric-first World Cup tactics product work, bounded exploration, and submission validation.
---

# World Cup Tactics Orchestration

## Start From Current State

Read the portfolio board and recheck both deadlines, official rules, current
deployable artifact, and remaining hours. Stay a bounded P1 lane until the
media-statistics P0 submission is frozen or the board explicitly changes.

## Select Work

Rank artifacts by expected official judging gain per hour: originality `30`,
manager-experience design `25`, functional completeness `25`, and planning-to-
implementation consistency `20`. Treat data credibility, accessibility, visual
clarity, browser reliability, and demo value as evidence under those four scored
criteria, not as invented organizer categories. Keep `docs/judging-map.md`
current and require every planning/demo claim to name its scored criterion and
observable proof. Run `product-gate` before
committing to a concept or major feature and `data-audit` before presenting any
output as evidence-backed. The app's first screen must expose a real manager
decision loop; reject static-dashboard work and decorative features that do not
change a choice, feedback, or demo beat.

Keep one time-boxed exploration with a hypothesis, visible success signal, and
stop condition. Submission blockers override exploration near a deadline.

## Close The Loop

When reviewers are available, assign distinct football-logic, UX, data/license,
adversarial-browser, and compliance roles. The main agent integrates and tests.
Every loop leaves code plus a test, research decision, interaction evidence,
planning artifact, deployment proof, or harness improvement. Use `retrospective`
after failures and `session-handoff` at a session boundary.

Before final submission, test the public URL without login or secret keys and freeze commits before the deadline.
