import { describe, expect, it } from "vitest";
import { evaluatePrototypeTactic } from "./tactics";

describe("evaluatePrototypeTactic", () => {
  it("raises transition risk when press intensity rises", () => {
    const low = evaluatePrototypeTactic({ formation: "4-3-3", press: 20, width: 50 });
    const high = evaluatePrototypeTactic({ formation: "4-3-3", press: 90, width: 50 });

    expect(high.transitionRisk).toBeGreaterThan(low.transitionRisk);
  });

  it("keeps every displayed score within a percentage scale", () => {
    const result = evaluatePrototypeTactic({ formation: "3-4-3", press: 100, width: 0 });

    expect(result.control).toBeGreaterThanOrEqual(0);
    expect(result.control).toBeLessThanOrEqual(100);
    expect(result.transitionRisk).toBeGreaterThanOrEqual(0);
    expect(result.transitionRisk).toBeLessThanOrEqual(100);
  });
});
