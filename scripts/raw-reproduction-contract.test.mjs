import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(await readFile("data/source-manifest.json", "utf8"));
const accepted = manifest.sources.filter(({ status }) => status === "accepted");
const artifacts = accepted.map(({ acceptance_evidence }) => acceptance_evidence.artifacts);

describe("public raw-reproduction evidence contract", () => {
  it("keeps exact raw reproduction outside the default public test discovery", async () => {
    const config = await readFile("vite.config.ts", "utf8");
    const rawConfig = await readFile("vite.raw.config.ts", "utf8");
    expect(config).toContain('exclude: ["scripts/derive-corner-scenarios.test.mjs"]');
    expect(rawConfig).toContain('include: ["scripts/derive-corner-scenarios.test.mjs"]');
  });

  it("binds both sources to the same immutable raw transform test bytes", async () => {
    const bytes = await readFile("scripts/derive-corner-scenarios.test.mjs");
    expect(artifacts.map(({ raw_transform_test }) => raw_transform_test)).toEqual([
      { path: "scripts/derive-corner-scenarios.test.mjs", sha256: sha256(bytes) },
      { path: "scripts/derive-corner-scenarios.test.mjs", sha256: sha256(bytes) },
    ]);
  });

  it("preserves two source-specific 7/7 raw-transform receipts", async () => {
    for (const source of accepted) {
      const receipt = JSON.parse(await readFile(source.acceptance_evidence.artifacts.raw_transform_receipt.path, "utf8"));
      expect(receipt).toMatchObject({ schema_version: 1, status: "PASS", source_id: source.id, result: "7/7 passed" });
      expect(receipt.test_argv).toEqual(["node_modules/vitest/vitest.mjs", "run", "scripts/derive-corner-scenarios.test.mjs"]);
    }
  });

  it("keeps raw and raw-free release receipts as separate artifacts", () => {
    for (const artifact of artifacts) {
      expect(artifact.raw_transform_receipt.path).not.toBe(artifact.release_test_receipt.path);
      expect(artifact.raw_transform_test.path).not.toBe(artifact.release_test.path);
    }
  });

  it("pins all four downloaded and extracted input hashes in the public derivative", async () => {
    const derived = JSON.parse(await readFile("public/data/corner-scenarios.json", "utf8"));
    expect(derived.provenance.input_sha256).toEqual({
      eventsZip: "877e015b716ffdeea18f04418e3f24fed307ed03c37ff305cabe1f47c4822a45",
      events: "d789b7cd80671a0dd1263150e997d1450e1ed22cddc8beb7bb2a6266b374a869",
      matchesZip: "c8f92bb7533e5c127e043cee764c991b5c25b4f5e70a65be931baae0b1765ce9",
      matches: "1ddab20c8605c063a62341eb846466c8d040885a5f0f9a3e26d023123786abb6",
    });
  });

  it("keeps ignored raw input paths explicit in the source manifest", () => {
    expect(accepted.map(({ local_path }) => local_path)).toEqual([
      "data/raw/pappalardo/events.zip and data/raw/pappalardo/events_World_Cup.json (gitignored)",
      "data/raw/pappalardo/matches.zip and data/raw/pappalardo/matches_World_Cup.json (gitignored)",
    ]);
  });

  it("fails the release invariant if any raw payload becomes Git-tracked", () => {
    const tracked = execFileSync("git", ["ls-files", "data/raw"], { encoding: "utf8" })
      .trim().split("\n").filter(Boolean).filter((path) => path !== "data/raw/.gitkeep");
    expect(tracked).toEqual([]);
  });
});
