import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validatePlanningContract } from "./lib/planning-contract.mjs";

const [source, officialState, manifestText] = await Promise.all([
  readFile("docs/planning-outline.md", "utf8"),
  readFile("docs/official-state.md", "utf8"),
  readFile("data/source-manifest.json", "utf8"),
]);
const manifest = JSON.parse(manifestText);
const historicalOfficialState = officialState.replace(
  /^Verified:\s*`[^`]+`\s+against:/mu,
  "Verified: `2026-07-27T08:00:00+09:00` against:",
);
const verifiedAt = new Date("2026-07-27T08:00:00+09:00");
const validate = (overrides = {}) => validatePlanningContract({
  source, officialState: historicalOfficialState, manifest,
  now: new Date(verifiedAt.getTime() + 60 * 60 * 1000), ...overrides,
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
    expect(validate({ officialState: historicalOfficialState.replace("Second-round internal judging is originality 30", "Second-round judging TBD") }))
      .toContain("official state missing planning contract marker: Second-round internal judging is originality 30");
    expect(validate({ now: new Date(verifiedAt.getTime() + 25 * 60 * 60 * 1000) }).some((error) => error.startsWith("official state verification is stale"))).toBe(true);
  });

  it("accepts the immutable post-deadline state only with verified submission evidence", () => {
    const afterDeadline = new Date("2026-07-27T10:00:01+09:00");
    expect(validate({ now: afterDeadline })).toContain("planning deadline has passed while candidate is not submitted");
    expect(validate({ now: afterDeadline, planningSubmitted: true })).toEqual([]);
  });

  it("rejects accepted-source drift and fabricated human preference", () => {
    const changedManifest = { ...manifest, sources: manifest.sources.map((record) => record.id.includes("events") ? { ...record, status: "pending" } : record) };
    expect(validate({ manifest: changedManifest })).toContain("planning candidate requires the two selected accepted Figshare sources");
    expect(validate({ source: `${source}\nUsers prefer and found intuitive this interface.\n` }))
      .toContain("planning candidate contains an unsupported human preference/usability claim");
  });
});
