# Data Audit - 2026-07-17

## Verdict

`REVISE` for the product gate.

- The Figshare World Cup 2018 Events and Matches files pass the provenance,
  checksum, license-metadata, schema, and coverage discovery checks.
- They remain `pending`, not `accepted`, until a committed transformation and
  tested derived scenario own the UI output.
- A 2018-only product does not fully satisfy the official 2026 framing. It may be
  used as a clearly labeled historical evidence lens, never as a current-team
  tendency.
- FIFA's 2026 Post Match Summary Reports are excellent research inputs but are
  blocked from the deployed prize entry pending written reuse permission.
- OpenFootball is suitable for current 2026 fixture, result, and scorer context
  only. It cannot power tactical claims.

## Pappalardo/Wyscout World Cup 2018

### Provenance and rights

| Item | Value |
|---|---|
| Publisher | Luca Pappalardo and Emanuele Massucco via Figshare; events collected by Wyscout |
| Events DOI | `10.6084/m9.figshare.7770599.v1` |
| Matches DOI | `10.6084/m9.figshare.7770422.v1` |
| License shown by Figshare | CC BY 4.0 |
| Required product treatment | Credit authors/source, link license, and state transformations |
| Retrieval date | 2026-07-17 KST |

The downloaded bytes matched the publisher API checksums:

| File | Bytes | Publisher `computed_md5` | Local SHA-256 |
|---|---:|---|---|
| `events.zip` | 77,323,413 | `7c20e8647e7eda58d7838a0c7b1ec6ab` | `877e015b716ffdeea18f04418e3f24fed307ed03c37ff305cabe1f47c4822a45` |
| `matches.zip` | 645,097 | `51d80beb17480919f69a53a0152c2d71` | `c8f92bb7533e5c127e043cee764c991b5c25b4f5e70a65be931baae0b1765ce9` |
| `events_World_Cup.json` | 29,981,214 | archive entry | `d789b7cd80671a0dd1263150e997d1450e1ed22cddc8beb7bb2a6266b374a869` |
| `matches_World_Cup.json` | 395,677 | archive entry | `1ddab20c8605c063a62341eb846466c8d040885a5f0f9a3e26d023123786abb6` |

Raw files belong under ignored `data/raw/pappalardo/`. No raw event row will be
published under `public/data/`; only the minimum attributed scenario summary
needed by the product may be emitted by a committed transform.

### Schema and coverage

- `events_World_Cup.json`: 101,759 events across 64 matches.
- `matches_World_Cup.json`: 64 matches.
- Event fields inspected: event/sub-event identifiers and names, player/team,
  match, period, seconds, start/end positions, tags, and event ID.
- Corner definition: `subEventName == "Corner"`.
- All 603 corners have two position objects; 412 carry the dataset's accurate tag.
- Every one of the 32 teams has at least five corners.

Top exploration samples:

| Team | Matches | Corners | Accurate-tag corners |
|---|---:|---:|---:|
| Brazil | 5 | 42 | 33 |
| Croatia | 7 | 40 | 28 |
| England | 7 | 39 | 26 |
| Belgium | 7 | 38 | 27 |
| Korea Republic | 3 | 15 | 12 |

Brazil is the first transform candidate because it offers the largest corner
sample without requiring all tournament data in the public client.

### Bounded sequence spike

The reviewed rule looks at events occurring in the same match and period within
10 seconds after each Brazil corner. This is a temporal window, not a possession
label and not proof of causal continuation.

- 42 Brazil corners across five matches.
- 11 had a Brazil shot within the 10-second window.
- One had a goal-tagged Brazil shot within the window.
- Normalized delivery endpoints using visible project-defined regions were short
  option 14, near-post side 17, central-to-far 10, and other 1. The repository
  transform later corrected the one-off sensitivity result: near-post is the
  fixed-order leader in 54/81 variants, while short option leads or ties first in
  27/81. No region may be described as robustly dominant.
- Six shot-window sequences were manually inspected as an initial spike. The
  later adversarial review showed that `continuation` is too strong: the fixed
  window may contain defending-team clearances, transitions, restarts, or sparse
  recording.

