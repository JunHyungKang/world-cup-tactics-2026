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
      { key: "finalSpec", value: input.finalSpec.replace("포르투갈전 코너킥 수비,", "조별리그에서 세우고,") },
      { key: "demoRecorder", value: input.demoRecorder.replace("corner-policy-lab-first-image.png", "corner-war-room-first-image.png") },
      { key: "editorialTreatment", value: { ...input.editorialTreatment, label: "[제품 화면]" } },
      { key: "interactionContract", value: input.interactionContract.replace("# Corner Policy Lab", "# Corner War Room") },
    ];
    for (const changed of cases) {
      expect(validateReleaseCoherence({ ...input, [changed.key]: changed.value }).length, changed.key).toBeGreaterThan(0);
    }
  });
});
