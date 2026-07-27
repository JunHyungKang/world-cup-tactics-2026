import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildPolicyLabSpike,
  buildTeamScoutingAudit,
  derivePolicyEpisodes,
} from "./lib/policy-lab-spike.mjs";

const [events, matches, players, committed] = await Promise.all([
  readFile("data/raw/pappalardo/events_World_Cup.json", "utf8").then(JSON.parse),
  readFile("data/raw/pappalardo/matches_World_Cup.json", "utf8").then(JSON.parse),
  readFile("data/raw/pappalardo/players.json", "utf8").then(JSON.parse),
  readFile("public/data/policy-lab-spike.json", "utf8").then(JSON.parse),
]);

const episodes = derivePolicyEpisodes(events, matches, 10);
const report = buildPolicyLabSpike(events, matches, players);

describe("Policy Lab raw reproduction", () => {
  it("reproduces the committed derivative byte-for-value", () => {
    expect(report).toEqual(committed);
  });

  it("derives the exact source population and keeps state free of future fields", () => {
    expect(episodes).toHaveLength(603);
    expect(episodes.filter((episode) => episode.observed_action.validity === "placeholder-endpoint")).toHaveLength(46);
    const forbidden = /action|delivery|endpoint|shot|goal|outcome|tag|score|winner|event_id/iu;
    for (const episode of episodes) {
      expect(Object.keys(episode.state).some((key) => forbidden.test(key))).toBe(false);
      expect(episode.provenance.observed_event_ids[0]).toBe(episode.provenance.corner_event_id);
      expect(typeof episode.observed_outcome.defending_outlet_contact).toBe("boolean");
      expect(Object.keys(episode)).not.toContain("_routine");
      expect(typeof episode._routine.first_event_subtype).toBe("string");
      expect(Number.isInteger(episode._routine.corner_taker_player_id)).toBe(true);
      expect(episode._routine.first_defending_event_player_id === null ||
        Number.isInteger(episode._routine.first_defending_event_player_id)).toBe(true);
    }
  });

  it("selects the shrinkage strength without reading either knockout partition", () => {
    const original = buildTeamScoutingAudit(episodes, matches, players);
    const changedHoldouts = structuredClone(episodes);
    for (let index = 0; index < changedHoldouts.length; index += 1) {
      Object.defineProperty(changedHoldouts[index], "_routine", {
        enumerable: false,
        value: episodes[index]._routine,
      });
    }
    const referenceIds = new Set(report.policy_campaign.reference_match_ids);
    for (const episode of changedHoldouts) {
      if (!referenceIds.has(episode.state.match_id) &&
          episode.observed_action.validity === "observed-endpoint") {
        episode.observed_action.value = "other";
      }
    }
    const changed = buildTeamScoutingAudit(changedHoldouts, matches, players);
    expect(original.model.selected_concentration).toBe(16);
    expect(changed.model.selected_concentration).toBe(original.model.selected_concentration);
    expect(changed.model.concentration_scores).toEqual(original.model.concentration_scores);
    expect(changed.matchup_challenger.selected).toEqual(original.matchup_challenger.selected);
    expect(changed.partition_scores).not.toEqual(original.partition_scores);
    expect(changed.matchup_challenger.partition_scores)
      .not.toEqual(original.matchup_challenger.partition_scores);
  });

  it("fails closed when a player required by the public fixed example is missing", () => {
    const withoutQuaresma = players.filter((player) => Number(player.wyId) !== 32597);
    expect(() => buildPolicyLabSpike(events, matches, withoutQuaresma))
      .toThrow(/players source is missing/);
  });
});
