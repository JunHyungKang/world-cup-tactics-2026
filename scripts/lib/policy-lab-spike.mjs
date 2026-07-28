import {
  INPUT_HASHES,
  NOMINAL_REGIONS,
  eventMicroseconds,
  isFinitePoint,
  isPlaceholder,
  pointInRegion,
  segmentTouchesRegion,
  stableEventOrder,
} from "./corner-transform.mjs";

export const DELIVERY_ACTIONS = Object.freeze(["short", "near", "central-far", "other"]);
export const ROUTINE_ACTIONS = Object.freeze([
  "short-recorded-endpoint",
  "aerial-recorded-follow-up",
  "other-recorded-follow-up",
]);
export const MATCHUP_SIGNATURES = Object.freeze([
  "short-attacking-first",
  "aerial-attacking-first",
  "aerial-defending-first",
  "other-attacking-first",
  "other-defending-first",
]);
export const HORIZONS = Object.freeze([8, 10, 12, 15]);
export const TEAM_PRIOR_CONCENTRATIONS = Object.freeze([0.5, 1, 2, 4, 8, 16, 32, 64, 128]);
export const MATCHUP_DEFENSE_WEIGHTS = Object.freeze([0, 0.25, 0.5, 0.75, 1]);
export const POLICY_SPIKE_VERSION = "policy-lab-spike-v12-team-comparison-support";
export const PLAYERS_INPUT_SHA256 = "877a111cb1005b73df5645e9338bd74fb4b496bace2fbc545a72abb3b73efa2e";

function attackingPoint(point, eventTeamId, attackingTeamId, mirrorLaterally) {
  const teamFrame = Number(eventTeamId) === Number(attackingTeamId)
    ? { x: point.x, y: point.y }
    : { x: 100 - point.x, y: 100 - point.y };
  return mirrorLaterally ? { x: teamFrame.x, y: 100 - teamFrame.y } : teamFrame;
}

function deliveryAction(point) {
  if (pointInRegion(point, NOMINAL_REGIONS["check-short"])) return "short";
  if (pointInRegion(point, NOMINAL_REGIONS["near-post-side"])) return "near";
  if (pointInRegion(point, NOMINAL_REGIONS["central-to-far"])) return "central-far";
  return "other";
}

function recordedSuffix(periodEvents, corner, horizonSeconds) {
  const cornerIndex = periodEvents.findIndex((event) => Number(event.id) === Number(corner.id));
  if (cornerIndex < 0) throw new Error(`corner ${corner.id} is absent from its period`);
  const startUs = eventMicroseconds(corner);
  const horizonUs = horizonSeconds * 1_000_000;
  const result = [];
  for (let index = cornerIndex; index < periodEvents.length; index += 1) {
    const event = periodEvents[index];
    const offsetUs = eventMicroseconds(event) - startUs;
    if (offsetUs > horizonUs) break;
    if (offsetUs >= 0) result.push(event);
  }
  return result;
}

function opponentId(match, attackingTeamId) {
  const candidates = Object.keys(match.teamsData ?? {}).map(Number).filter((id) => id !== Number(attackingTeamId));
  return candidates.length === 1 ? candidates[0] : null;
}

function recordedDefendingOutletContact(events, attackingTeamId, defendingTeamId, mirrorLaterally) {
  return events.some((event) => {
    const isDefendingPassOrClearance = Number(event.teamId) === defendingTeamId &&
      (event.eventName === "Pass" || event.subEventName === "Clearance");
    const source = Array.isArray(event.positions) ? event.positions.filter(isFinitePoint) : [];
    if (!isDefendingPassOrClearance || source.length === 0) return false;
    const normalized = source.map((point) => attackingPoint(point, event.teamId, attackingTeamId, mirrorLaterally));
    if (normalized.some((point) => pointInRegion(point, NOMINAL_REGIONS["outlet-band"]))) return true;
    return normalized.length === 2 && !isPlaceholder(source[1]) &&
      segmentTouchesRegion(normalized[0], normalized[1], NOMINAL_REGIONS["outlet-band"]);
  });
}

function buildEpisode(corner, periodEvents, match, horizonSeconds) {
  if (!Array.isArray(corner.positions) || corner.positions.length !== 2 || !corner.positions.every(isFinitePoint)) {
    throw new Error(`corner ${corner.id} has invalid delivery positions`);
  }
  const attackingTeamId = Number(corner.teamId);
  const defendingTeamId = opponentId(match, attackingTeamId);
  if (defendingTeamId === null) throw new Error(`match ${match.wyId} has no unique opponent for ${attackingTeamId}`);
  const mirrorLaterally = corner.positions[0].y > 50;
  const endpoint = attackingPoint(corner.positions[1], attackingTeamId, attackingTeamId, mirrorLaterally);
  const actionValid = !isPlaceholder(corner.positions[1]);
  const events = recordedSuffix(periodEvents, corner, horizonSeconds);
  const followUps = events.filter((event) => Number(event.id) !== Number(corner.id));
  const attackingShots = followUps.filter((event) => Number(event.teamId) === attackingTeamId && event.eventName === "Shot");
  const first = followUps[0] ?? null;
  const firstAttacking = followUps.find((event) => Number(event.teamId) === attackingTeamId) ?? null;
  const firstDefending = followUps.find((event) => Number(event.teamId) === defendingTeamId) ?? null;

  const episode = {
    id: `corner:${Number(corner.id)}`,
    state: {
      match_id: Number(corner.matchId),
      period: String(corner.matchPeriod),
      corner_second: Number(corner.eventSec),
      attacking_team_id: attackingTeamId,
      defending_team_id: defendingTeamId,
      corner_side: mirrorLaterally ? "source-bottom" : "source-top",
    },
    observed_action: {
      type: "delivery-lane",
      value: actionValid ? deliveryAction(endpoint) : null,
      validity: actionValid ? "observed-endpoint" : "placeholder-endpoint",
    },
    observed_transition: {
      terminal: first === null,
      first_event_type: first?.eventName ?? "No recorded event",
      first_event_team_role: first === null ? "none" : Number(first.teamId) === attackingTeamId ? "attacking" : "defending",
      event_count: followUps.length,
    },
    observed_outcome: {
      attacking_shot: attackingShots.length > 0,
      goal_tagged_shot: attackingShots.some((event) => (event.tags ?? []).some((tag) => Number(tag.id) === 101)),
      defending_outlet_contact: recordedDefendingOutletContact(
        followUps,
        attackingTeamId,
        defendingTeamId,
        mirrorLaterally,
      ),
    },
    provenance: {
      corner_event_id: Number(corner.id),
      match_name: String(match.label ?? "").split(",")[0],
      observed_event_ids: events.map((event) => Number(event.id)),
      source_ids: ["pappalardo-wyscout-events-wc-2018", "pappalardo-wyscout-matches-wc-2018"],
    },
  };
  Object.defineProperty(episode, "_routine", {
    enumerable: false,
    value: {
      first_event_subtype: first?.subEventName ?? "No recorded event",
      corner_taker_player_id: Number(corner.playerId) || null,
      first_event_player_id: Number(first?.playerId) || null,
      first_event_source_event_id: Number(first?.id) || null,
      first_event_offset_us: first === null ? null : eventMicroseconds(first) - eventMicroseconds(corner),
      first_attacking_event_player_id: Number(firstAttacking?.playerId) || null,
      first_attacking_event_source_event_id: Number(firstAttacking?.id) || null,
      first_attacking_event_offset_us: firstAttacking === null ? null :
        eventMicroseconds(firstAttacking) - eventMicroseconds(corner),
      first_attacking_event_type: firstAttacking?.eventName ?? "No recorded event",
      first_attacking_event_subtype: firstAttacking?.subEventName ?? "No recorded event",
      first_defending_event_player_id: Number(firstDefending?.playerId) || null,
      first_defending_event_source_event_id: Number(firstDefending?.id) || null,
      first_defending_event_offset_us: firstDefending === null ? null :
        eventMicroseconds(firstDefending) - eventMicroseconds(corner),
      first_defending_event_type: firstDefending?.eventName ?? "No recorded event",
      first_defending_event_subtype: firstDefending?.subEventName ?? "No recorded event",
    },
  });
  return episode;
}

