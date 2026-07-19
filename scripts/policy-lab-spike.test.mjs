import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildPolicyLabSpike, derivePolicyEpisodes } from "./lib/policy-lab-spike.mjs";

const [events, matches] = await Promise.all([
  readFile("data/raw/pappalardo/events_World_Cup.json", "utf8").then(JSON.parse),
  readFile("data/raw/pappalardo/matches_World_Cup.json", "utf8").then(JSON.parse),
]);

const episodes = derivePolicyEpisodes(events, matches, 10);
const report = buildPolicyLabSpike(events, matches);

describe("Policy Lab data spike", () => {
  it("derives the exact World Cup corner population and reviewed associations", () => {
    expect(episodes).toHaveLength(603);
    expect(episodes.filter((episode) => episode.observed_action.validity === "placeholder-endpoint")).toHaveLength(46);
    expect(report.ten_second_summary).toEqual({
      short: { corners: 101, shots: 19, goals: 4, shot_rate: 19 / 101 },
      near: { corners: 184, shots: 57, goals: 5, shot_rate: 57 / 184 },
      "central-far": { corners: 235, shots: 89, goals: 10, shot_rate: 89 / 235 },
      other: { corners: 37, shots: 8, goals: 0, shot_rate: 8 / 37 },
    });
  });

  it("keeps decision state free of delivery and future outcome fields", () => {
    const forbidden = /action|delivery|endpoint|shot|goal|outcome|tag|score|winner|event_id/iu;
    for (const episode of episodes) {
      expect(Object.keys(episode.state).some((key) => forbidden.test(key))).toBe(false);
      expect(episode.provenance.observed_event_ids[0]).toBe(episode.provenance.corner_event_id);
    }
  });

  it("fails closed on team-specific support instead of claiming an RL policy", () => {
    expect(report.gates.exact_source_population).toBe(true);
    expect(report.population).toEqual({ source_corners: 603, observed_action_corners: 557, placeholder_action_corners: 46 });
    expect(report.gates.observed_action_coverage_95pct).toBe(false);
    expect(report.support.team_count).toBe(32);
    expect(report.support.teams_with_any_action_below_3).toBe(31);
    expect(report.gates.team_specific_support).toBe(false);
    expect(report.clustered_bootstrap.unit).toBe("match-cluster");
    expect(report.clustered_bootstrap.draws).toBe(2000);
    expect(report.status).toBe("REJECT");
    expect(report.ontology.forbidden_edges).toContain("OPTIMAL_POLICY");
  });

  it("uses grouped match holdouts rather than a random corner split", () => {
    expect(report.leave_one_match_out.folds).toBe(64);
    expect(report.blind_folds).toHaveLength(64);
    for (const fold of report.blind_folds) {
      expect(fold.disjoint).toBe(true);
      expect(fold.train_match_ids).not.toContain(fold.test_match_id);
      expect(fold.test_trials).toHaveLength(fold.test_corners);
      expect(fold.test_trials.every((trial) => trial.state.match_id === fold.test_match_id)).toBe(true);
      expect(fold.test_trials.every((trial) => trial.observed_action.validity === "observed-endpoint")).toBe(true);
      expect(fold.test_trial.state.match_id).toBe(fold.test_match_id);
      expect(fold.test_trial.observed_action.validity).toBe("observed-endpoint");
      expect(fold.training_bootstrap.draws).toBe(300);
    }
    expect(report.leave_one_match_out.folds_without_all_test_actions).toBeGreaterThan(0);
  });

  it("freezes disjoint reference, rehearsal, and final-audit match partitions", () => {
    const campaign = report.policy_campaign;
    expect(campaign.split_rule).toBe("ascending-match-id:48-reference:8-rehearsal:8-final-audit");
    expect(campaign.reference_match_ids).toHaveLength(48);
    expect(campaign.rehearsal_match_ids).toHaveLength(8);
    expect(campaign.final_audit_match_ids).toHaveLength(8);
    expect(campaign.partitions_disjoint).toBe(true);
    expect(campaign.causal_recommendation_status).toBe("REJECT");
    expect(campaign.product_status).toBe("PASS");
    expect(campaign.empirical_campaign_status).toBe("REVISE");
    const reference = new Set(campaign.reference_match_ids);
    const rehearsal = new Set(campaign.rehearsal_match_ids);
    const finalAudit = new Set(campaign.final_audit_match_ids);
    expect([...reference].some((id) => rehearsal.has(id) || finalAudit.has(id))).toBe(false);
    expect([...rehearsal].some((id) => finalAudit.has(id))).toBe(false);
    const campaignCorners = campaign.reference_corners +
      campaign.rehearsal_matches.reduce((sum, match) => sum + match.corners, 0) +
      campaign.final_audit_matches.reduce((sum, match) => sum + match.corners, 0);
    expect(campaignCorners).toBe(557);
    expect(campaign.segment_coverage).toMatchObject({
      reference: { source_corners: 436, classified_corners: 397, placeholder_corners: 39 },
      rehearsal: { source_corners: 89, classified_corners: 84, placeholder_corners: 5 },
      final_audit: { source_corners: 78, classified_corners: 76, placeholder_corners: 2 },
    });
    for (const segment of Object.values(campaign.segment_coverage)) {
      expect(segment.classified_corners + segment.placeholder_corners).toBe(segment.source_corners);
      for (const bounds of Object.values(segment.delivery_share_bounds)) {
        expect(bounds.lower).toBeLessThanOrEqual(bounds.upper);
      }
    }
  });
});
