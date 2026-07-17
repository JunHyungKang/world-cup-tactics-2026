# Repository Guidelines

## Project Scope

This repository is the DAKER monthly World Cup tactics web challenge entry. The
service must let a user act as a manager through meaningful direct manipulation,
using real World Cup data. The planning PDF is due 2026-07-27 10:00 KST; the
deployed URL, public GitHub repository, and YouTube demo are due 2026-08-03
10:00 KST.

## Portfolio Coordination

At the start of each serious session, read
`/Users/jhkang/code/competitions/COMPETITION_BOARD.md`. Treat it as the source of
truth for cross-competition deadlines and priority. Update its verification date,
gate, and next action when live rules or this project's submission state changes.
Remain a bounded P1 exploration lane until the P0 media-statistics submission is
frozen or the board explicitly changes priority.

## Product Standard

Build the actual interactive experience as the first screen. Prioritize a clear
manager decision loop: inspect evidence, configure formation and roles, test a
matchup, and understand the predicted tradeoff. Drag, click, placement, and
tactical changes must genuinely work. Avoid a static dashboard disguised as a
simulation.

## Structure

- `src/`: React application and deterministic domain logic.
- `tests/`: deterministic unit, interaction, and browser tests.
- `data/`: licensed source data plus provenance metadata.
- `docs/`: product thesis, judging map, planning PDF source, and submission log.
- `public/`: licensed visual assets.

## Development

Use Node 22.12+ and pnpm 11. The Codex bundled Node 24 runtime is valid when the
machine default is older.

```bash
pnpm install
pnpm dev
pnpm verify
pnpm test:e2e
```

Keep football calculations in `src/domain/` and cover them with deterministic
tests. UI prototypes must say when their coefficients are synthetic; do not
present them as data-backed recommendations before `pnpm data:audit` reports an
accepted source and a tested transformation owns the output.

## Competition Harness

Start each loop from remaining time and the submission contract. Rank work by
expected judging gain per hour across differentiation, data credibility,
interaction quality, visual polish, and reliability. Keep one bounded exploration
lane until the differentiator is validated. Use independent subagents for football
domain review, UX critique, data audit, adversarial testing, and submission review.
Every loop must produce a test, product change, evaluation, or submission artifact.

Use the narrowest repo skill under `.agents/skills/`: `orchestration`,
`product-gate`, `data-audit`, `browser-acceptance`, `submission`,
`retrospective`, or `session-handoff`. Product and data decisions belong in
`docs/product-thesis.md`, `docs/decision-registry.md`, and
`data/source-manifest.json`; chat-only conclusions are not accepted state.

## Quality And Submission

Use repo-local package commands after the stack is selected. Add regression tests
for tactical calculations and core interactions. The deployed app must require no
login, payment, or judge-supplied API key. Respect all data and asset licenses.
Freeze the repository at final submission: commits after 2026-08-03 10:00 KST
can cause disqualification.