export function derivePolicyEpisodes(events, matches, horizonSeconds = 10) {
  const matchById = new Map(matches.map((match) => [Number(match.wyId), match]));
  const byPeriod = new Map();
  for (const event of events) {
    const key = `${event.matchId}:${event.matchPeriod}`;
    if (!byPeriod.has(key)) byPeriod.set(key, []);
    byPeriod.get(key).push(event);
  }
  for (const periodEvents of byPeriod.values()) periodEvents.sort(stableEventOrder);
  const corners = events.filter((event) => event.subEventName === "Corner").sort((a, b) =>
    Number(a.matchId) - Number(b.matchId) || String(a.matchPeriod).localeCompare(String(b.matchPeriod)) || stableEventOrder(a, b));
  return corners.map((corner) => {
    const match = matchById.get(Number(corner.matchId));
    if (!match) throw new Error(`missing match ${corner.matchId}`);
    return buildEpisode(corner, byPeriod.get(`${corner.matchId}:${corner.matchPeriod}`), match, horizonSeconds);
  });
}

function outletContext(episodes) {
  const contacts = episodes.filter((episode) => episode.observed_outcome.defending_outlet_contact).length;
  return {
    label: "recorded-defending-pass-or-clearance-touching-attacking-outlet-band",
    contacts,
    corners: episodes.length,
    rate: episodes.length === 0 ? null : contacts / episodes.length,
    interpretation: "Fixed historical context only; not a caused or completed counterattack.",
  };
}

function actionSummary(episodes) {
  return Object.fromEntries(DELIVERY_ACTIONS.map((action) => {
    const selected = episodes.filter((episode) => episode.observed_action.value === action);
    const shots = selected.filter((episode) => episode.observed_outcome.attacking_shot).length;
    const goals = selected.filter((episode) => episode.observed_outcome.goal_tagged_shot).length;
    return [action, {
      corners: selected.length,
      shots,
      goals,
      shot_rate: selected.length === 0 ? null : shots / selected.length,
    }];
  }));
}

function actionCounts(episodes) {
  return Object.fromEntries(DELIVERY_ACTIONS.map((action) => [
    action,
    episodes.filter((episode) => episode.observed_action.value === action).length,
  ]));
}

function subtractCounts(left, right) {
  return Object.fromEntries(DELIVERY_ACTIONS.map((action) => [action, left[action] - right[action]]));
}

function totalCounts(counts) {
  return DELIVERY_ACTIONS.reduce((sum, action) => sum + counts[action], 0);
}

function normalizeCounts(counts) {
  const total = totalCounts(counts);
  if (total === 0) throw new Error("cannot normalize empty action counts");
  return Object.fromEntries(DELIVERY_ACTIONS.map((action) => [action, counts[action] / total]));
}

function teamNames(matches) {
  const names = new Map();
  for (const match of matches) {
    const [homeName = "", awayName = ""] = String(match.label ?? "").split(",")[0].split(" - ");
    for (const [teamId, team] of Object.entries(match.teamsData ?? {})) {
      const name = team.side === "home" ? homeName : team.side === "away" ? awayName : "";
      if (name) names.set(Number(teamId), name);
    }
  }
  return names;
}

