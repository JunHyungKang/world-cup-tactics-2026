# World Cup Tactics Web Challenge 2026

DAKER monthly hackathon entry for an interactive manager experience built from
clearly labeled historical World Cup evidence. It does not claim to model a
2026 team, predict an outcome, or prove that a tactical choice prevented a shot.

## Deadlines

- Planning PDF: 2026-07-27 10:00 KST
- Deployed app, public GitHub repository, and YouTube demo: 2026-08-03 10:00 KST

Official page: https://daker.ai/public/hackathons/world-cup-manager-tactics-web-challenge

**Live judge path:** https://junhyungkang.github.io/world-cup-tactics-2026/

## Judge experience

1. Compare Portugal's 14 group-stage attacking corners with the six corners
   Uruguay faced, keeping the two small samples separate.
2. Inspect three recorded corner-situation categories, their kickers, the first
   recorded follow-up events, and ten-second shot receipts.
3. Allocate exactly ten pre-match rehearsal repetitions and lock them before the
   historical Uruguay–Portugal match is revealed.
4. Compare the saved allocation with the held-out `5 / 2 / 3` record. The app
   deliberately gives no score and makes no claim that rehearsal prevented a shot.
5. Save the next meeting decision and reason without changing the revealed record.

The planning PDF's earlier two-role, two-area hypothesis was rejected after its
team-specific information gain disappeared under two-area compression. The
implementation retains the submitted scarce-resource, precommitment, hidden
evidence, and next-meeting structure, but moves the manager's decision onto
observable team-event records. Browser and release checks are machine evidence,
not human-preference evidence.

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

The app is **Corner Prep Lab**: a historical set-piece meeting tool for one
named matchup. It keeps Portugal attack and Uruguay defensive-situation records
separate, lets the manager allocate ten rehearsal repetitions, locks the choice,
and then reveals the held-out match. Player names identify only the player
associated with a recorded source event; they do not identify a receiver,
physical first contact, duel winner, or marking assignment. Causal recommendation
is `REJECT`, and the wider empirical campaign remains `REVISE`. The next-meeting
note cannot mutate the allocation, held-out record, or source receipts.

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

Corner Prep Lab uses three records from Luca Pappalardo and Emanuele Massucco's
Soccer Match Event Dataset:

- [Events, Figshare item 7770599](https://figshare.com/articles/dataset/Events/7770599), DOI `10.6084/m9.figshare.7770599.v1`;
- [Matches, Figshare item 7770422](https://figshare.com/articles/dataset/Matches/7770422/1), DOI `10.6084/m9.figshare.7770422.v1`;
- [Players, Figshare item 7765196](https://figshare.com/articles/dataset/Players/7765196), DOI `10.6084/m9.figshare.7765196.v3`.

All three items display the [Creative Commons Attribution 4.0 International
license](https://creativecommons.org/licenses/by/4.0/). This project transforms
their 2018 World Cup subset into 603 corner restarts across all 64 matches. Of
those, 557 endpoints are classifiable and 46 remain visibly unclassified. The
public derivative preserves the fixed 48–8–8 match split, observed delivery
areas, subsequent observed events, fixed outlet-band context, source IDs, and
the narrowly admitted player ID-to-short-name joins. It contains no continuous
tracking, player reach, reconstructed ball path, causal effect, player profile
attributes, or author/Wyscout/FIFA/team/player endorsement.

## Static deployment

`pnpm build` writes a keyless, serverless site to `dist/`. The generated assets
use relative URLs, so the same bytes work at an origin root or a repository
subpath. `pnpm deployment:audit` checks asset resolution and prints the local
build digest. See `docs/static-deployment-contract.md` for the boundary between
this portable-build check and the mandatory public BG-12/final-preflight proof.

The audit reports the live Git-remote state separately; it never turns a local
build into a public-deployment claim.

The release repository includes a manually triggered GitHub Pages workflow. It
rebuilds and audits the project before uploading only `dist/`; branch pushes do
not deploy automatically. The resulting HTTPS URL becomes submission evidence
only after the remote-byte parity gate passes.

`pnpm submission:owner-console` prepares one local handoff page for the exact
planning PDF and the canonical `submissions/youtube-upload-package.json`. It
refuses a stale release, video, manifest, description, or thumbnail; exposes only
the exact frozen-public video for owner listening; and keeps YouTube publication
and the later DAKER fields behind their separate approval and public-URL gates.

## Tech stack

- Static HTML, CSS, and JavaScript for the keyless manager interaction.
- Deterministic Node transforms and release manifests for the policy campaign.
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
