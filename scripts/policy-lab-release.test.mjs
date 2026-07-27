import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPolicyLabRelease } from "./lib/policy-lab-release.mjs";

let directory;
let result;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "policy-lab-release-"));
  result = await buildPolicyLabRelease({ outputRoot: join(directory, "dist") });
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("Policy Lab static candidate release", () => {
  it("binds a keyless root entrypoint and the exact empirical report", async () => {
    expect(result.manifest).toMatchObject({
      product_id: "corner-policy-lab",
      release_status: "candidate-public",
      product_selection_status: "PASS",
      implementation_refinement_status: "PASS",
      manager_loop: "matchup-question-lock",
      causal_recommendation_status: "REJECT",
      empirical_campaign_status: "REVISE",
      entrypoint: "index.html",
    });
    expect(result.manifest.admitted_source_manifest).toMatchObject({
      path: "data/source-manifest.json",
      source_ids: [
        "pappalardo-wyscout-events-wc-2018",
        "pappalardo-wyscout-matches-wc-2018",
        "pappalardo-wyscout-players",
      ],
    });
    expect(result.manifest.files).toHaveLength(4);
    const html = await readFile(join(result.outputRoot, "index.html"), "utf8");
    expect(html).toContain('content="./data/policy-lab-spike.json"');
    expect(html).not.toMatch(/https?:\/\//u);
    const report = JSON.parse(await readFile(join(result.outputRoot, "data/policy-lab-spike.json"), "utf8"));
    expect(report.status).toBe("REJECT");
    expect(report.policy_campaign).toMatchObject({ product_status: "PASS", empirical_campaign_status: "REVISE", causal_recommendation_status: "REJECT" });
    expect(report.team_scouting.corner_situation_rehearsal).toMatchObject({
      status: "PASS",
      opponent_attack_reference: {
        team_name: "Portugal",
        source_corners: 14,
        situation_counts: {
          "short-recorded-endpoint": 7,
          "aerial-recorded-follow-up": 5,
          "other-recorded-follow-up": 2,
        },
      },
      manager_defensive_reference: { team_name: "Uruguay", source_corners: 6, classifiable_corners: 5 },
      held_out_match: {
        match_name: "Uruguay - Portugal",
        situation_counts: {
          "short-recorded-endpoint": 5,
          "aerial-recorded-follow-up": 2,
          "other-recorded-follow-up": 3,
        },
      },
      matchup_question_board: {
        status: "PASS",
        selection_contract: {
          priority_count: 2,
          no_default_priorities: true,
          held_out_match_hidden_until_lock: true,
        },
      },
    });
    expect(report.team_scouting.corner_situation_rehearsal.matchup_question_board.questions)
      .toHaveLength(5);
  });

  it("records the exact bytes and hashes of every deployable file", async () => {
    for (const file of result.manifest.files) {
      const bytes = await readFile(join(result.outputRoot, file.path));
      expect(bytes.length).toBe(file.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
    }
    expect(Object.keys(result.manifest.source_binding)).toHaveLength(4);
  });
});
