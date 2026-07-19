import { INPUT_HASHES, NOMINAL_REGIONS, eventMicroseconds, isFinitePoint, isPlaceholder, pointInRegion, stableEventOrder } from "./corner-transform.mjs";

export const DELIVERY_ACTIONS = Object.freeze(["short", "near", "central-far", "other"]);
export const HORIZONS = Object.freeze([8, 10, 12, 15]);
export const POLICY_SPIKE_VERSION = "policy-lab-spike-v4-fixed-match-campaign";

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

  return {
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
    },
    provenance: {
      corner_event_id: Number(corner.id),
      match_name: String(match.label ?? "").split(",")[0],
      observed_event_ids: events.map((event) => Number(event.id)),
      source_ids: ["pappalardo-wyscout-events-wc-2018", "pappalardo-wyscout-matches-wc-2018"],
    },
  };
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

export function buildPolicyLabSpike(events, matches) {
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
      source_ids: ["pappalardo-wyscout-events-wc-2018", "pappalardo-wyscout-matches-wc-2018"],
      input_sha256: INPUT_HASHES,
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
    blind_folds: blindFolds,
    leave_one_match_out: leaveOneMatchOut(eligibleEpisodes),
    horizon_sensitivity: byHorizon,
  };
}