The final transform must not reuse the exploratory bins as football truth. It
must call the unit a recorded 10-second corner window, keep Brazil attacking
evidence separate from defending-team release evidence, and follow
`docs/corner-transform-contract.md`. Because the population is only 42, all 42
windows require structural review with 42/42 correctness and an independent
semantic review with at least 38/42 agreement before product use.

### Allowed and prohibited claims

Allowed after the transform/test gate:

- "In this historical 2018 sample, 11 of Brazil's 42 corners were followed by a
  Brazil shot inside the documented 10-second window."
- "This recorded endpoint or marker touched the selected project-defined region."
- "This is historical evidence, not a 2026 team tendency or alternate outcome."

Prohibited:

- "This setup would have stopped the corner or prevented the goal."
- "Brazil will use this pattern in 2026."
- "The model learned the optimal marking plan."
- Treating event endpoints as continuous ball or player tracking.

## FIFA 2026 Post Match Summary Reports

The official hub was rechecked on 2026-07-17. The Mexico 1-0 Korea Republic
report contains 52 pages and exposes useful aggregate fields including formations,
phases of play, line height/team length, line-break type, pressure direction,
forced turnovers, and physical data. The inspected file SHA-256 is
`40e5663887806285da56121cd2e97a45e7c7094933bec0fcf925e9ac5cb684bc`.

Product semantics:

- `through / around / over` describes how a line was broken; it is not a
  left/centre/right pitch-channel coordinate.
- `inside / outside shape` is not a freehand trap-zone location.
- Pressure-arrow graphics do not expose event row IDs, time, or numeric x/y.
- Report aggregates can describe the observed match but cannot score an arbitrary
  user-drawn trap or alternate result.

Rights state:

- Research reading and external links to the official hub are acceptable.
- FIFA Terms sections 6.2 and 6.4 do not clearly authorize extraction and display
  in a public prize entry; the non-commercial condition is ambiguous here.
- No FIFA logo, flag graphic, page image, chart, or extracted metric may enter the
  deployed app until written permission covers display, transformation, public
  GitHub, and YouTube demonstration.

Therefore `2026 Press Pact` remains a `REVISE` challenger. It can replace Corner
War Room only after permission and a three-match schema audit, and only if the UI
compares a manager instruction with observed aggregates without outcome claims.

## Other 2026 sources

### OpenFootball

The upstream source remains pinned at commit
`606b6747ed8e0026aaf25ef86cb09d603da9844f`; its `cup.txt` and
`cup_finals.txt` SHA-256 values are now recorded. Generated
`2026/worldcup.json` is pinned at commit
`5e4bc62f9e711f3ea83d2b150ac3200e7e9c90a0` with SHA-256
`688738dff30aecbb1c2f4aad4fb4c1b4356126ed3cda0f420ed903ed1de86c30`.
Both repositories declare CC0 1.0 Universal.

The JSON parses to 104 canonical match tuples and 48 team labels; at the exact
retrieval snapshot, 102 records have scores and two future fixtures do not. The
source has no explicit completion/status field. It is manually updated and not
live. It is acceptable only for a separately labeled `2026 경기 맥락` layer
after a minimal checksum-verified transform and tests. It provides no tactical
event, formation, pressure, line-height, tracking, or physical data and cannot
support the manager decision. Product use is fixture-only: strip results/scorers,
keep match number nullable, label `ground` as location, and never join 2026 and
2018 team strings by name. See `docs/openfootball-2026-context-audit.md`.

### Mominullptr FIFA World Cup 2026 Dataset

Snapshot `405cc46e5e4ecd9d803227b7d90e3ab2a519dfa3` is rejected as product evidence.
Its CC0 declaration cannot clear upstream FIFA, Sofascore, and FBref rights; row
provenance is only a domain label; it has no stable release; and multiple
possession-pair rows inspected did not total 100. Its reported official-looking
metrics also differ from FIFA PMSR definitions and values.

## Next gate

After the media-statistics P0 submission is frozen:

1. implement `scripts/derive-corner-scenarios.mjs` against the pinned raw files;
2. write a full 42-window audit plus deterministic coordinate/temporal tests;
3. emit one minimal Brazil historical scenario with attribution and transformation
   metadata;
4. run `pnpm data:audit` and promote the Figshare sources only when the transform
   and domain test own the UI claim;
5. separately seek written FIFA permission using the prepared request, without
   blocking the licensed historical prototype.
