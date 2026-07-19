# World Cup Tactics Web Challenge 2026

DAKER monthly hackathon entry for an interactive manager experience built from
clearly labeled historical World Cup evidence. It does not claim to model a
2026 team, predict an outcome, or prove that a tactical choice prevented a shot.

## Deadlines

- Planning PDF: 2026-07-27 10:00 KST
- Deployed app, public GitHub repository, and YouTube demo: 2026-08-03 10:00 KST

Official page: https://daker.ai/public/hackathons/world-cup-manager-tactics-web-challenge

## Local setup

Requires Node.js 22.12+, pnpm 11, Python 3, and Poppler (`pdftoppm`) for the
full planning-PDF evidence suite.

```bash
pnpm install
python3 -m pip install -r requirements-verify.txt
pnpm dev
pnpm verify
```

On macOS, install Poppler with `brew install poppler` before `pnpm verify`.
`pnpm dev` and `pnpm build` do not require the Python/Poppler verification tools.

The app is **Corner War Room**: move one counterattacking role into a corner
defending duty, replay the recorded evidence that touches the choice, and inspect
a shot record the choice does not explain. It uses a deterministic, attributed
42-window Brazil 2018 derivative from two accepted Figshare CC BY 4.0 sources;
it does not predict a 2026 team or counterfactual result.

`pnpm data:audit` checks source admission, `pnpm copy:audit` rejects known
translationese and stale Korean UI phrases, and `pnpm eligibility:audit` binds the
official DAKER no-year-restriction rule, accepted sources, selected product, and
public derived hashes. The app fails closed when the canonical build-time data
artifact is missing or invalid; it never substitutes prototype scores.

The default `pnpm verify` contract is intentionally runnable from a clean public
clone and validates the committed, SHA-bound derivative without private or
ignored raw files. Exact raw-to-derivative reproduction is a separate explicit
evidence lane: place the pinned Figshare archives and extracted JSON at the paths
recorded in `data/source-manifest.json`, then run `pnpm data:reproduce`. Missing
raw files fail that command; they are never silently skipped by the public suite.

## Data, attribution, and limits

Corner War Room uses two records from Luca Pappalardo and Emanuele Massucco's
Soccer Match Event Dataset:

- [Events, Figshare item 7770599](https://figshare.com/articles/dataset/Events/7770599), DOI `10.6084/m9.figshare.7770599.v1`;
- [Matches, Figshare item 7770422](https://figshare.com/articles/dataset/Matches/7770422/1), DOI `10.6084/m9.figshare.7770422.v1`.

Both items display the [Creative Commons Attribution 4.0 International
license](https://creativecommons.org/licenses/by/4.0/). This project transforms
and coordinate-normalizes their 2018 World Cup subset into 42 ten-second Brazil
corner windows. The public derivative contains event endpoints and match context,
not continuous tracking, player reach, a reconstructed ball path, causal effect,
or author/Wyscout/FIFA/team endorsement. Every rendered line joins recorded
start/end points and is not presented as the actual trajectory.

## Static deployment

`pnpm build` writes a keyless, serverless site to `dist/`. The generated assets
use relative URLs, so the same bytes work at an origin root or a repository
subpath. `pnpm deployment:audit` checks asset resolution and prints the local
build digest. See `docs/static-deployment-contract.md` for the boundary between
this portable-build check and the mandatory public BG-12/final-preflight proof.

The audit reports the live Git-remote state separately; it never turns a local
build into a public-deployment claim.

## Tech stack

- React 19 and TypeScript for the manager interface and deterministic domain logic.
- Vite for the production web build.
- Vitest and Playwright for unit, interaction, accessibility, and browser gates.
- Node.js 22.12+ with pnpm 11 for reproducible local commands.

## Harness

- `.agents/skills/product-gate/`: choose the differentiating manager loop.
- `.agents/skills/data-audit/`: admit data and assets with provenance/license.
- `.agents/skills/browser-acceptance/`: verify the keyless judging path.
- `.agents/skills/korean-copy-qa/`: preserve claims while polishing Korean copy.
- `.agents/skills/submission/`: freeze the planning and final artifacts.
- `docs/product-thesis.md`: candidate and selected concept state.
- `docs/data-scope-eligibility-contract.md`: fail-closed 2026 data-scope routes.
- `docs/decision-registry.md`: accepted and rejected decisions.
- `docs/session-handoff.md`: exact resume state.
