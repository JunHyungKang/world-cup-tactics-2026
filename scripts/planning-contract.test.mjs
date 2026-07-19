import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validatePlanningContract } from "./lib/planning-contract.mjs";

const [source, officialState, manifestText] = await Promise.all([
  readFile("docs/planning-outline.md", "utf8"),
  readFile("docs/official-state.md", "utf8"),
  readFile("data/source-manifest.json", "utf8"),
]);
const manifest = JSON.parse(manifestText);
const verifiedAt = new Date(officialState.match(/^Verified:\s*`([^`]+)`\s+against:/mu)?.[1]);
const validate = (overrides = {}) => validatePlanningContract({
  source, officialState, manifest, now: new Date(verifiedAt.getTime() + 60 * 60 * 1000), ...overrides,
});

describe("current planning PDF source contract", () => {
  it("maps eight current pages to official funnel, rubric, and honest evidence", () => expect(validate()).toEqual([]));

  it("rejects a required marker moved outside its page", () => {
    const changed = source.replace("397/436", "group-stage classified fraction")
      + "\nAppendix: 397/436.\n";
    expect(validate({ source: changed })).toContain("page 4 missing scoped marker: 397/436");
  });

  it("rejects stale pre-implementation evidence states", () => {
    for (const stale of ["DATA AUDIT PENDING", "implementation pending", "42-window transform/full audit pending", "Touchline Lab"]) {
      expect(validate({ source: `${source}\n${stale}\n` }).some((error) => error.startsWith("planning source contains stale state")), stale).toBe(true);
    }
  });

  it("rejects missing official weights and stale official capture", () => {
    expect(validate({ officialState: officialState.replace("Second-round internal judging is originality 30", "Second-round judging TBD") }))
      .toContain("official state missing planning contract marker: Second-round internal judging is originality 30");
    expect(validate({ now: new Date(verifiedAt.getTime() + 25 * 60 * 60 * 1000) }).some((error) => error.startsWith("official state verification is stale"))).toBe(true);
  });

  it("rejects accepted-source drift and fabricated human preference", () => {
    const changedManifest = { ...manifest, sources: manifest.sources.map((record) => record.id.includes("events") ? { ...record, status: "pending" } : record) };
    expect(validate({ manifest: changedManifest })).toContain("planning candidate requires the two selected accepted Figshare sources");
    expect(validate({ source: `${source}\nUsers prefer and found intuitive this interface.\n` }))
      .toContain("planning candidate contains an unsupported human preference/usability claim");
  });
});
