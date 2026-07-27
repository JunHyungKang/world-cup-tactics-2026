import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateReleaseCoherence } from "./lib/release-coherence.mjs";

const paths = {
  selection: "docs/product-selection.json",
  packageJson: "package.json",
  candidateBuilder: "scripts/build-policy-lab.mjs",
  stampedBuilder: "scripts/build-release.mjs",
  invalidFixture: "scripts/serve-invalid-fixture.mjs",
  preReleaseRunner: "scripts/run-pre-release-browser.mjs",
  finalRunner: "scripts/run-final-browser.mjs",
  finalSpec: "tests/final-e2e/final-manager-loop.spec.ts",
  pagesWorkflow: ".github/workflows/deploy-pages.yml",
  demoRecorder: "scripts/record-demo-rehearsal.mjs",
  narrationRenderer: "scripts/render-demo-narration.mjs",
  editorialTreatment: "docs/demo-editorial-treatment.json",
  interactionContract: "docs/interaction-acceptance-contract.md",
  judgingMap: "docs/judging-map.md",
};
const input = {};
for (const [key, path] of Object.entries(paths)) {
  const text = await readFile(path, "utf8");
  input[key] = key === "selection" || key === "packageJson" || key === "editorialTreatment" ? JSON.parse(text) : text;
}

describe("selected-product release coherence", () => {
  it("binds every active release consumer to Corner Policy Lab", () => {
    expect(validateReleaseCoherence(input)).toEqual([]);
  });

  it("rejects predecessor build, browser, demo, and document surfaces", () => {
    const cases = [
      { key: "stampedBuilder", value: input.stampedBuilder.replace("await buildPolicyLabRelease", "await legacyViteBuild") },
      { key: "preReleaseRunner", value: input.preReleaseRunner.replace("build-policy-lab.mjs", "node_modules/vite/bin/vite.js") },
      { key: "invalidFixture", value: input.invalidFixture.replace("corner_situation_rehearsal", "matchup_challenger") },
      { key: "finalSpec", value: input.finalSpec.replace("포르투갈 코너 14개만", "포르투갈 코너 상황 3유형") },
      { key: "demoRecorder", value: input.demoRecorder.replace("포르투갈 코너 14개만", "포르투갈 코너 상황 3유형") },
      { key: "editorialTreatment", value: { ...input.editorialTreatment, label: "[제품 화면]" } },
      { key: "interactionContract", value: input.interactionContract.replace("# Corner Scout Lab", "# Corner War Room") },
      { key: "judgingMap", value: input.judgingMap.replace("Observable Corner Scout Lab proof", "Observable Corner Policy Lab proof") },
    ];
    for (const changed of cases) {
      expect(validateReleaseCoherence({ ...input, [changed.key]: changed.value }).length, changed.key).toBeGreaterThan(0);
    }
  });

  it("rejects the superseded 5/4/1 allocation loop on active release surfaces", () => {
    const cases = [
      { key: "finalSpec", suffix: "\nexpect(values).toHaveText([\"5\", \"4\", \"1\"]);\n" },
      { key: "demoRecorder", suffix: "\nconst legacy = \"훈련 10회를 결과 전에 잠그기\";\n" },
      { key: "interactionContract", suffix: "\n7/5/2 → 5/4/1 → 5/2/3\n" },
      { key: "judgingMap", suffix: "\n7/5/2 → 5/4/1 → 5/2/3\n" },
    ];
    for (const changed of cases) {
      const errors = validateReleaseCoherence({
        ...input,
        [changed.key]: `${input[changed.key]}${changed.suffix}`,
      });
      expect(errors.length, changed.key).toBeGreaterThan(0);
    }
  });

  it("binds the demo recorder to the canonical submission-story schema", () => {
    expect(input.demoRecorder).toContain("story.schema_version !== 3");
    expect(input.demoRecorder).toContain("canonical schema-3 Corner Scout Lab story");
    expect(input.demoRecorder).not.toContain("story.schema_version !== 4");
  });
});
