import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { auditCsv } from "./lib/corner-transform.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

describe("clean public release artifact", () => {
  it("binds the audited derivative and human review records to pinned raw provenance without reading ignored raw", async () => {
    const paths = {
      derived: "public/data/corner-scenarios.json",
      auditCsv: "data/audit/brazil-corner-window-review.csv",
      semanticReview: "data/audit/brazil-corner-semantic-review.json",
      productBinding: "public/data/product-binding.json",
      selection: "docs/product-selection.json",
      eventsAudit: "evidence/pappalardo-wyscout-events-wc-2018/audit.json",
      matchesAudit: "evidence/pappalardo-wyscout-matches-wc-2018/audit.json",
    };
    const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path)]));
    const bytes = Object.fromEntries(entries);
    const derived = JSON.parse(bytes.derived);
    const audit = bytes.auditCsv.toString("utf8");
    const semanticReview = JSON.parse(bytes.semanticReview);
    const productBinding = JSON.parse(bytes.productBinding);
    const selection = JSON.parse(bytes.selection);
    const sourceAudits = [JSON.parse(bytes.eventsAudit), JSON.parse(bytes.matchesAudit)];
    const sourceIds = ["pappalardo-wyscout-events-wc-2018", "pappalardo-wyscout-matches-wc-2018"];

    expect(derived.provenance.source_ids).toEqual(sourceIds);
    expect(derived.provenance.input_sha256).toEqual({
      eventsZip: "877e015b716ffdeea18f04418e3f24fed307ed03c37ff305cabe1f47c4822a45",
      events: "d789b7cd80671a0dd1263150e997d1450e1ed22cddc8beb7bb2a6266b374a869",
      matchesZip: "c8f92bb7533e5c127e043cee764c991b5c25b4f5e70a65be931baae0b1765ce9",
      matches: "1ddab20c8605c063a62341eb846466c8d040885a5f0f9a3e26d023123786abb6",
    });
    expect(derived.summary).toMatchObject({ windows: 42, shot_windows: 11, goal_tagged_shot_windows: 1, defending_outlet_contact_windows: 10 });
    expect(derived.summary.delivery_endpoint_windows).toEqual({ "check-short": 14, "near-post-side": 17, "central-to-far": 10, other: 1 });
    expect(derived.windows).toHaveLength(42);
    expect(new Set(derived.windows.map(({ corner_event_id: id }) => id)).size).toBe(42);
    for (const window of derived.windows) {
      expect(window.event_ids[0]).toBe(window.corner_event_id);
      expect(window.primitives.every((primitive) => primitive.event_name !== "Shot" || primitive.visual === "shot-marker")).toBe(true);
      expect(window.primitives.every((primitive) => primitive.normalized_positions.every((point) =>
        Number.isFinite(point.x) && point.x >= 0 && point.x <= 100 && Number.isFinite(point.y) && point.y >= 0 && point.y <= 100))).toBe(true);
    }
    expect(audit).toBe(auditCsv(derived.windows, semanticReview));
    expect(audit.trim().split("\n")).toHaveLength(43);
    expect(audit.match(/,pass,pass,/gu)).toHaveLength(42);
    expect(semanticReview).toMatchObject({
      schema_version: 1,
      status: "PASS",
      reviewer: "eligibility_escape_audit",
      public_json_sha256: sha256(bytes.derived),
      final_result: { structural_pass: 42, semantic_pass: 42, uncertain: 0, fail: 0 },
    });
    expect(semanticReview.structural_pass_ids).toHaveLength(42);
    expect(semanticReview.semantic_pass_ids).toEqual(semanticReview.structural_pass_ids);
    expect(new Set(semanticReview.structural_pass_ids)).toEqual(new Set(derived.windows.map(({ corner_event_id }) => corner_event_id)));
    for (const sourceAudit of sourceAudits) {
      expect(sourceAudit).toMatchObject({
        schema_version: 1,
        status: "PASS",
        reviewer: "eligibility_escape_audit",
        public_json_sha256: sha256(bytes.derived),
        final_result: { structural_pass: 42, semantic_pass: 42, uncertain: 0, fail: 0 },
        semantic_review: { path: paths.semanticReview, sha256: sha256(bytes.semanticReview) },
        window_review: { path: paths.auditCsv, sha256: sha256(bytes.auditCsv) },
      });
      expect(sourceIds).toContain(sourceAudit.source_id);
    }
    expect(productBinding.source_ids).toEqual(sourceIds);
    expect(productBinding.core_tactical_source_ids).toEqual(selection.core_tactical_source_ids);
    expect(productBinding.data_files).toEqual(selection.data_files);
    expect(derived.limitations.join("\n")).toMatch(/straight-line rendering assumptions/iu);
  });
});
