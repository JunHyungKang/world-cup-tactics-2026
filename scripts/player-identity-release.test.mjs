import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const paths = {
  derived: "public/data/policy-lab-spike.json",
  semanticReview: "data/audit/player-identity-semantic-review.json",
  joinReview: "data/audit/player-join-review.csv",
  audit: "evidence/pappalardo-wyscout-players/audit.json",
  memo: "data/audit/player-identity-rights-review.md",
};
const entries = await Promise.all(Object.entries(paths)
  .map(async ([key, path]) => [key, await readFile(path)]));
const bytes = Object.fromEntries(entries);
const report = JSON.parse(bytes.derived);
const review = JSON.parse(bytes.semanticReview);
const audit = JSON.parse(bytes.audit);
const rehearsal = report.team_scouting.corner_situation_rehearsal;

function collectIdentityRecords(value, records = []) {
  if (!value || typeof value !== "object") return records;
  if (!Array.isArray(value) && "player_id" in value && "display_name" in value) records.push(value);
  for (const child of Object.values(value)) collectIdentityRecords(child, records);
  return records;
}

function collectObjectKeys(value, keys = new Set()) {
  if (!value || typeof value !== "object") return keys;
  if (!Array.isArray(value)) for (const key of Object.keys(value)) keys.add(key);
  for (const child of Object.values(value)) collectObjectKeys(child, keys);
  return keys;
}

function allReceipts() {
  return [
    rehearsal.opponent_attack_reference,
    rehearsal.manager_defensive_reference,
    rehearsal.held_out_match,
  ].flatMap((ledger) => ledger.situation_cards.flatMap((card) => card.event_receipts));
}

