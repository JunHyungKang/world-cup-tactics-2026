import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateCurrentHarnessState } from "./lib/harness-state.mjs";

const [stateText, selectionText, manifestText, board, officialState, judgingMap, judgeGate, readme, handoff, runbook,
  productThesis, interactionContract, researchUxReview, decisionRegistry, firstPlaceGoal,
  cornerTransformContract, syntheticPersonaReview, firstPlaceRetrospective] = await Promise.all([
  readFile("docs/data-scope-resolution.json", "utf8"),
  readFile("docs/product-selection.json", "utf8"),
  readFile("data/source-manifest.json", "utf8"),
  readFile("docs/portfolio-priority-snapshot.md", "utf8"),
  readFile("docs/official-state.md", "utf8"),
  readFile("docs/judging-map.md", "utf8"),
  readFile("docs/judge-differentiation-gate.md", "utf8"),
  readFile("README.md", "utf8"),
  readFile("docs/session-handoff.md", "utf8"),
  readFile("docs/post-p0-execution-runbook.md", "utf8"),
  readFile("docs/product-thesis.md", "utf8"),
  readFile("docs/interaction-acceptance-contract.md", "utf8"),
  readFile("docs/research-ux-review-2026-07-18.md", "utf8"),
  readFile("docs/decision-registry.md", "utf8"),
  readFile("docs/first-place-goal.md", "utf8"),
  readFile("docs/corner-transform-contract.md", "utf8"),
  readFile("docs/synthetic-persona-review-2026-07-18.md", "utf8"),
  readFile("docs/retrospective-first-place-goal.md", "utf8"),
]);
const input = {
  state: JSON.parse(stateText), selection: JSON.parse(selectionText), manifest: JSON.parse(manifestText),
  board, officialState, judgingMap, judgeGate, readme, handoff, runbook,
  productThesis, interactionContract, researchUxReview, decisionRegistry,
  firstPlaceGoal, cornerTransformContract, syntheticPersonaReview, firstPlaceRetrospective,
};

describe("current harness state drift", () => {
  it("accepts the canonical current-state surfaces while ignoring historical logs", () => {
    expect(validateCurrentHarnessState(input)).toEqual([]);
    expect(handoff).toContain("## 2026-07-17 — Initial P1 harness");
    expect(handoff).toContain("zero accepted sources");
    expect(runbook).toContain("| 7 | unavailable / no claim |");
    expect(runbook).toContain("| 8A | pending account gate |");
    expect(runbook).toContain("| 8B | complete exact document gate |");
  });

  it("rejects stale active claims in each authoritative surface", () => {
    const cases = [
      { key: "board", value: board.replace("Corner Policy Lab is the canonical root product", "CWR remains the root/submission package") },
      { key: "judgeGate", value: judgeGate.replace("Corner Policy Lab technical product proof passed", "implementation unauthorized") },
      { key: "readme", value: readme.replace("The app is **Corner Policy Lab**", "The app is **Corner War Room**") },
      { key: "handoff", value: handoff.replace("selected `corner-policy-lab`", "official product remains `corner-war-room`") },
      { key: "runbook", value: runbook.replace("PASS — LOCAL FREEZE", "portfolio P0 freeze boundary is `PENDING`") },
      { key: "runbook", value: runbook.replace("| 8B | complete exact document gate |", "| 8B | human reviewer assumed complete |") },
      { key: "productThesis", value: productThesis.replace("Product selection ID: `corner-policy-lab`", "Product selection ID: `corner-war-room`") },
      { key: "decisionRegistry", value: decisionRegistry.replace("| D48 |", "| D48-stale |") },
    ];
    for (const changed of cases) {
      const errors = validateCurrentHarnessState({ ...input, [changed.key]: changed.value });
      expect(errors.length, changed.key).toBeGreaterThan(0);
    }
  });

  it("rejects selected sources that drift from accepted canonical evidence", () => {
    const selection = { ...input.selection, source_ids: [...input.selection.source_ids, "not-admitted"] };
    const errors = validateCurrentHarnessState({ ...input, selection });
    expect(errors).toContain("selected source is not accepted in manifest: not-admitted");
    expect(errors).toContain("selected source IDs drift from eligibility evidence source IDs");
  });

  it("rejects a stale or incomplete official judging contract", () => {
    const judgingMap = input.judgingMap.replace("참신성 | 30", "참신성 | TBD");
    const errors = validateCurrentHarnessState({ ...input, judgingMap });
    expect(errors).toContain("current judging map missing current-state marker: 참신성 | 30");

    const staleGate = input.judgeGate.replace(
      "The first-round funnel remains",
      "No official scoring weights have been published. The first-round funnel remains",
    );
    expect(validateCurrentHarnessState({ ...input, judgeGate: staleGate })).toContain(
      "judge differentiation gate contains stale current-state marker: No official scoring weights have been published",
    );
  });
});