function normalizedPlayerName(value) {
  return String(value ?? "")
    .replace(/\\u([0-9a-f]{4})/giu, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .normalize("NFC")
    .trim();
}

function playerDirectory(players) {
  const directory = new Map();
  for (const player of players) {
    const playerId = Number(player.wyId);
    if (!Number.isInteger(playerId) || directory.has(playerId)) {
      throw new Error(`players source has an invalid or duplicate wyId: ${player.wyId}`);
    }
    const shortName = normalizedPlayerName(player.shortName);
    if (!shortName || /\\u[0-9a-f]{4}/iu.test(shortName)) {
      throw new Error(`player ${playerId} has an invalid display name after one-pass normalization`);
    }
    directory.set(playerId, {
      player_id: playerId,
      display_name: shortName,
    });
  }
  return directory;
}

function joinedPlayer(directory, playerId, context) {
  if (!playerId) return null;
  const player = directory.get(playerId);
  if (!player) throw new Error(`players source is missing ${context}: ${playerId}`);
  return player;
}

function actorJoinCoverage(episodes, playerKey, directory) {
  const actorIds = episodes.map((episode) => episode._routine?.[playerKey]).filter(Boolean);
  const joined = actorIds.filter((playerId) => directory.has(playerId));
  if (joined.length !== actorIds.length) {
    const missing = actorIds.filter((playerId) => !directory.has(playerId));
    throw new Error(`players source is missing ${playerKey}: ${[...new Set(missing)].join(",")}`);
  }
  return { source_events_with_actor: actorIds.length, joined: joined.length, missing: 0 };
}

function routineAction(episode) {
  if (episode.observed_action.validity !== "observed-endpoint") return null;
  if (episode.observed_action.value === "short") return "short-recorded-endpoint";
  if (["Air duel", "Head pass"].includes(episode._routine?.first_event_subtype)) {
    return "aerial-recorded-follow-up";
  }
  return "other-recorded-follow-up";
}

function matchupSignature(episode) {
  const routine = routineAction(episode);
  const role = episode.observed_transition.first_event_team_role;
  if (routine === "short-recorded-endpoint" && role === "attacking") {
    return "short-attacking-first";
  }
  if (routine === "aerial-recorded-follow-up" && role === "attacking") {
    return "aerial-attacking-first";
  }
  if (routine === "aerial-recorded-follow-up" && role === "defending") {
    return "aerial-defending-first";
  }
  if (routine === "other-recorded-follow-up" && role === "attacking") {
    return "other-attacking-first";
  }
  if (routine === "other-recorded-follow-up" && role === "defending") {
    return "other-defending-first";
  }
  return null;
}

function routineForSignature(signature) {
  if (signature.startsWith("short-")) return "short-recorded-endpoint";
  if (signature.startsWith("aerial-")) return "aerial-recorded-follow-up";
  return "other-recorded-follow-up";
}

function countPlayers(episodes, playerKey, directory) {
  const counts = new Map();
  for (const episode of episodes) {
    const playerId = episode._routine?.[playerKey];
    if (!playerId) continue;
    counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([playerId, count]) => ({
      ...joinedPlayer(directory, playerId, playerKey),
      count,
    }))
    .sort((left, right) => right.count - left.count || left.player_id - right.player_id);
}

function routineCounts(episodes) {
  return Object.fromEntries(ROUTINE_ACTIONS.map((routine) => [
    routine,
    episodes.filter((episode) => routineAction(episode) === routine).length,
  ]));
}

function routineCards(episodes, directory, perspective) {
  return ROUTINE_ACTIONS.map((routine) => {
    const selected = episodes.filter((episode) => routineAction(episode) === routine);
    return {
      situation: routine,
      corners: selected.length,
      attacking_shots_within_10_seconds: selected.filter((episode) =>
        episode.observed_outcome.attacking_shot).length,
      first_event_team_role_counts: {
        attacking: selected.filter((episode) =>
          episode.observed_transition.first_event_team_role === "attacking").length,
        defending: selected.filter((episode) =>
          episode.observed_transition.first_event_team_role === "defending").length,
        none: selected.filter((episode) =>
          episode.observed_transition.first_event_team_role === "none").length,
      },
      leading_players: perspective === "attack"
        ? {
            corner_takers: countPlayers(selected, "corner_taker_player_id", directory).slice(0, 4),
            first_attacking_events: countPlayers(selected, "first_attacking_event_player_id", directory).slice(0, 4),
          }
        : {
            first_defending_events: countPlayers(selected, "first_defending_event_player_id", directory).slice(0, 4),
          },
      event_receipts: selected.map((episode) => ({
        corner_event_id: episode.provenance.corner_event_id,
        match_id: episode.state.match_id,
        match_name: episode.provenance.match_name,
        period: episode.state.period,
        corner_second: episode.state.corner_second,
        corner_taker: joinedPlayer(
          directory,
          episode._routine?.corner_taker_player_id,
          "corner_taker_player_id",
        ),
        first_event_team_role: episode.observed_transition.first_event_team_role,
        first_event_type: episode.observed_transition.first_event_type,
        first_event_subtype: episode._routine?.first_event_subtype,
        first_recorded_follow_up: {
          source_event_id: episode._routine?.first_event_source_event_id,
          offset_us: episode._routine?.first_event_offset_us,
          actor: joinedPlayer(
            directory,
            episode._routine?.first_event_player_id,
            "first_event_player_id",
          ),
          team_role: episode.observed_transition.first_event_team_role,
          event_name: episode.observed_transition.first_event_type,
          sub_event_name: episode._routine?.first_event_subtype,
          selection_rule: "earliest event after the corner within the fixed inclusive 10-second window",
          join_status: episode._routine?.first_event_player_id ? "joined" : "no-recorded-actor",
        },
        first_recorded_defending_event: {
          source_event_id: episode._routine?.first_defending_event_source_event_id,
          offset_us: episode._routine?.first_defending_event_offset_us,
          actor: joinedPlayer(
            directory,
            episode._routine?.first_defending_event_player_id,
            "first_defending_event_player_id",
          ),
          team_role: "defending",
          event_name: episode._routine?.first_defending_event_type,
          sub_event_name: episode._routine?.first_defending_event_subtype,
          selection_rule: "earliest defending-team event after the corner within the fixed inclusive 10-second window",
          join_status: episode._routine?.first_defending_event_player_id ? "joined" : "no-recorded-actor",
        },
        attacking_shot_within_10_seconds: episode.observed_outcome.attacking_shot,
      })),
    };
  });
}

function matchupSignatureCards(episodes, directory, perspective) {
  return MATCHUP_SIGNATURES.map((signature) => {
    const selected = episodes.filter((episode) => matchupSignature(episode) === signature);
    return {
      signature,
      recorded_situation: routineForSignature(signature),
      first_recorded_team_role: signature.includes("-attacking-") ? "attacking" : "defending",
      corners: selected.length,
      attacking_shots_within_10_seconds: selected.filter((episode) =>
        episode.observed_outcome.attacking_shot).length,
      leading_players: perspective === "attack"
        ? {
            corner_takers: countPlayers(selected, "corner_taker_player_id", directory).slice(0, 4),
            first_attacking_events: countPlayers(selected, "first_attacking_event_player_id", directory).slice(0, 4),
          }
        : {
            first_defending_events: countPlayers(selected, "first_defending_event_player_id", directory).slice(0, 4),
          },
      event_receipts: routineCards(selected, directory, perspective)
        .flatMap((card) => card.event_receipts),
    };
  });
}

function cardBySignature(cards, signature) {
  const card = cards.find((candidate) => candidate.signature === signature);
  if (!card) throw new Error(`ledger is missing matchup signature card: ${signature}`);
  return card;
}

function receiptEventFingerprint(receipt) {
  const event = receipt.first_recorded_follow_up;
  return `${event?.event_name ?? "none"}::${event?.sub_event_name ?? "none"}`;
}

function comparisonSupport(opponent, manager, managerCards) {
  const opponentFingerprints = new Set(opponent.event_receipts.map(receiptEventFingerprint));
  const directReceipts = manager.event_receipts.filter((receipt) =>
    opponentFingerprints.has(receiptEventFingerprint(receipt)));
  const sameSignatureAdjacent = manager.event_receipts.filter((receipt) =>
    !opponentFingerprints.has(receiptEventFingerprint(receipt)));
  const neighboringReceipts = managerCards
    .filter((candidate) =>
      candidate.signature !== manager.signature &&
      candidate.recorded_situation === manager.recorded_situation)
    .flatMap((candidate) => candidate.event_receipts);
  return {
    rule: "direct matches recorded_situation + first_recorded_team_role + first recorded follow-up event/sub-event; adjacent shares recorded_situation but differs on at least one remaining axis",
    direct: directReceipts.length,
    adjacent: sameSignatureAdjacent.length + neighboringReceipts.length,
    direct_corner_event_ids: directReceipts.map((receipt) => receipt.corner_event_id),
    adjacent_corner_event_ids: [...sameSignatureAdjacent, ...neighboringReceipts]
      .map((receipt) => receipt.corner_event_id),
  };
}

function repeatedPlayerConnections(opponentCards) {
  const connections = new Map();
  for (const card of opponentCards) {
    for (const receipt of card.event_receipts) {
      const taker = receipt.corner_taker;
      const followUp = receipt.first_recorded_follow_up;
      if (!taker || !followUp?.actor || followUp.team_role !== "attacking") continue;
      const key = [
        taker.player_id,
        followUp.actor.player_id,
        card.recorded_situation,
      ].join("::");
      const connection = connections.get(key) ?? {
        recorded_situation: card.recorded_situation,
        corner_taker: taker,
        first_recorded_follow_up_actor: followUp.actor,
        corners: 0,
        match_ids: new Set(),
        corner_event_ids: [],
      };
      connection.corners += 1;
      connection.match_ids.add(receipt.match_id);
      connection.corner_event_ids.push(receipt.corner_event_id);
      connections.set(key, connection);
    }
  }
  return [...connections.values()]
    .map((connection) => ({
      recorded_situation: connection.recorded_situation,
      corner_taker: connection.corner_taker,
      first_recorded_follow_up_actor: connection.first_recorded_follow_up_actor,
      corners: connection.corners,
      matches: connection.match_ids.size,
      match_ids: [...connection.match_ids].sort((a, b) => a - b),
      corner_event_ids: connection.corner_event_ids,
    }))
    .filter((connection) => connection.corners >= 2 && connection.matches >= 2)
    .sort((a, b) =>
      b.corners - a.corners ||
      b.matches - a.matches ||
      a.corner_taker.player_id - b.corner_taker.player_id);
}

function buildMatchupQuestionBoard(
  opponentEpisodes,
  managerEpisodes,
  managerAllEpisodes,
  heldOutEpisodes,
  directory,
) {
  const opponentCards = matchupSignatureCards(opponentEpisodes, directory, "attack");
  const managerCards = matchupSignatureCards(managerEpisodes, directory, "defense");
  const heldOutCards = matchupSignatureCards(heldOutEpisodes, directory, "attack");
  const unclassifiedManagerEpisodes = managerAllEpisodes.filter((episode) =>
    episode.observed_action.validity !== "observed-endpoint");
  return {
    schema_version: 1,
    status: "PASS",
    decision: "Select exactly two team-linked sequence questions before the held-out match is visible.",
    selection_contract: {
      priority_count: 2,
      no_default_priorities: true,
      held_out_match_hidden_until_lock: true,
    },
    counterevidence_rule: [
      "first unselected situation with a held-out attacking shot within 10 seconds",
      "otherwise first unselected situation observed in the held-out match",
      "otherwise first selected situation with a held-out attacking shot within 10 seconds",
    ],
    ontology: {
      node_types: [
        "Team",
        "Match",
        "CornerRestart",
        "CornerTaker",
        "RecordedSituation",
        "RecordedFollowUp",
        "RecordedShot",
        "TrainingQuestion",
        "SourceReceipt",
      ],
      edge_types: [
        "ATTACK_RECORD_FOR",
        "DEFENSIVE_EXPOSURE_FOR",
        "KICK_TAKEN_BY",
        "OBSERVED_NEXT",
        "SHOT_RECORDED_WITHIN",
        "SUPPORTS_QUESTION",
        "DERIVED_FROM",
      ],
      forbidden_edges: [
        "MARKED_BY",
        "WOULD_PREVENT",
        "CAUSED_SUCCESS",
        "OPTIMAL_TACTIC",
      ],
    },
    repeated_player_connections: repeatedPlayerConnections(opponentCards),
    questions: MATCHUP_SIGNATURES.map((signature) => {
      const opponent = cardBySignature(opponentCards, signature);
      const manager = cardBySignature(managerCards, signature);
      const heldOut = cardBySignature(heldOutCards, signature);
      return {
        id: signature,
        recorded_situation: opponent.recorded_situation,
        first_recorded_team_role: opponent.first_recorded_team_role,
        opponent_attack: {
          corners: opponent.corners,
          attacking_shots_within_10_seconds: opponent.attacking_shots_within_10_seconds,
          leading_corner_takers: opponent.leading_players.corner_takers,
          leading_first_attacking_events: opponent.leading_players.first_attacking_events,
          event_receipts: opponent.event_receipts,
        },
        manager_defensive_exposure: {
          corners: manager.corners,
          opponent_shots_within_10_seconds: manager.attacking_shots_within_10_seconds,
          leading_first_defending_events: manager.leading_players.first_defending_events,
          event_receipts: manager.event_receipts,
        },
        comparison_support: comparisonSupport(opponent, manager, managerCards),
        exposure_assessment: {
          status: manager.corners > 0
            ? "SEEN_IN_RECORDED_SAMPLE"
            : "UNSEEN_IN_RECORDED_SAMPLE",
          thin: opponent.corners < 2 || manager.corners < 2,
          compatible_unclassified_manager_corners:
            signature === "other-defending-first" ? unclassifiedManagerEpisodes.length : 0,
          interpretation: manager.corners > 0
            ? "The same two-axis situation and first-team signature appears in Uruguay's classifiable group-stage defensive-exposure sample; comparison_support decides whether the event subtype also matches."
            : "No classifiable Uruguay group-stage defensive-exposure record has this two-axis signature; adjacent records may still exist and this is not a weakness finding.",
        },
        held_out_evidence: {
          corners: heldOut.corners,
          attacking_shots_within_10_seconds: heldOut.attacking_shots_within_10_seconds,
          event_receipts: heldOut.event_receipts,
        },
      };
    }),
    claim_boundary: {
      supported: "A source-linked comparison of Portugal attack records and Uruguay defensive-exposure records that informs two manager-selected rehearsal questions.",
      unsupported: [
        "team strength or weakness",
        "routine intent",
        "marking assignment",
        "rehearsal effectiveness",
        "optimal priority selection",
      ],
    },
    unclassified_manager_defensive_exposure: unclassifiedManagerEpisodes.map((episode) => ({
      corner_event_id: episode.provenance.corner_event_id,
      match_id: episode.state.match_id,
      match_name: episode.provenance.match_name,
      endpoint_validity: episode.observed_action.validity,
      first_recorded_team_role: episode.observed_transition.first_event_team_role,
      first_recorded_event_type: episode.observed_transition.first_event_type,
      first_recorded_event_subtype: episode._routine?.first_event_subtype,
      first_recorded_defending_actor: joinedPlayer(
        directory,
        episode._routine?.first_defending_event_player_id,
        "first_defending_event_player_id",
      ),
      compatible_question_ids: episode.observed_transition.first_event_team_role === "defending" &&
        !["Air duel", "Head pass"].includes(episode._routine?.first_event_subtype)
        ? ["other-defending-first"]
        : [],
    })),
  };
}

function buildCornerSituationRehearsal(episodes, players, example) {
  const directory = playerDirectory(players);
  const referenceIds = new Set(episodes.map((episode) => episode.state.match_id)
    .sort((left, right) => left - right).filter((matchId, index, values) =>
      index === 0 || matchId !== values[index - 1]).slice(0, 48));
  const opponentReferenceAll = episodes.filter((episode) =>
    referenceIds.has(episode.state.match_id) &&
    episode.state.attacking_team_id === example.opponent_team_id);
  const opponentReference = opponentReferenceAll.filter((episode) =>
    episode.observed_action.validity === "observed-endpoint");
  const managerExposureAll = episodes.filter((episode) =>
    referenceIds.has(episode.state.match_id) &&
    episode.state.defending_team_id === example.manager_team_id);
  const managerExposure = managerExposureAll.filter((episode) =>
    episode.observed_action.validity === "observed-endpoint");
  const heldOutAll = episodes.filter((episode) =>
    episode.state.match_id === example.match_id &&
    episode.state.attacking_team_id === example.opponent_team_id);
  const heldOut = heldOutAll.filter((episode) =>
    episode.observed_action.validity === "observed-endpoint");
  const joinCoverage = {};
  for (const [ledger, selected] of [
    ["opponent_reference", opponentReferenceAll],
    ["manager_defensive_reference", managerExposureAll],
    ["held_out_match", heldOutAll],
  ]) {
    for (const playerKey of [
      "corner_taker_player_id",
      "first_event_player_id",
      "first_attacking_event_player_id",
      "first_defending_event_player_id",
    ]) {
      joinCoverage[`${ledger}_${playerKey}`] = actorJoinCoverage(selected, playerKey, directory);
    }
  }
  const opponentAttackReference = {
    team_id: example.opponent_team_id,
    team_name: example.opponent_team_name,
    source_corners: opponentReferenceAll.length,
    classifiable_corners: opponentReference.length,
    situation_counts: routineCounts(opponentReference),
    situation_cards: routineCards(opponentReference, directory, "attack"),
    leading_corner_takers: countPlayers(opponentReference, "corner_taker_player_id", directory).slice(0, 6),
    leading_first_attacking_events: countPlayers(opponentReference, "first_attacking_event_player_id", directory).slice(0, 6),
  };
  const managerDefensiveReference = {
    team_id: example.manager_team_id,
    team_name: example.manager_team_name,
    source_corners: managerExposureAll.length,
    classifiable_corners: managerExposure.length,
    situation_counts: routineCounts(managerExposure),
    situation_cards: routineCards(managerExposure, directory, "defense"),
    leading_first_defending_events: countPlayers(managerExposure, "first_defending_event_player_id", directory).slice(0, 6),
    leading_first_defending_events_all_source_corners: countPlayers(
      managerExposureAll,
      "first_defending_event_player_id",
      directory,
    ).slice(0, 6),
    opponent_shots_within_10_seconds: managerExposureAll.filter((episode) =>
      episode.observed_outcome.attacking_shot).length,
  };
  const heldOutMatch = {
    match_id: example.match_id,
    match_name: example.match_name,
    source_corners: heldOutAll.length,
    classifiable_corners: heldOut.length,
    situation_counts: routineCounts(heldOut),
    situation_cards: routineCards(heldOut, directory, "attack"),
    attacking_shots_within_10_seconds: heldOutAll.filter((episode) =>
      episode.observed_outcome.attacking_shot).length,
  };
  return {
    schema_version: 1,
    status: players.length > 0 ? "PASS" : "REVISE",
    decision: "Select two team-linked sequence questions before the held-out match is visible.",
    situation_rule: {
      "short-recorded-endpoint": "Classifiable corner endpoint in the project-defined short lane.",
      "aerial-recorded-follow-up": "Non-short delivery whose first recorded follow-up is an air duel or head pass.",
      "other-recorded-follow-up": "Other classifiable non-short delivery; the first recorded follow-up can be a clearance, ground duel, touch, pass, or another event.",
    },
    claim_boundary: {
      supported: "Separate opponent attack and manager-team defensive-exposure ledgers with player-linked recorded event chains.",
      unsupported: [
        "marking assignment",
        "player position or reach at the kick",
        "rehearsal effectiveness",
        "defensive success caused by a plan",
        "optimal matchup tactic",
      ],
    },
    player_join_coverage: joinCoverage,
    opponent_attack_reference: opponentAttackReference,
    manager_defensive_reference: managerDefensiveReference,
    held_out_match: heldOutMatch,
    matchup_question_board: buildMatchupQuestionBoard(
      opponentReference,
      managerExposure,
      managerExposureAll,
      heldOut,
      directory,
    ),
  };
}

// Lanczos approximation. Inputs here are positive Dirichlet parameters only.
function logGamma(value) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const shifted = value - 1;
  let series = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index += 1) {
    series += coefficients[index] / (shifted + index + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

function dirichletMultinomialLogEvidence(counts, priorProbabilities, concentration) {
  const countTotal = totalCounts(counts);
  let result = logGamma(concentration) - logGamma(concentration + countTotal);
  for (const action of DELIVERY_ACTIONS) {
    const prior = concentration * priorProbabilities[action];
    result += logGamma(prior + counts[action]) - logGamma(prior);
  }
  return result;
}

function posteriorProbabilities(teamCounts, globalProbabilities, concentration) {
  const teamTotal = totalCounts(teamCounts);
  return Object.fromEntries(DELIVERY_ACTIONS.map((action) => [
    action,
    (teamCounts[action] + concentration * globalProbabilities[action]) / (teamTotal + concentration),
  ]));
}

function probabilityRanking(probabilities) {
  return DELIVERY_ACTIONS.toSorted((left, right) =>
    probabilities[right] - probabilities[left] || left.localeCompare(right));
}

function scoreForecast(episodes, probabilitiesForTeam) {
  if (episodes.length === 0) {
    return {
      corners: 0,
      negative_log_likelihood: 0,
      mean_log_loss: null,
      mean_brier_score: null,
    };
  }
  let negativeLogLikelihood = 0;
  let brierTotal = 0;
  for (const episode of episodes) {
    const probabilities = probabilitiesForTeam(episode.state.attacking_team_id);
    const observed = episode.observed_action.value;
    negativeLogLikelihood -= Math.log(probabilities[observed]);
    brierTotal += DELIVERY_ACTIONS.reduce((sum, action) => {
      const residual = probabilities[action] - Number(action === observed);
      return sum + residual * residual;
    }, 0);
  }
  return {
    corners: episodes.length,
    negative_log_likelihood: negativeLogLikelihood,
    mean_log_loss: negativeLogLikelihood / episodes.length,
    mean_brier_score: brierTotal / episodes.length,
  };
}

function scoreForecastByEpisode(episodes, probabilitiesForEpisode) {
  if (episodes.length === 0) {
    return {
      corners: 0,
      negative_log_likelihood: 0,
      mean_log_loss: null,
      mean_brier_score: null,
    };
  }
  let negativeLogLikelihood = 0;
  let brierTotal = 0;
  for (const episode of episodes) {
    const probabilities = probabilitiesForEpisode(episode);
    const observed = episode.observed_action.value;
    negativeLogLikelihood -= Math.log(probabilities[observed]);
    brierTotal += DELIVERY_ACTIONS.reduce((sum, action) => {
      const residual = probabilities[action] - Number(action === observed);
      return sum + residual * residual;
    }, 0);
  }
  return {
    corners: episodes.length,
    negative_log_likelihood: negativeLogLikelihood,
    mean_log_loss: negativeLogLikelihood / episodes.length,
    mean_brier_score: brierTotal / episodes.length,
  };
}

function improvement(baseline, candidate) {
  if (baseline.mean_log_loss === null || candidate.mean_log_loss === null ||
      baseline.mean_brier_score === null || candidate.mean_brier_score === null) {
    return {
      log_loss_reduction: null,
      log_loss_reduction_rate: null,
      brier_reduction: null,
      brier_reduction_rate: null,
    };
  }
  return {
    log_loss_reduction: baseline.mean_log_loss - candidate.mean_log_loss,
    log_loss_reduction_rate: (baseline.mean_log_loss - candidate.mean_log_loss) / baseline.mean_log_loss,
    brier_reduction: baseline.mean_brier_score - candidate.mean_brier_score,
    brier_reduction_rate: (baseline.mean_brier_score - candidate.mean_brier_score) / baseline.mean_brier_score,
  };
}

function matchupProbabilities(
  attackingCounts,
  defendingExposureCounts,
  tournamentProbabilities,
  concentration,
  defendingWeight,
) {
  const attacking = posteriorProbabilities(
    attackingCounts,
    tournamentProbabilities,
    concentration,
  );
  const defending = posteriorProbabilities(
    defendingExposureCounts,
    tournamentProbabilities,
    concentration,
  );
  const unnormalized = Object.fromEntries(DELIVERY_ACTIONS.map((action) => [
    action,
    attacking[action] *
      Math.pow(defending[action] / tournamentProbabilities[action], defendingWeight),
  ]));
  return normalizeCounts(unnormalized);
}

function forecastComparisonBootstrap(episodes, baselineForecast, candidateForecast, draws = 10_000) {
  const matchIds = [...new Set(episodes.map((episode) => episode.state.match_id))].sort((a, b) => a - b);
  const gainsByMatch = new Map(matchIds.map((matchId) => {
    const trials = episodes.filter((episode) => episode.state.match_id === matchId);
    return [matchId, {
      corners: trials.length,
      gain: trials.reduce((sum, episode) => {
        const action = episode.observed_action.value;
        return sum + Math.log(candidateForecast(episode)[action]) -
          Math.log(baselineForecast(episode)[action]);
      }, 0),
    }];
  }));
  const random = seededRandom(0x4d415443);
  const means = [];
  for (let draw = 0; draw < draws; draw += 1) {
    let gain = 0;
    let corners = 0;
    for (let index = 0; index < matchIds.length; index += 1) {
      const sampled = gainsByMatch.get(matchIds[Math.floor(random() * matchIds.length)]);
      gain += sampled.gain;
      corners += sampled.corners;
    }
    means.push(gain / corners);
  }
  means.sort((left, right) => left - right);
  return {
    unit: "knockout-match-cluster",
    draws,
    seed: "0x4d415443",
    mean_log_score_gain_per_corner_interval: {
      lower_95: quantile(means, 0.025),
      median: quantile(means, 0.5),
      upper_95: quantile(means, 0.975),
    },
    probability_gain_above_zero: means.filter((value) => value > 0).length / means.length,
  };
}

function buildMatchupChallenger(
  reference,
  referenceIds,
  rehearsal,
  finalAudit,
  opponentOnlyForecast,
  concentration,
) {
  const globalCounts = actionCounts(reference);
  const attackingTeamIds = [...new Set(reference.map((episode) => episode.state.attacking_team_id))];
  const defendingTeamIds = [...new Set(reference.map((episode) => episode.state.defending_team_id))];
  const emptyCounts = actionCounts([]);
  const attackingCounts = new Map(attackingTeamIds.map((teamId) => [
    teamId,
    actionCounts(reference.filter((episode) => episode.state.attacking_team_id === teamId)),
  ]));
  const defendingCounts = new Map(defendingTeamIds.map((teamId) => [
    teamId,
    actionCounts(reference.filter((episode) => episode.state.defending_team_id === teamId)),
  ]));
  const folds = referenceIds.map((matchId) => {
    const heldOut = reference.filter((episode) => episode.state.match_id === matchId);
    const heldOutCounts = actionCounts(heldOut);
    const heldOutAttacking = new Map([...new Set(heldOut.map((episode) => episode.state.attacking_team_id))].map((teamId) => [
      teamId,
      actionCounts(heldOut.filter((episode) => episode.state.attacking_team_id === teamId)),
    ]));
    const heldOutDefending = new Map([...new Set(heldOut.map((episode) => episode.state.defending_team_id))].map((teamId) => [
      teamId,
      actionCounts(heldOut.filter((episode) => episode.state.defending_team_id === teamId)),
    ]));
    return {
      heldOut,
      tournamentProbabilities: normalizeCounts(subtractCounts(globalCounts, heldOutCounts)),
      attackingCountsFor: (teamId) => subtractCounts(
        attackingCounts.get(teamId) ?? emptyCounts,
        heldOutAttacking.get(teamId) ?? emptyCounts,
      ),
      defendingCountsFor: (teamId) => subtractCounts(
        defendingCounts.get(teamId) ?? emptyCounts,
        heldOutDefending.get(teamId) ?? emptyCounts,
      ),
    };
  });
  const candidates = MATCHUP_DEFENSE_WEIGHTS.map((defendingWeight) => {
    let negativeLogLikelihood = 0;
    let corners = 0;
    for (const fold of folds) {
      const cache = new Map();
      for (const episode of fold.heldOut) {
        const key = `${episode.state.attacking_team_id}:${episode.state.defending_team_id}`;
        if (!cache.has(key)) {
          cache.set(key, matchupProbabilities(
            fold.attackingCountsFor(episode.state.attacking_team_id),
            fold.defendingCountsFor(episode.state.defending_team_id),
            fold.tournamentProbabilities,
            concentration,
            defendingWeight,
          ));
        }
        negativeLogLikelihood -= Math.log(cache.get(key)[episode.observed_action.value]);
        corners += 1;
      }
    }
    return {
      concentration,
      defending_weight: defendingWeight,
      group_stage_leave_one_match_out_mean_log_loss: negativeLogLikelihood / corners,
    };
  });
  const selected = candidates.toSorted((left, right) =>
    left.group_stage_leave_one_match_out_mean_log_loss -
      right.group_stage_leave_one_match_out_mean_log_loss ||
    left.defending_weight - right.defending_weight)[0];
  const tournamentProbabilities = normalizeCounts(globalCounts);
  const probabilitiesFor = (attackingTeamId, defendingTeamId) => matchupProbabilities(
    attackingCounts.get(attackingTeamId) ?? emptyCounts,
    defendingCounts.get(defendingTeamId) ?? emptyCounts,
    tournamentProbabilities,
    concentration,
    selected.defending_weight,
  );
  const matchupForecast = (episode) => probabilitiesFor(
    episode.state.attacking_team_id,
    episode.state.defending_team_id,
  );
  const opponentForecast = (episode) => opponentOnlyForecast(episode.state.attacking_team_id);
  const scorePartition = (episodes) => {
    const baseline = scoreForecastByEpisode(episodes, opponentForecast);
    const candidate = scoreForecastByEpisode(episodes, matchupForecast);
    return {
      opponent_only: baseline,
      matchup_conditioned: candidate,
      improvement_vs_opponent_only: improvement(baseline, candidate),
    };
  };
  const partitions = {
    round_of_16: scorePartition(rehearsal),
    quarter_final_and_later: scorePartition(finalAudit),
    all_knockout: scorePartition([...rehearsal, ...finalAudit]),
  };
  const bootstrap = forecastComparisonBootstrap(
    [...rehearsal, ...finalAudit],
    opponentForecast,
    matchupForecast,
  );
  const promotionGates = {
    group_stage_selected_defensive_signal: selected.defending_weight > 0,
    round_of_16_log_loss_improved:
      partitions.round_of_16.improvement_vs_opponent_only.log_loss_reduction > 0,
    quarter_final_and_later_log_loss_improved:
      partitions.quarter_final_and_later.improvement_vs_opponent_only.log_loss_reduction > 0,
    all_knockout_log_loss_improved:
      partitions.all_knockout.improvement_vs_opponent_only.log_loss_reduction > 0,
    both_holdouts_brier_non_worse:
      partitions.round_of_16.improvement_vs_opponent_only.brier_reduction >= 0 &&
      partitions.quarter_final_and_later.improvement_vs_opponent_only.brier_reduction >= 0,
    match_cluster_interval_lower_above_zero:
      bootstrap.mean_log_score_gain_per_corner_interval.lower_95 > 0,
    match_cluster_probability_at_least_0975:
      bootstrap.probability_gain_above_zero >= 0.975,
  };
  return {
    probabilitiesFor,
    audit: {
      status: Object.values(promotionGates).every(Boolean) ? "PASS" : "REJECT",
      question: "Does adding the manager team's group-stage defensive exposure improve the opponent-only forecast on unseen knockout corners?",
      selection_data: "group-stage reference only; leave-one-match-out hyperparameter selection",
      family: "log-linear attack-by-defensive-exposure challenger with Dirichlet partial pooling",
      formula: "normalize(opponent_attack_posterior * (manager_defensive_exposure_posterior / tournament_probability) ^ defending_weight)",
      fixed_concentration: concentration,
      candidate_defending_weights: MATCHUP_DEFENSE_WEIGHTS,
      selected,
      partition_scores: partitions,
      bootstrap,
      promotion_gates: promotionGates,
      product_decision: "Do not pool manager defensive exposure into the displayed forecast unless every preregistered promotion gate passes.",
    },
  };
}

function forecastBootstrap(episodes, globalProbabilities, teamProbabilities, draws = 10_000) {
  const matchIds = [...new Set(episodes.map((episode) => episode.state.match_id))].sort((a, b) => a - b);
  const gainsByMatch = new Map(matchIds.map((matchId) => {
    const trials = episodes.filter((episode) => episode.state.match_id === matchId);
    return [matchId, {
      corners: trials.length,
      gain: trials.reduce((sum, episode) => {
        const action = episode.observed_action.value;
        return sum + Math.log(teamProbabilities.get(episode.state.attacking_team_id)[action]) -
          Math.log(globalProbabilities[action]);
      }, 0),
    }];
  }));
  const random = seededRandom(0x51c0ffee);
  const means = [];
  for (let draw = 0; draw < draws; draw += 1) {
    let gain = 0;
    let corners = 0;
    for (let index = 0; index < matchIds.length; index += 1) {
      const sampled = gainsByMatch.get(matchIds[Math.floor(random() * matchIds.length)]);
      gain += sampled.gain;
      corners += sampled.corners;
    }
    means.push(gain / corners);
  }
  means.sort((a, b) => a - b);
  return {
    unit: "knockout-match-cluster",
    draws,
    seed: "0x51c0ffee",
    mean_log_score_gain_per_corner_interval: {
      lower_95: quantile(means, 0.025),
      median: quantile(means, 0.5),
      upper_95: quantile(means, 0.975),
    },
    probability_gain_above_zero: means.filter((value) => value > 0).length / means.length,
  };
}

export function buildTeamScoutingAudit(allEpisodes, matches, players = []) {
  const eligible = allEpisodes.filter((episode) => episode.observed_action.validity === "observed-endpoint");
  const matchIds = [...new Set(eligible.map((episode) => episode.state.match_id))].sort((a, b) => a - b);
  const referenceIds = matchIds.slice(0, 48);
  const rehearsalIds = matchIds.slice(48, 56);
  const finalIds = matchIds.slice(56);
  const referenceSet = new Set(referenceIds);
  const rehearsalSet = new Set(rehearsalIds);
  const finalSet = new Set(finalIds);
  const reference = eligible.filter((episode) => referenceSet.has(episode.state.match_id));
  const referenceAll = allEpisodes.filter((episode) => referenceSet.has(episode.state.match_id));
  const rehearsal = eligible.filter((episode) => rehearsalSet.has(episode.state.match_id));
  const finalAudit = eligible.filter((episode) => finalSet.has(episode.state.match_id));
  const knockout = [...rehearsal, ...finalAudit];
  const referenceTeamIds = [...new Set(reference.map((episode) => episode.state.attacking_team_id))].sort((a, b) => a - b);
  const globalCounts = actionCounts(reference);
  const globalProbabilities = normalizeCounts(globalCounts);
  const referenceCountsByTeam = new Map(referenceTeamIds.map((teamId) => [
    teamId,
    actionCounts(reference.filter((episode) => episode.state.attacking_team_id === teamId)),
  ]));

  const concentrationScores = TEAM_PRIOR_CONCENTRATIONS.map((concentration) => ({
    concentration,
    group_stage_leave_one_team_out_log_evidence: referenceTeamIds.reduce((sum, teamId) => {
      const heldOutCounts = referenceCountsByTeam.get(teamId);
      const trainingCounts = subtractCounts(globalCounts, heldOutCounts);
      return sum + dirichletMultinomialLogEvidence(
        heldOutCounts,
        normalizeCounts(trainingCounts),
        concentration,
      );
    }, 0),
  }));
  const selected = concentrationScores.toSorted((left, right) =>
    right.group_stage_leave_one_team_out_log_evidence - left.group_stage_leave_one_team_out_log_evidence ||
    left.concentration - right.concentration)[0];
  const concentration = selected.concentration;
  const teamProbabilities = new Map(referenceTeamIds.map((teamId) => [
    teamId,
    posteriorProbabilities(referenceCountsByTeam.get(teamId), globalProbabilities, concentration),
  ]));
  const globalForecast = () => globalProbabilities;
  const teamForecast = (teamId) => teamProbabilities.get(teamId) ?? globalProbabilities;
  const scorePartition = (episodes) => {
    const baseline = scoreForecast(episodes, globalForecast);
    const candidate = scoreForecast(episodes, teamForecast);
    return { baseline, team_conditioned: candidate, improvement: improvement(baseline, candidate) };
  };
  const partitionScores = {
    round_of_16: scorePartition(rehearsal),
    quarter_final_and_later: scorePartition(finalAudit),
    all_knockout: scorePartition(knockout),
  };
  const matchupChallenger = buildMatchupChallenger(
    reference,
    referenceIds,
    rehearsal,
    finalAudit,
    teamForecast,
    concentration,
  );
  const topTwoCoverage = (episodes) => {
    const tournamentTopTwo = probabilityRanking(globalProbabilities).slice(0, 2);
    return {
      corners: episodes.length,
      tournament_top_two: tournamentTopTwo,
      tournament_top_two_covered: episodes.filter((episode) =>
        tournamentTopTwo.includes(episode.observed_action.value)).length,
      team_conditioned_top_two_covered: episodes.filter((episode) =>
        probabilityRanking(teamForecast(episode.state.attacking_team_id)).slice(0, 2)
          .includes(episode.observed_action.value)).length,
    };
  };
  const names = teamNames(matches);
  const knockoutTeamIds = [...new Set(knockout.map((episode) => episode.state.attacking_team_id))].sort((a, b) => a - b);
  const teamScores = knockoutTeamIds.map((teamId) => {
    const trials = knockout.filter((episode) => episode.state.attacking_team_id === teamId);
    const baseline = scoreForecast(trials, globalForecast);
    const candidate = scoreForecast(trials, teamForecast);
    const counts = referenceCountsByTeam.get(teamId) ?? actionCounts([]);
    return {
      team_id: teamId,
      team_name: names.get(teamId) ?? `team:${teamId}`,
      group_stage_classified_corners: totalCounts(counts),
      group_stage_action_counts: counts,
      team_evidence_weight: totalCounts(counts) / (totalCounts(counts) + concentration),
      tournament_prior_weight: concentration / (totalCounts(counts) + concentration),
      posterior_probabilities: teamForecast(teamId),
      knockout_classified_corners: trials.length,
      log_loss_improved: candidate.mean_log_loss < baseline.mean_log_loss,
      baseline_mean_log_loss: baseline.mean_log_loss,
      team_conditioned_mean_log_loss: candidate.mean_log_loss,
    };
  });

  const matchById = new Map(matches.map((match) => [Number(match.wyId), match]));
  const dossierFor = (matchId, managerId, opponentTeamId) => {
    const match = matchById.get(matchId);
    const opponentReference = reference.filter((episode) =>
      episode.state.attacking_team_id === opponentTeamId);
    const opponentReferenceAll = referenceAll.filter((episode) =>
      episode.state.attacking_team_id === opponentTeamId);
    const managerExposure = reference.filter((episode) =>
      episode.state.defending_team_id === managerId);
    const managerExposureAll = referenceAll.filter((episode) =>
      episode.state.defending_team_id === managerId);
    const heldOut = rehearsal.filter((episode) =>
      episode.state.match_id === matchId && episode.state.attacking_team_id === opponentTeamId);
    const heldOutAll = allEpisodes.filter((episode) =>
      episode.state.match_id === matchId && episode.state.attacking_team_id === opponentTeamId);
    const tournamentTopTwo = probabilityRanking(globalProbabilities).slice(0, 2);
    const opponentProbabilities = teamForecast(opponentTeamId);
    const opponentTopTwo = probabilityRanking(opponentProbabilities).slice(0, 2);
    const baselineScore = scoreForecast(heldOut, globalForecast);
    const teamScore = scoreForecast(heldOut, teamForecast);
    return {
      match_id: matchId,
      match_name: String(match?.label ?? "").split(",")[0],
      manager_team_id: managerId,
      manager_team_name: names.get(managerId) ?? `team:${managerId}`,
      opponent_team_id: opponentTeamId,
      opponent_team_name: names.get(opponentTeamId) ?? `team:${opponentTeamId}`,
      opponent_group_stage_source_corners: opponentReferenceAll.length,
      opponent_group_stage_classified_corners: opponentReference.length,
      opponent_group_stage_placeholder_corners: opponentReferenceAll.length - opponentReference.length,
      opponent_group_stage_action_counts: actionCounts(opponentReference),
      opponent_posterior_probabilities: opponentProbabilities,
      opponent_evidence_weight: opponentReference.length / (opponentReference.length + concentration),
      tournament_prior_weight: concentration / (opponentReference.length + concentration),
      manager_group_stage_defensive_exposure_source_corners: managerExposureAll.length,
      manager_group_stage_defensive_exposure_classified_corners: managerExposure.length,
      manager_group_stage_defensive_exposure_placeholder_corners: managerExposureAll.length - managerExposure.length,
      manager_group_stage_defensive_exposure_action_counts: actionCounts(managerExposure),
      defensive_exposure_is_not_pooled_into_forecast: true,
      matchup_challenger_probabilities: matchupChallenger.probabilitiesFor(opponentTeamId, managerId),
      held_out_opponent_source_corners: heldOutAll.length,
      held_out_opponent_classified_corners: heldOut.length,
      held_out_opponent_placeholder_corners: heldOutAll.length - heldOut.length,
      held_out_opponent_action_counts: actionCounts(heldOut),
      held_out_forecast_scores: {
        tournament_baseline: baselineScore,
        team_conditioned: teamScore,
        improvement: improvement(baselineScore, teamScore),
      },
      tournament_top_two: tournamentTopTwo,
      tournament_top_two_covered: heldOut.filter((episode) =>
        tournamentTopTwo.includes(episode.observed_action.value)).length,
      team_conditioned_top_two: opponentTopTwo,
      team_conditioned_top_two_covered: heldOut.filter((episode) =>
        opponentTopTwo.includes(episode.observed_action.value)).length,
    };
  };
  const roundOf16Dossiers = rehearsalIds.flatMap((matchId) => {
    const teams = Object.values(matchById.get(matchId)?.teamsData ?? {});
    const homeId = Number(teams.find((team) => team.side === "home")?.teamId);
    const awayId = Number(teams.find((team) => team.side === "away")?.teamId);
    return [dossierFor(matchId, homeId, awayId), dossierFor(matchId, awayId, homeId)];
  });
  const firstRehearsalMatch = rehearsalIds[0];
  const firstExample = roundOf16Dossiers.find((dossier) =>
    dossier.match_id === firstRehearsalMatch &&
    dossier.manager_team_id === Number(Object.values(matchById.get(firstRehearsalMatch)?.teamsData ?? {})
      .find((team) => team.side === "home")?.teamId));
  const bootstrap = forecastBootstrap(knockout, globalProbabilities, teamProbabilities);

  return {
    schema_version: 1,
    question: "Does a group-stage team delivery profile forecast unseen knockout delivery lanes better than the tournament-wide profile?",
    status: partitionScores.round_of_16.improvement.log_loss_reduction > 0 &&
      partitionScores.quarter_final_and_later.improvement.log_loss_reduction > 0 &&
      bootstrap.mean_log_score_gain_per_corner_interval.lower_95 > 0 ? "PASS" : "REVISE",
    claim_boundary: {
      supported: "Opponent-specific probabilities for classifiable recorded corner delivery endpoints in this 2018 tournament.",
      unsupported: [
        "optimal defensive placement",
        "shots or goals prevented",
        "player marking assignments or reach",
        "causal tactical effects",
        "persistence from 2018 to 2026",
      ],
      missing_endpoints_are_excluded: true,
    },
    split_rule: "48 group-stage matches fit and select; 8 round-of-16 matches evaluate; 8 quarter-final-and-later matches audit unchanged",
    reference: {
      matches: referenceIds.length,
      classified_corners: reference.length,
      action_counts: globalCounts,
      tournament_probabilities: globalProbabilities,
    },
    model: {
      family: "Dirichlet-multinomial partial pooling",
      selection_data: "group-stage reference only",
      candidate_concentrations: TEAM_PRIOR_CONCENTRATIONS,
      concentration_scores: concentrationScores,
      selected_concentration: concentration,
      formula: "(team count + concentration * tournament probability) / (team corners + concentration)",
    },
    partition_scores: partitionScores,
    matchup_challenger: matchupChallenger.audit,
    top_two_coverage: {
      round_of_16: topTwoCoverage(rehearsal),
      quarter_final_and_later: topTwoCoverage(finalAudit),
    },
    bootstrap,
    teams_improved: teamScores.filter((team) => team.log_loss_improved).length,
    teams_evaluated: teamScores.length,
    team_profiles: teamScores,
    round_of_16_dossiers: roundOf16Dossiers,
    first_fixed_round_of_16_example: {
      selection_rule: "lowest source match ID in the predeclared round-of-16 partition; not selected by forecast result",
      ...firstExample,
      held_out_opponent_corners: firstExample.held_out_opponent_classified_corners,
    },
    corner_situation_rehearsal: buildCornerSituationRehearsal(allEpisodes, players, firstExample),
  };
}

function rankByShotRate(summary) {
  return DELIVERY_ACTIONS.toSorted((a, b) =>
    (summary[b].shot_rate ?? -1) - (summary[a].shot_rate ?? -1) || a.localeCompare(b));
}

function supportAudit(episodes) {
  const teamIds = [...new Set(episodes.map((episode) => episode.state.attacking_team_id))].sort((a, b) => a - b);
  const teams = teamIds.map((teamId) => {
    const teamEpisodes = episodes.filter((episode) => episode.state.attacking_team_id === teamId);
    const counts = Object.fromEntries(DELIVERY_ACTIONS.map((action) => [
      action, teamEpisodes.filter((episode) => episode.observed_action.value === action).length,
    ]));
    return { team_id: teamId, corners: teamEpisodes.length, action_counts: counts, min_action_count: Math.min(...Object.values(counts)) };
  });
  return {
    team_count: teams.length,
    teams_with_any_action_below_3: teams.filter((team) => team.min_action_count < 3).length,
    teams,
  };
}

function leaveOneMatchOut(episodes) {
  const matchIds = [...new Set(episodes.map((episode) => episode.state.match_id))].sort((a, b) => a - b);
  const folds = matchIds.map((matchId) => {
    const train = episodes.filter((episode) => episode.state.match_id !== matchId);
    const test = episodes.filter((episode) => episode.state.match_id === matchId);
    const trainSummary = actionSummary(train);
    const testSummary = actionSummary(test);
    return {
      match_id: matchId,
      train_corners: train.length,
      test_corners: test.length,
      train_ranking: rankByShotRate(trainSummary),
      test_action_support: Object.fromEntries(DELIVERY_ACTIONS.map((action) => [action, testSummary[action].corners])),
    };
  });
  return {
    folds: folds.length,
    top_action_frequency: Object.fromEntries(DELIVERY_ACTIONS.map((action) => [
      action, folds.filter((fold) => fold.train_ranking[0] === action).length,
    ])),
    folds_without_all_test_actions: folds.filter((fold) => Object.values(fold.test_action_support).some((count) => count === 0)).length,
  };
}

function buildBlindFolds(episodes) {
  const matchIds = [...new Set(episodes.map((episode) => episode.state.match_id))].sort((a, b) => a - b);
  return matchIds.map((testMatchId) => {
    const train = episodes.filter((episode) => episode.state.match_id !== testMatchId);
    const test = episodes.filter((episode) => episode.state.match_id === testMatchId);
    const trainMatchIds = [...new Set(train.map((episode) => episode.state.match_id))].sort((a, b) => a - b);
    return {
      test_match_id: testMatchId,
      train_match_ids: trainMatchIds,
      disjoint: !trainMatchIds.includes(testMatchId),
      train_corners: train.length,
      test_corners: test.length,
      test_trials: test,
      test_trial: test[0],
      training_summary: actionSummary(train),
      training_bootstrap: clusteredBootstrap(train, 300),
    };
  });
}

function segmentCoverage(allEpisodes, validEpisodes, matchIds) {
  const ids = new Set(matchIds);
  const source = allEpisodes.filter((episode) => ids.has(episode.state.match_id));
  const valid = validEpisodes.filter((episode) => ids.has(episode.state.match_id));
  const missing = source.length - valid.length;
  return {
    source_corners: source.length,
    classified_corners: valid.length,
    placeholder_corners: missing,
    classified_rate: valid.length / source.length,
    delivery_share_bounds: Object.fromEntries(DELIVERY_ACTIONS.map((action) => {
      const count = valid.filter((episode) => episode.observed_action.value === action).length;
      return [action, { lower: count / source.length, upper: (count + missing) / source.length }];
    })),
  };
}

function buildPolicyCampaign(allEpisodes) {
  const episodes = allEpisodes.filter((episode) => episode.observed_action.validity === "observed-endpoint");
  const matchIds = [...new Set(episodes.map((episode) => episode.state.match_id))].sort((a, b) => a - b);
  const referenceMatchIds = matchIds.slice(0, 48);
  const rehearsalMatchIds = matchIds.slice(48, 56);
  const finalAuditMatchIds = matchIds.slice(56);
  const referenceSet = new Set(referenceMatchIds);
  const reference = episodes.filter((episode) => referenceSet.has(episode.state.match_id));
  const pack = (ids) => ids.map((matchId) => {
    const trials = episodes.filter((episode) => episode.state.match_id === matchId);
    return {
      match_id: matchId,
      match_name: trials[0]?.provenance.match_name ?? `match:${matchId}`,
      trials,
      corners: trials.length,
    };
  });
  return {
    split_rule: "ascending-match-id:48-reference:8-rehearsal:8-final-audit",
    reference_match_ids: referenceMatchIds,
    rehearsal_match_ids: rehearsalMatchIds,
    final_audit_match_ids: finalAuditMatchIds,
    partitions_disjoint: new Set([...referenceMatchIds, ...rehearsalMatchIds, ...finalAuditMatchIds]).size === matchIds.length,
    product_status: "PASS",
    empirical_campaign_status: "REVISE",
    causal_recommendation_status: "REJECT",
    reference_corners: reference.length,
    reference_summary: actionSummary(reference),
    reference_outlet_context: outletContext(reference),
    reference_bootstrap: clusteredBootstrap(reference),
    segment_coverage: {
      reference: segmentCoverage(allEpisodes, episodes, referenceMatchIds),
      rehearsal: segmentCoverage(allEpisodes, episodes, rehearsalMatchIds),
      final_audit: segmentCoverage(allEpisodes, episodes, finalAuditMatchIds),
    },
    rehearsal_matches: pack(rehearsalMatchIds),
    final_audit_matches: pack(finalAuditMatchIds),
  };
}

function seededRandom(seed = 0x5eed1234) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function quantile(sorted, probability) {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function clusteredBootstrap(episodes, draws = 2000) {
  const matchIds = [...new Set(episodes.map((episode) => episode.state.match_id))].sort((a, b) => a - b);
  const byMatch = new Map(matchIds.map((matchId) => [matchId, episodes.filter((episode) => episode.state.match_id === matchId)]));
  const observed = actionSummary(episodes);
  const [leader, runnerUp] = rankByShotRate(observed);
  const random = seededRandom();
  const differences = [];
  const leaderCounts = Object.fromEntries(DELIVERY_ACTIONS.map((action) => [action, 0]));
  for (let draw = 0; draw < draws; draw += 1) {
    const sample = [];
    for (let index = 0; index < matchIds.length; index += 1) {
      const matchId = matchIds[Math.floor(random() * matchIds.length)];
      sample.push(...byMatch.get(matchId));
    }
    const summary = actionSummary(sample);
    leaderCounts[rankByShotRate(summary)[0]] += 1;
    if (summary[leader].shot_rate !== null && summary[runnerUp].shot_rate !== null) {
      differences.push(summary[leader].shot_rate - summary[runnerUp].shot_rate);
    }
  }
  differences.sort((a, b) => a - b);
  const interval = {
    lower_95: quantile(differences, 0.025),
    median: quantile(differences, 0.5),
    upper_95: quantile(differences, 0.975),
  };
  return {
    unit: "match-cluster",
    draws,
    observed_leader: leader,
    observed_runner_up: runnerUp,
    shot_rate_difference_interval: interval,
    leader_frequency: leaderCounts,
    leader_separated_from_runner_up: interval.lower_95 > 0,
  };
}

function rewardSensitivity(episodes) {
  const weights = [0, 0.5, 1, 2, 4];
  return weights.map((goalWeight) => {
    const values = Object.fromEntries(DELIVERY_ACTIONS.map((action) => {
      const selected = episodes.filter((episode) => episode.observed_action.value === action);
      const reward = selected.reduce((sum, episode) => sum + Number(episode.observed_outcome.attacking_shot) +
        goalWeight * Number(episode.observed_outcome.goal_tagged_shot), 0);
      return [action, selected.length === 0 ? null : reward / selected.length];
    }));
    const ranking = DELIVERY_ACTIONS.toSorted((a, b) =>
      (values[b] ?? -1) - (values[a] ?? -1) || a.localeCompare(b));
    return { shot_weight: 1, goal_weight: goalWeight, values, ranking };
  });
}

export function buildPolicyLabSpike(events, matches, players = []) {
  const byHorizon = Object.fromEntries(HORIZONS.map((horizon) => {
    const episodes = derivePolicyEpisodes(events, matches, horizon);
    const summary = actionSummary(episodes);
    return [String(horizon), {
      corners: episodes.length,
      terminal_windows: episodes.filter((episode) => episode.observed_transition.terminal).length,
      action_summary: summary,
      shot_ranking: rankByShotRate(summary),
    }];
  }));
  const episodes = derivePolicyEpisodes(events, matches, 10);
  const eligibleEpisodes = episodes.filter((episode) => episode.observed_action.validity === "observed-endpoint");
  const support = supportAudit(eligibleEpisodes);
  const bootstrap = clusteredBootstrap(eligibleEpisodes);
  const reward = rewardSensitivity(eligibleEpisodes);
  const blindFolds = buildBlindFolds(eligibleEpisodes);
  const horizonRankings = Object.values(byHorizon).map((entry) => entry.shot_ranking.join("|"));
  const gates = {
    transform_coverage_95pct: episodes.length >= 603 * 0.95,
    exact_source_population: episodes.length === 603,
    observed_action_coverage_95pct: eligibleEpisodes.length >= episodes.length * 0.95,
    team_specific_support: support.teams_with_any_action_below_3 === 0,
    horizon_ranking_stable: new Set(horizonRankings).size === 1,
    top_association_separated: bootstrap.leader_separated_from_runner_up,
    reward_ranking_stable: new Set(reward.map((entry) => entry.ranking.join("|"))).size === 1,
  };
  const candidateRejected = !gates.observed_action_coverage_95pct;
  return {
    schema_version: 1,
    transform_version: POLICY_SPIKE_VERSION,
    provenance: {
      source_ids: [
        "pappalardo-wyscout-events-wc-2018",
        "pappalardo-wyscout-matches-wc-2018",
        "pappalardo-wyscout-players",
      ],
      input_sha256: { ...INPUT_HASHES, players: PLAYERS_INPUT_SHA256 },
      bootstrap_seed: "0x5eed1234",
    },
    status: candidateRejected ? "REJECT" : Object.values(gates).every(Boolean) ? "PASS" : "REVISE",
    interpretation: "Observed attacking delivery associations only; not a causal policy value or defensive-action estimate.",
    ontology: {
      node_types: ["MatchContext", "ScoutingPolicy", "CornerRestart", "DeliveryAction", "ObservedEvent", "OutcomeProxy", "Source"],
      edge_types: ["TESTED_IN", "COVERS_RECORDED_ACTION", "OCCURRED_IN", "RECORDED_ACTION", "OBSERVED_NEXT", "OBSERVED_OUTCOME", "DERIVED_FROM"],
      forbidden_edges: ["DEFENSIVE_DUTY_CAUSED", "WOULD_PREVENT", "OPTIMAL_POLICY"],
    },
    gates,
    population: { source_corners: episodes.length, observed_action_corners: eligibleEpisodes.length, placeholder_action_corners: episodes.length - eligibleEpisodes.length },
    ten_second_summary: actionSummary(eligibleEpisodes),
    support,
    clustered_bootstrap: bootstrap,
    reward_sensitivity: reward,
    policy_campaign: buildPolicyCampaign(episodes),
    team_scouting: buildTeamScoutingAudit(episodes, matches, players),
    blind_folds: blindFolds,
    leave_one_match_out: leaveOneMatchOut(eligibleEpisodes),
    horizon_sensitivity: byHorizon,
  };
}
