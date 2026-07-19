# 2026 Tactical Fallback Source Gate

Verified: `2026-07-17` KST

## Decision

`STOP — no discovered source can currently power a 2026-tactical-only product.`

The bounded search found a sharp split:

- current 2026 APIs document match-event, shot, position, or aggregate endpoint
  surfaces, but their record availability and tactical sufficiency have not been
  audited and their published terms do not establish the complete reuse bundle
  required by this submission; and
- sources with explicit open-data terms expose fixtures, results, or goals rather
  than the tactical evidence required by Corner War Room.

This is a discovery verdict, not a legal opinion. The FIFA Training Centre report
is already recorded in `data/source-manifest.json` as a `pending` research source;
none of the candidates below is accepted for product use, and the other API
candidates were not added to the manifest or downloaded. Admission still
requires source-specific evidence for public prize-entry use, public GitHub,
hosted-app display, YouTube display, transformation, and the minimum derived-data
distribution needed by the client.

## Bounded candidate matrix

| Candidate | Current 2026 capability | Published-rights evidence | Verdict |
|---|---|---|---|
| FIFA Football Data Platform / Training Centre | FIFA says its restricted platform sources include event and tracking data; the publicly inspected post-match report exposes tactical aggregates, not row-level records | FIFA's platform terms reserve the information, data, feeds, and API content; FIFA's legal guidance permits article text/statistics for purely editorial, non-commercial use | `HOLD`: strongest authority, but the published terms do not establish this project's six-use bundle; the project risk gate therefore requires source-specific written permission |
| BALLDONTLIE FIFA World Cup API | Documents events, shots, average positions, player/team match stats, and momentum endpoints for 2026; record availability, schemas, and Corner War Room sufficiency were not audited | Terms prohibit redistribution or sublicensing without written permission, describe the service as an aggregator, and do not warrant origin or third-party rights | `REJECT FOR FALLBACK`: potentially useful surfaces, but tactical sufficiency, provenance, and redistribution rights remain unverified |
| WorldCupAPI.com | Documents match-event, statistics, lineup, and commentary endpoints for 2026; public event examples emphasize goals, cards, and substitutions, and tactical sufficiency was not audited | Terms permit subscribed access but do not establish public redistribution, derivative publication, public-repository, prize-entry, or YouTube rights; logos are explicitly non-commercial only | `REJECT FOR FALLBACK`: documented access is not evidence of the required publication bundle |
| WC2026 API | Post-match possession, shots, corners, fouls, cards, and a goal/card timeline | Public documentation describes authenticated access but no discoverable licence or terms grant the required downstream uses; timeline coverage is also too shallow for the role-placement decision | `REJECT FOR FALLBACK`: neither rights bundle nor tactical depth is established |
| OpenLigaDB | 2026 matches, scores, and goals under ODbL | The publisher explicitly labels API data ODbL and open to community applications; attribution, notice, share-alike, database-versus-produced-work treatment, and the six-use mapping would still need an implementation audit | `CONTEXT ONLY`: the licence signal is stronger, but the data cannot support corner duties, pressure, shape, event geometry, or matchup tradeoffs |

## Primary evidence

- FIFA Football Data Platform:
  <https://confederationscup.tickets.fifa.com/innovation/innovating-the-game/football-data-platform>
- FIFA Terms of Service, especially section 5:
  <https://inside.fifa.com/terms-of-service>
- FIFA legal, branding, and rights guidance:
  <https://inside.fifa.com/organisation/contact-fifa/legal-branding-and-rights>
- BALLDONTLIE FIFA API documentation:
  <https://fifa.balldontlie.io/>
- BALLDONTLIE Terms of Service, especially sections 6, 7, and 11:
  <https://www.balldontlie.io/terms.html>
- WorldCupAPI documentation and terms:
  <https://worldcupapi.com/documentation>
  and <https://worldcupapi.com/terms-and-conditions>
- WC2026 API OpenAPI documentation:
  <https://api.wc2026api.com/docs>
- OpenLigaDB data and licence statement:
  <https://openligadb.de/>

## What this changes

1. Route T (`2026 tactical only`) remains a valid eligibility route in the
   validator, but it has no admissible source candidate today.
2. Corner War Room remains the strongest product thesis because the cleared
   Figshare 2018 event source can support its actual tactical interaction after
   the committed transform and audit.
3. The live official DAKER Data-tab rule now explicitly permits any year,
   tournament, and player composition. Route O therefore replaces the earlier
   board-answer dependency; the prepared question remains withdrawn and unsent.
4. Source-specific FIFA permission remains a parallel optional upside, not a
   deadline dependency. A generic API subscription or free trial is not a
   substitute.

## Stop and reopen rules

Do not spend another exploration loop on aggregator APIs, scraped datasets, or
repositories that license their code but cannot establish upstream data rights.
Reopen this gate only if one of the following appears:

- a source publishes an explicit licence covering all six required uses;
- a rights holder provides written permission tied to the exact source and uses;
- DAKER provides or designates a 2026 tactical dataset with submission rights; or
- the official DAKER Data-tab rule changes or an organizer notice supersedes the
  current no-year-restriction wording.

Even without a new signal, perform one bounded recheck of the official DAKER
answer surface, FIFA Match Report Hub/team-statistics surface, and candidate terms
after the tournament final on `2026-07-19`, then once immediately before each
planning/final freeze. A recheck is discovery only; it does not admit a source.

The absence of a discovered fallback does not authorize synthetic coefficients,
fixture-to-tactics laundering, copied FIFA graphics, or claims that observed data
predicts an unobserved counterfactual.
