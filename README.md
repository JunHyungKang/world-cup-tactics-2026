# World Cup Tactics Web Challenge 2026

DAKER monthly hackathon entry for an interactive 2026 FIFA World Cup tactics experience.

## Deadlines

- Planning PDF: 2026-07-27 10:00 KST
- Deployed app, public GitHub repository, and YouTube demo: 2026-08-03 10:00 KST

Official page: https://daker.ai/public/hackathons/world-cup-manager-tactics-web-challenge

## Local setup

Requires Node.js 22.12+ and pnpm 11.

```bash
pnpm install
pnpm dev
pnpm verify
```

The initial screen is a working UX shell with transparent prototype
coefficients. It is deliberately labeled as non-evidence-backed until a real,
licensed World Cup dataset passes `pnpm data:audit` and owns the calculation.

## Harness

- `.agents/skills/product-gate/`: choose the differentiating manager loop.
- `.agents/skills/data-audit/`: admit data and assets with provenance/license.
- `.agents/skills/browser-acceptance/`: verify the keyless judging path.
- `.agents/skills/submission/`: freeze the planning and final artifacts.
- `docs/product-thesis.md`: candidate and selected concept state.
- `docs/decision-registry.md`: accepted and rejected decisions.
- `docs/session-handoff.md`: exact resume state.