describe("Players source clean-release evidence", () => {
  it("pins the Players input and exact three-source lineage without reading ignored raw", () => {
    expect(report.provenance.source_ids).toEqual([
      "pappalardo-wyscout-events-wc-2018",
      "pappalardo-wyscout-matches-wc-2018",
      "pappalardo-wyscout-players",
    ]);
    expect(report.provenance.input_sha256.players)
      .toBe("877a111cb1005b73df5645e9338bd74fb4b496bace2fbc545a72abb3b73efa2e");
    expect(report.transform_version)
      .toBe("policy-lab-spike-v12-team-comparison-support");
    expect(rehearsal.status).toBe("PASS");
  });

  it("admits only the minimal factual identity fields", () => {
    const identities = collectIdentityRecords(rehearsal);
    expect(identities).toHaveLength(250);
    expect(new Set(identities.map(({ player_id: id }) => id)).size).toBe(41);
    for (const identity of identities) {
      expect(Object.keys(identity).sort()).toEqual(
        identity.count === undefined
          ? ["display_name", "player_id"]
          : ["count", "display_name", "player_id"],
      );
      expect(Number.isInteger(identity.player_id)).toBe(true);
      expect(identity.display_name).toBe(identity.display_name.normalize("NFC").trim());
      expect(identity.display_name).not.toMatch(/\\u[0-9a-f]{4}/iu);
    }
    const emittedKeys = collectObjectKeys(rehearsal);
    for (const forbidden of review.forbidden_source_fields) expect(emittedKeys.has(forbidden)).toBe(false);
  });

  it("binds all 12 fixed-example actor ledgers and no missing join", () => {
    expect(Object.keys(rehearsal.player_join_coverage)).toHaveLength(12);
    for (const coverage of Object.values(rehearsal.player_join_coverage)) {
      expect(coverage.missing).toBe(0);
      expect(coverage.joined).toBe(coverage.source_events_with_actor);
    }
    const rows = bytes.joinReview.toString("utf8").trim().split("\n");
    expect(rows).toHaveLength(13);
    expect(rows.slice(1).every((row) => /,0,pass,pass,/u.test(row))).toBe(true);
  });

  it("preserves a complete source-event receipt for every classifiable situation", () => {
    const receipts = allReceipts();
    expect(receipts).toHaveLength(29);
    for (const receipt of receipts) {
      expect(Number.isInteger(receipt.corner_event_id)).toBe(true);
      expect(receipt.corner_taker).toMatchObject({ player_id: expect.any(Number), display_name: expect.any(String) });
      expect(receipt.first_recorded_follow_up).toMatchObject({
        source_event_id: expect.any(Number),
        offset_us: expect.any(Number),
        actor: { player_id: expect.any(Number), display_name: expect.any(String) },
        team_role: expect.stringMatching(/^(attacking|defending)$/u),
        event_name: expect.any(String),
        sub_event_name: expect.any(String),
        selection_rule: "earliest event after the corner within the fixed inclusive 10-second window",
        join_status: "joined",
      });
    }
  });

  it("corroborates Rui Patrício without converting the event actor into a contact claim", () => {
    const receipt = allReceipts().find(({ corner_event_id: id }) => id === 261096233);
    expect(receipt).toMatchObject({
      match_id: 2058002,
      match_name: "Uruguay - Portugal",
      corner_taker: { player_id: 32599, display_name: "Manuel Fernandes" },
      first_recorded_follow_up: {
        source_event_id: 261096236,
        offset_us: 2582212,
        actor: { player_id: 70134, display_name: "Rui Patrício" },
        team_role: "attacking",
        event_name: "Duel",
        sub_event_name: "Air duel",
        join_status: "joined",
      },
    });
    expect(review.exact_corroboration).toMatchObject({
      corner_event_id: 261096233,
      first_recorded_follow_up: {
        source_event_id: 261096236,
        actor: { player_id: 70134, display_name: "Rui Patrício" },
      },
    });
    expect(review.exact_corroboration.semantic_conclusion)
      .toMatch(/does not establish who first touched or received the ball/iu);
  });

  it("binds the repeated same-receipt connection and three-axis comparison support", () => {
    expect(rehearsal.matchup_question_board.repeated_player_connections).toEqual([
      expect.objectContaining({
        corner_taker: { player_id: 32597, display_name: "Ricardo Quaresma" },
        first_recorded_follow_up_actor: {
          player_id: 28907,
          display_name: "Raphaël Guerreiro",
        },
        corners: 3,
        matches: 2,
        match_ids: [2057960, 2057964],
        corner_event_ids: [258702651, 258702667, 260341439],
      }),
    ]);
    expect(Object.fromEntries(rehearsal.matchup_question_board.questions.map(
      ({ id, comparison_support: support }) => [
        id,
        { direct: support.direct, adjacent: support.adjacent },
      ],
    ))).toEqual({
      "short-attacking-first": { direct: 2, adjacent: 0 },
      "aerial-attacking-first": { direct: 0, adjacent: 2 },
      "aerial-defending-first": { direct: 0, adjacent: 2 },
      "other-attacking-first": { direct: 0, adjacent: 1 },
      "other-defending-first": { direct: 1, adjacent: 0 },
    });
    expect(review.repeated_player_connection_review.claim_boundary)
      .toMatch(/does not establish a receiver, first contact, possession continuation, rehearsed routine, or tactical effect/iu);
    expect(review.localized_aliases).toEqual({
      "Ricardo Quaresma": "콰레스마",
      "Raphaël Guerreiro": "게헤이루",
      "C. Sánchez": "C. 산체스",
    });
  });

  it("binds the independent PASS, review hashes, and no-endorsement boundary", () => {
    expect(review).toMatchObject({
      schema_version: 1,
      status: "PASS",
      source_id: "pappalardo-wyscout-players",
      reviewer: "team_tactics_data_audit",
      source_time_reviewer: "football_claim_audit",
      transform_version: "policy-lab-spike-v12-team-comparison-support",
      public_json_sha256: sha256(bytes.derived),
      receipt_time_review: {
        receipts_reviewed: 29,
        source_time_mismatches: 0,
        ui_match_time_mapping: "PASS",
      },
      final_result: {
        join_ledger_pass: 12,
        identity_scope_pass: 250,
        unique_player_ids: 41,
        matchup_signature_receipts: 29,
        exact_receipt_pass: 1,
        uncertain: 0,
        fail: 0,
      },
    });
    expect(audit).toMatchObject({
      schema_version: 1,
      status: "PASS",
      source_id: "pappalardo-wyscout-players",
      reviewer: "team_tactics_data_audit",
      transform_version: "policy-lab-spike-v12-team-comparison-support",
      source_time_review: {
        reviewer: "football_claim_audit",
        status: "PASS",
        receipts_reviewed: 29,
        source_time_mismatches: 0,
      },
      public_json_sha256: sha256(bytes.derived),
      semantic_review: { path: paths.semanticReview, sha256: sha256(bytes.semanticReview) },
      window_review: { path: paths.joinReview, sha256: sha256(bytes.joinReview) },
    });
    const memo = bytes.memo.toString("utf8");
    expect(memo).toContain("Status: `PASS");
    expect(memo).toContain("first recorded follow-up");
    expect(memo).toMatch(/do not\s+endorse/iu);
  });
});
