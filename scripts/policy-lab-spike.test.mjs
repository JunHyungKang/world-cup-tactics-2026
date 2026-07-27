import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const report = JSON.parse(await readFile("public/data/policy-lab-spike.json", "utf8"));

describe("Policy Lab committed derivative", () => {
  it("binds the exact World Cup corner population and reviewed associations", () => {
    expect(report.ten_second_summary).toEqual({
      short: { corners: 101, shots: 19, goals: 4, shot_rate: 19 / 101 },
      near: { corners: 184, shots: 57, goals: 5, shot_rate: 57 / 184 },
      "central-far": { corners: 235, shots: 89, goals: 10, shot_rate: 89 / 235 },
      other: { corners: 37, shots: 8, goals: 0, shot_rate: 8 / 37 },
    });
  });

  it("pins the immutable raw inputs and deterministic transform", () => {
    expect(report.transform_version).toBe("policy-lab-spike-v11-source-time-receipts");
    expect(report.provenance.input_sha256).toEqual({
      eventsZip: "877e015b716ffdeea18f04418e3f24fed307ed03c37ff305cabe1f47c4822a45",
      events: "d789b7cd80671a0dd1263150e997d1450e1ed22cddc8beb7bb2a6266b374a869",
      matchesZip: "c8f92bb7533e5c127e043cee764c991b5c25b4f5e70a65be931baae0b1765ce9",
      matches: "1ddab20c8605c063a62341eb846466c8d040885a5f0f9a3e26d023123786abb6",
      players: "877a111cb1005b73df5645e9338bd74fb4b496bace2fbc545a72abb3b73efa2e",
    });
    expect(report.provenance.bootstrap_seed).toBe("0x5eed1234");
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
    expect(campaign.reference_outlet_context).toMatchObject({
      label: "recorded-defending-pass-or-clearance-touching-attacking-outlet-band",
      corners: 397,
      interpretation: "Fixed historical context only; not a caused or completed counterattack.",
    });
    expect(campaign.reference_outlet_context.contacts).toBeGreaterThan(0);
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
    const heldOutTrials = [...campaign.rehearsal_matches, ...campaign.final_audit_matches]
      .flatMap((match) => match.trials);
    expect(heldOutTrials.every((trial) =>
      typeof trial.observed_outcome.defending_outlet_contact === "boolean")).toBe(true);
  });

  it("uses partial pooling to add team context without pretending sparse raw rates are reliable", () => {
    const scouting = report.team_scouting;
    expect(report.gates.team_specific_support).toBe(false);
    expect(scouting.status).toBe("PASS");
    expect(scouting.reference).toMatchObject({
      matches: 48,
      classified_corners: 397,
      action_counts: { short: 76, near: 130, "central-far": 165, other: 26 },
    });
    expect(scouting.model).toMatchObject({
      family: "Dirichlet-multinomial partial pooling",
      selection_data: "group-stage reference only",
      selected_concentration: 16,
    });
    const bestScore = Math.max(...scouting.model.concentration_scores
      .map((candidate) => candidate.group_stage_leave_one_team_out_log_evidence));
    expect(scouting.model.concentration_scores.find((candidate) =>
      candidate.concentration === 16).group_stage_leave_one_team_out_log_evidence).toBe(bestScore);
    expect(scouting.teams_improved).toBe(12);
    expect(scouting.teams_evaluated).toBe(16);
  });

  it("beats the tournament-only forecast in both untouched knockout partitions", () => {
    const scouting = report.team_scouting;
    expect(scouting.partition_scores.round_of_16.baseline.corners).toBe(84);
    expect(scouting.partition_scores.quarter_final_and_later.baseline.corners).toBe(76);
    expect(scouting.partition_scores.all_knockout.baseline.corners).toBe(160);
    expect(scouting.partition_scores.round_of_16.improvement.log_loss_reduction_rate)
      .toBeCloseTo(0.021448078830165047, 12);
    expect(scouting.partition_scores.quarter_final_and_later.improvement.log_loss_reduction_rate)
      .toBeCloseTo(0.07212355442624484, 12);
    expect(scouting.partition_scores.all_knockout.improvement.log_loss_reduction_rate)
      .toBeCloseTo(0.04586384701843413, 12);
    expect(scouting.partition_scores.all_knockout.improvement.brier_reduction_rate)
      .toBeCloseTo(0.04660426794650289, 12);
    expect(scouting.top_two_coverage).toEqual({
      round_of_16: {
        corners: 84,
        tournament_top_two: ["central-far", "near"],
        tournament_top_two_covered: 65,
        team_conditioned_top_two_covered: 65,
      },
      quarter_final_and_later: {
        corners: 76,
        tournament_top_two: ["central-far", "near"],
        tournament_top_two_covered: 59,
        team_conditioned_top_two_covered: 59,
      },
    });
    expect(scouting.bootstrap.mean_log_score_gain_per_corner_interval.lower_95).toBeGreaterThan(0);
    expect(scouting.bootstrap.probability_gain_above_zero).toBeGreaterThan(0.98);
  });

  it("rejects the two-team matchup challenger when its match-level uncertainty misses the promotion gate", () => {
    const challenger = report.team_scouting.matchup_challenger;
    expect(challenger).toMatchObject({
      status: "REJECT",
      fixed_concentration: 16,
      candidate_defending_weights: [0, 0.25, 0.5, 0.75, 1],
      selected: {
        concentration: 16,
        defending_weight: 0.5,
      },
      promotion_gates: {
        group_stage_selected_defensive_signal: true,
        round_of_16_log_loss_improved: true,
        quarter_final_and_later_log_loss_improved: true,
        all_knockout_log_loss_improved: true,
        both_holdouts_brier_non_worse: true,
        match_cluster_interval_lower_above_zero: false,
        match_cluster_probability_at_least_0975: false,
      },
    });
    expect(challenger.partition_scores.all_knockout.improvement_vs_opponent_only.log_loss_reduction_rate)
      .toBeCloseTo(0.01011790356833202, 12);
    expect(challenger.bootstrap.mean_log_score_gain_per_corner_interval.lower_95)
      .toBeCloseTo(-0.004016932056328984, 12);
    expect(challenger.bootstrap.mean_log_score_gain_per_corner_interval.upper_95)
      .toBeCloseTo(0.027364050990838943, 12);
    expect(challenger.bootstrap.probability_gain_above_zero).toBe(0.9226);
  });

  it("keeps the team forecast inside its actual evidence boundary", () => {
    const scouting = report.team_scouting;
    expect(scouting.claim_boundary.missing_endpoints_are_excluded).toBe(true);
    expect(scouting.claim_boundary.unsupported).toEqual(expect.arrayContaining([
      "optimal defensive placement",
      "shots or goals prevented",
      "player marking assignments or reach",
      "causal tactical effects",
      "persistence from 2018 to 2026",
    ]));
    expect(scouting.round_of_16_dossiers).toHaveLength(16);
    expect(scouting.round_of_16_dossiers.filter((dossier) =>
      dossier.held_out_opponent_classified_corners === 0)).toHaveLength(1);
    for (const dossier of scouting.round_of_16_dossiers) {
      expect(dossier.opponent_group_stage_classified_corners +
        dossier.opponent_group_stage_placeholder_corners)
        .toBe(dossier.opponent_group_stage_source_corners);
      expect(dossier.manager_group_stage_defensive_exposure_classified_corners +
        dossier.manager_group_stage_defensive_exposure_placeholder_corners)
        .toBe(dossier.manager_group_stage_defensive_exposure_source_corners);
      expect(dossier.held_out_opponent_classified_corners +
        dossier.held_out_opponent_placeholder_corners)
        .toBe(dossier.held_out_opponent_source_corners);
      expect(dossier.defensive_exposure_is_not_pooled_into_forecast).toBe(true);
      expect(Object.values(dossier.matchup_challenger_probabilities)
        .reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
    }
    const example = scouting.first_fixed_round_of_16_example;
    expect(example).toMatchObject({
      selection_rule: "lowest source match ID in the predeclared round-of-16 partition; not selected by forecast result",
      match_id: 2058002,
      match_name: "Uruguay - Portugal",
      manager_team_name: "Uruguay",
      opponent_team_name: "Portugal",
      opponent_group_stage_classified_corners: 14,
      manager_group_stage_defensive_exposure_classified_corners: 5,
      defensive_exposure_is_not_pooled_into_forecast: true,
      held_out_opponent_corners: 10,
      tournament_top_two_covered: 5,
      team_conditioned_top_two_covered: 9,
    });
  });

  it("builds separate player-linked Portugal attack and Uruguay defense situation records", () => {
    const routine = report.team_scouting.corner_situation_rehearsal;
    expect(routine).toMatchObject({
      status: "PASS",
      opponent_attack_reference: {
        team_name: "Portugal",
        source_corners: 14,
        classifiable_corners: 14,
        situation_counts: {
          "short-recorded-endpoint": 7,
          "aerial-recorded-follow-up": 5,
          "other-recorded-follow-up": 2,
        },
      },
      manager_defensive_reference: {
        team_name: "Uruguay",
        source_corners: 6,
        classifiable_corners: 5,
        situation_counts: {
          "short-recorded-endpoint": 2,
          "aerial-recorded-follow-up": 2,
          "other-recorded-follow-up": 1,
        },
        opponent_shots_within_10_seconds: 1,
      },
      held_out_match: {
        match_name: "Uruguay - Portugal",
        source_corners: 10,
        classifiable_corners: 10,
        situation_counts: {
          "short-recorded-endpoint": 5,
          "aerial-recorded-follow-up": 2,
          "other-recorded-follow-up": 3,
        },
        attacking_shots_within_10_seconds: 4,
      },
    });
    expect(Object.values(routine.player_join_coverage)).not.toHaveLength(0);
    for (const coverage of Object.values(routine.player_join_coverage)) {
      expect(coverage).toMatchObject({ missing: 0 });
      expect(coverage.joined).toBe(coverage.source_events_with_actor);
    }
    expect(routine.opponent_attack_reference.leading_corner_takers[0])
      .toMatchObject({ display_name: "Ricardo Quaresma", count: 8 });
    expect(routine.opponent_attack_reference.leading_first_attacking_events[0])
      .toMatchObject({ display_name: "Raphaël Guerreiro", count: 6 });
    expect(routine.manager_defensive_reference.leading_first_defending_events[0])
      .toMatchObject({ display_name: "C. Sánchez", count: 3 });
    expect(routine.manager_defensive_reference.leading_first_defending_events_all_source_corners)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ display_name: "F. Muslera", count: 1 }),
      ]));
    expect(routine.claim_boundary.unsupported).toEqual(expect.arrayContaining([
      "marking assignment",
      "rehearsal effectiveness",
      "optimal matchup tactic",
    ]));
    for (const ledger of [
      routine.opponent_attack_reference,
      routine.manager_defensive_reference,
      routine.held_out_match,
    ]) {
      expect(Object.values(ledger.situation_counts).reduce((sum, count) => sum + count, 0))
        .toBe(ledger.classifiable_corners);
    }
    const publicRoutine = JSON.stringify(routine);
    for (const forbidden of [
      "preferred_foot", "birthDate", "birthArea", "passportArea", "height", "weight",
      "currentTeamId", "currentNationalTeamId", "\"role\"",
    ]) {
      expect(publicRoutine).not.toContain(forbidden);
    }
    expect(publicRoutine).not.toMatch(/\\u[0-9a-f]{4}/iu);
  });

  it("binds two manager-selected questions to both teams and deterministic counterevidence", () => {
    const board = report.team_scouting.corner_situation_rehearsal.matchup_question_board;
    expect(board).toMatchObject({
      status: "PASS",
      selection_contract: {
        priority_count: 2,
        no_default_priorities: true,
        held_out_match_hidden_until_lock: true,
      },
    });
    expect(board.questions).toHaveLength(5);
    expect(board.ontology.forbidden_edges).toEqual(expect.arrayContaining([
      "MARKED_BY",
      "WOULD_PREVENT",
      "CAUSED_SUCCESS",
      "OPTIMAL_TACTIC",
    ]));
    const short = board.questions.find((question) =>
      question.id === "short-attacking-first");
    expect(short).toMatchObject({
      recorded_situation: "short-recorded-endpoint",
      first_recorded_team_role: "attacking",
      opponent_attack: {
        corners: 7,
        attacking_shots_within_10_seconds: 1,
      },
      manager_defensive_exposure: {
        corners: 2,
        opponent_shots_within_10_seconds: 0,
      },
      held_out_evidence: {
        corners: 5,
        attacking_shots_within_10_seconds: 2,
      },
    });
    const aerialAttacking = board.questions.find((question) =>
      question.id === "aerial-attacking-first");
    expect(aerialAttacking).toMatchObject({
      opponent_attack: {
        corners: 1,
        attacking_shots_within_10_seconds: 1,
      },
      manager_defensive_exposure: {
        corners: 2,
        opponent_shots_within_10_seconds: 1,
      },
      held_out_evidence: {
        corners: 2,
        attacking_shots_within_10_seconds: 0,
      },
    });
    const aerialDefending = board.questions.find((question) =>
      question.id === "aerial-defending-first");
    expect(aerialDefending).toMatchObject({
      opponent_attack: { corners: 4, attacking_shots_within_10_seconds: 1 },
      manager_defensive_exposure: { corners: 0, opponent_shots_within_10_seconds: 0 },
      exposure_assessment: {
        status: "UNSEEN_IN_RECORDED_SAMPLE",
        thin: true,
        compatible_unclassified_manager_corners: 0,
      },
      held_out_evidence: { corners: 0, attacking_shots_within_10_seconds: 0 },
    });
    const otherDefending = board.questions.find((question) =>
      question.id === "other-defending-first");
    expect(otherDefending).toMatchObject({
      opponent_attack: { corners: 1, attacking_shots_within_10_seconds: 0 },
      manager_defensive_exposure: { corners: 1, opponent_shots_within_10_seconds: 0 },
      exposure_assessment: {
        status: "SEEN_IN_RECORDED_SAMPLE",
        thin: true,
        compatible_unclassified_manager_corners: 1,
      },
      held_out_evidence: { corners: 3, attacking_shots_within_10_seconds: 2 },
    });
    expect(otherDefending.held_out_evidence.event_receipts.filter((receipt) =>
      receipt.attacking_shot_within_10_seconds)).toHaveLength(2);
    for (const question of board.questions) {
      for (const ledger of [
        question.opponent_attack,
        question.manager_defensive_exposure,
        question.held_out_evidence,
      ]) {
        for (const receipt of ledger.event_receipts) {
          expect(["1H", "2H", "E1", "E2"]).toContain(receipt.period);
          expect(receipt.corner_second).toBeGreaterThanOrEqual(0);
        }
      }
    }
    expect(board.unclassified_manager_defensive_exposure).toEqual([
      expect.objectContaining({
        corner_event_id: 260303991,
        endpoint_validity: "placeholder-endpoint",
        first_recorded_team_role: "defending",
        first_recorded_event_subtype: "Goalkeeper leaving line",
        compatible_question_ids: ["other-defending-first"],
      }),
    ]);
  });
});
