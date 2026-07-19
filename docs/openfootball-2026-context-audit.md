# OpenFootball 2026 Context Audit

Retrieved: `2026-07-17T10:26:33Z` (`2026-07-17T19:26:33+09:00`)

## Verdict

`REVISE — source pin and schema pass; product admission waits for a minimal
transform and tests`

OpenFootball can supply a small, rights-cleared 2026 tournament context layer.
It cannot supply a tactical claim, formation, event path, pressure metric,
counterfactual, or score for the manager's choice.

## Pinned provenance

| Artifact | Exact version | SHA-256 |
|---|---|---|
| Upstream Football.TXT group source | `openfootball/worldcup@606b6747ed8e0026aaf25ef86cb09d603da9844f` (`2026-07-15T21:03:32Z`), `2026--usa/cup.txt` | `4f52c563a5d470702fedf5078fd379c8f5ddfb2192d23b6f88ce84e997c30028` |
| Upstream Football.TXT knockout source | same commit, `2026--usa/cup_finals.txt` | `16082173028190b403f426a0f108a574a0979a5c9838dfefa9bd56c76b8ea9d7` |
| Generated JSON | `openfootball/worldcup.json@5e4bc62f9e711f3ea83d2b150ac3200e7e9c90a0` (`2026-07-15T21:03:50Z`), `2026/worldcup.json` | `688738dff30aecbb1c2f4aad4fb4c1b4356126ed3cda0f420ed903ed1de86c30` |
| License in both repositories | `LICENSE.md` | `36ffd9dc085d529a7e60e1276d73ae5a030b020313e6c5408593a6ae2af39673` |

Both repositories declare CC0 1.0 Universal. The generated repository documents
that `2026/worldcup.json` is built from the upstream `2026--usa/cup.txt` and
`cup_finals.txt` sources. Raw files were inspected in temporary directories and
were not added to `public/` or committed.

## Reproduced schema and coverage

The pinned JSON parses successfully and reports:

- name `World Cup 2026`;
- 104 matches across 48 team labels;
- 102 score-present records and two future score-absent fixtures at this exact
  retrieval snapshot; the source has no explicit completion/status field;
- 104 unique canonical tuples using
  `(round, group-or-null, date, time+offset, team1, team2)`, zero missing required
  `round/date/time/team1/team2/ground` strings, zero malformed full-time score
  arrays, and explicit UTC offsets on all 104 records;
- `matchNumber` is absent on all 72 group records and present only on the 32
  knockout records, so it is nullable and never the corpus identity;
- group matchdays, Round of 32, Round of 16, quarter-final, semi-final,
  third-place, and final rounds;
- match fields drawn from `round`, `num`, `date`, `time`, `team1`, `team2`,
  `score`, `goals1`, `goals2`, `group`, and `ground`.

This is a pin-time snapshot, not a live-score service. The upstream maintainers
describe it as manually updated, not live or automated. Counts and results may
become stale; any submitted current-context artifact must re-pin and re-run the
same checks immediately before the planning and final freezes.

## Allowed product use

The smallest allowed client artifact contains only:

```text
sourceCommit, sourceCommitAt, sourceSha256,
retrievedAt, snapshotAsOf, tournamentName,
sourceMatchKey, matchNumberOrNull, round, groupOrNull,
date, timeWithUtcOffset, team1, team2, location
```

It may label the current tournament or a selected fixture and link to provenance.
It must remain visually separate from the 2018 Corner War Room evidence.
OpenFootball team labels are text data, not permission to ship crests, flags,
kits, player photos, or organizer marks.

Do not ship score/result or scorer fields. They add no value to the one-role
corner decision and require extra full-time/extra-time/penalty and identity rules.
The source `ground` field is a city/metro location, not guaranteed to be a stadium,
and must be labeled `location`.

## Forbidden inference

This source cannot support:

- a team's corner pattern, formation, line height, pressure, player position, or
  tactical tendency;
- an explanation of why a recorded result occurred;
- a 2026 analogue for the 2018 Brazil event windows;
- any claim that a manager choice changes a fixture, score, win probability, or
  historical result.

Do not join 2026 team strings to 2018 evidence by raw name. The source already
uses `South Korea` where the historical provider uses `Korea Republic`; the two
layers have no identity join or shared calculation.

The interface must say `2026 경기 맥락` for this layer and `2018 역사적 전술
기록` for the evidence layer. It must not use a single generic `2026 데이터 기반`
badge that blurs their purposes.

## Promotion gate

After the P0 freeze, create a minimal transform that:

1. fetches or reads only the pinned generated JSON;
2. verifies the commit/file SHA and `name == "World Cup 2026"`;
3. creates `sourceMatchKey` from the canonical tuple above, rejects collisions,
   and verifies 104 identities plus 48 non-empty team labels for this pin;
4. treats `matchNumber` as nullable and never substitutes array position;
5. parses kickoff instants from explicit fixed UTC offsets, rejects ambiguous
   offsets, and never uses source-array order as chronology;
6. records RFC3339 `sourceCommitAt`, `retrievedAt`, and visible `snapshotAsOf`;
7. emits only the allowed fixture fields and strips score/goals;
8. tests group/knockout identities, nullable match numbers, fixed-offset parsing,
   location labeling, required strings, and stale-snapshot disclosure;
9. never joins raw team names across providers, feeds a tactical calculation, or
   shares a score with Corner War Room.

Only after that transform and its tests own the displayed 2026 context may the
manifest source move from `pending` to `accepted`.
