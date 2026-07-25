import { readFile } from "node:fs/promises";
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
  interactionContract: "docs/interaction-acceptance-contract.md",
  judgingMap: "docs/judging-map.md",
};

const input = {};
for (const [key, path] of Object.entries(paths)) {
  const text = await readFile(path, "utf8");
  input[key] = key === "selection" || key === "packageJson" ? JSON.parse(text) : text;
}
const errors = validateReleaseCoherence(input);
if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}
console.log("[PASS] release coherence: one selected product across build, browser, deploy, demo, and current documents");
