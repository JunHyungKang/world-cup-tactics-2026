# Player identity and semantic-use review

Status: `PASS — MINIMAL FACTUAL IDENTITY USE ONLY`

Reviewed source: Figshare Players v3, DOI
`10.6084/m9.figshare.7765196.v3`, file ID `15073721`.

## Intended public use

The product may join a Wyscout `playerId` in an already admitted historical
World Cup event to the source's `shortName` for factual identification of the
player associated with that recorded event. The public derivative admits only:

- `player_id`, copied from `wyId`;
- `display_name`, produced by one-pass literal Unicode escape decoding, NFC
  normalization, and trimming of `shortName`;
- source event ID, team role, event and sub-event names, offset from the corner,
  deterministic selection rule, and join status.

The interface must call the player the actor associated with the first recorded
follow-up event or first recorded defending event. It must not call that player
the receiver, physical first-contact player, duel winner, marking assignment, or
recommended defender.

## Excluded source fields and assets

The public derivative must contain none of the following Players fields:
`firstName`, `middleName`, `lastName`, `birthDate`, `birthArea`,
`passportArea`, `height`, `weight`, `foot`, `role`, `currentTeamId`, or
`currentNationalTeamId`. It uses no photo, portrait, flag, crest, kit, signature,
or other likeness. It makes no evaluative or performance ranking of a player,
fitness, availability, marking, reach, performance, endorsement, or
current-team claim. Factual event-frequency summaries over this fixed
historical sample, such as the number of recorded corner or follow-up events,
are allowed; they are not player rankings.

## Rights and attribution boundary

Figshare's v3 API declares CC BY 4.0. The public surface must link the Events,
Matches, and Players items and CC BY 4.0; identify the authors; state that
corner-situation classification and Unicode-normalized display names are project
transformations; and state that the authors, provider, and named players do not
endorse or sponsor the service.

CC BY does not grant publicity, privacy, personality, trademark, or endorsement
rights. This review therefore permits only limited factual nominative use of
historical professional-player short names attached to source-linked match
events. Any broader identity use remains rejected.

## Promotion evidence

- `PASS`: Players file SHA-256
  `877a111cb1005b73df5645e9338bd74fb4b496bace2fbc545a72abb3b73efa2e`,
  MD5 `f28ddf6326281efeda6488b2169f5609`, and byte size `1737347`;
- `PASS`: 3,603 rows with non-null unique `wyId`;
- `PASS`: Portugal group-stage corner taker joins `14/14`;
- `PASS`: Portugal first recorded follow-up actor joins `14/14`;
- `PASS`: Uruguay first recorded defending actor joins `6/6`;
- `PASS`: all 12 fixed-example actor ledgers have zero missing joins;
- `PASS`: duplicate or missing joins fail closed;
- `PASS`: no literal Unicode escapes remain in public display names;
- `PASS`: forbidden Players profile fields occur zero times in the
  corner-situation derivative;
- `PASS`: existing corner counts and team-conditioned forecast values remain
  unchanged;
- `PASS`: independent rights and semantic review by
  `final_submission_auditor`.

The independent review first returned `REVISE` because a missing actor could
fall through to a generated label and the manifest used a non-contract
`rights_status`. The transform now rejects every missing actor required by the
public fixed example, the rights state uses the canonical enum, and the clean
release test reads no ignored raw input.

The exact corroboration receipt is corner event `261096233` followed by source
event `261096236`, where Players `wyId=70134` normalizes to `Rui Patrício`.
This is evidence for the actor associated with the first recorded follow-up
event only. It is not evidence of physical first contact, reception, duel
victory, marking, reach, or tactical effect.

The accepted scope is still deliberately narrow. Any new Players field, player
asset, player-evaluation claim, or broader identity use reopens this gate.
