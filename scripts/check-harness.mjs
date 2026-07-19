import { access, readFile } from "node:fs/promises";
import { validateCurrentHarnessState } from "./lib/harness-state.mjs";

const requiredFiles = [
  "AGENTS.md",
  "docs/competition-brief.md",
  "docs/portfolio-priority-snapshot.md",
  "docs/product-thesis.md",
  "docs/first-place-goal.md",
  "docs/judge-differentiation-gate.md",
  "docs/research-ux-review-2026-07-18.md",
  "docs/interaction-acceptance-contract.md",
  "docs/corner-transform-contract.md",
  "docs/post-p0-execution-runbook.md",
  "docs/decision-registry.md",
  "docs/planning-outline.md",
  "docs/data-scope-resolution.json",
  "docs/product-selection.json",
  "docs/data-scope-eligibility-contract.md",
  "docs/retrospective-eligibility-gate.md",
  "docs/retrospective-plan-visual-ledger.md",
  "docs/retrospective-question-state.md",
  "docs/submission-ledger.md",
  "docs/final-submission-contract.md",
  "docs/static-deployment-contract.md",
  "docs/submission-story.json",
  "docs/demo-script.md",
  "docs/demo-rehearsal-contract.md",
  "docs/demo-narration.json",
  "docs/demo-captions.ko.srt",
  "docs/assets/demo-storyboard/manifest.json",
  "docs/assets/gallery/manifest.json",
  "docs/five-user-comprehension-protocol.md",
  "requirements-verify.txt",
  "data/source-manifest.json",
  "src/domain/tactics.ts",
  "tests/e2e/manager-loop.spec.ts",
  "scripts/check-planning-contract.mjs",
  "scripts/check-eligibility.mjs",
  "scripts/record-organizer-question.mjs",
  "scripts/record-organizer-question.test.mjs",
  "scripts/lib/eligibility.mjs",
  "scripts/eligibility.test.mjs",
  "scripts/inspect-planning-pdf.py",
  "scripts/lib/planning-contract.mjs",
  "scripts/lib/planning-pdf.mjs",
  "scripts/lib/plan-review.mjs",
  "scripts/lib/plan-owner-handoff.mjs",
  "scripts/lib/final-submission.mjs",
  "scripts/lib/cli.mjs",
  "scripts/build-release.mjs",
  "scripts/drill-release-build.mjs",
  "scripts/release-artifact.test.mjs",
  "scripts/raw-reproduction-contract.test.mjs",
  "scripts/check-static-deployment.mjs",
  "playwright.final.config.ts",
  "scripts/run-final-browser.mjs",
  "scripts/run-pre-release-browser.mjs",
  "scripts/lib/harness-state.mjs",
  "scripts/harness-state.test.mjs",
  "tests/final-e2e/final-manager-loop.spec.ts",
  "vite.invalid-artifact.config.ts",
  "vite.raw.config.ts",
  "scripts/serve-invalid-fixture.mjs",
  "tests/fixtures/invalid-corner-scenarios.json",
  "scripts/render-planning-draft.py",
  "scripts/capture-planning-screenshots.mjs",
  "scripts/render-planning-draft.mjs",
  "scripts/check-planning-draft.mjs",
  "scripts/prepare-plan-review.mjs",
  "scripts/prepare-plan-owner-handoff.mjs",
  "scripts/check-submission-story.mjs",
  "scripts/lib/submission-story.mjs",
  "scripts/submission-story.test.mjs",
  "scripts/capture-demo-storyboard.mjs",
  "scripts/render-gallery-first-image.mjs",
  "scripts/record-demo-rehearsal.mjs",
  "scripts/check-demo-rehearsal.mjs",
  "scripts/render-demo-narration.mjs",
  "scripts/check-demo-narration.mjs",
  "scripts/planning-draft.test.mjs",
  "scripts/check-user-study.mjs",
  ".agents/skills/korean-copy-qa/scripts/audit-copy.mjs",
  "scripts/lib/user-study.mjs",
  "scripts/user-study.test.mjs",
  "evidence/user-studies/primary-wave-1.json",
  "docs/retrospective-first-place-goal.md",
  "docs/synthetic-persona-review-2026-07-18.md",
];
const requiredSkills = [
  "orchestration",
  "product-gate",
  "data-audit",
  "browser-acceptance",
  "submission",
  "retrospective",
  "session-handoff",
  "korean-copy-qa",
];
const errors = [];

for (const path of requiredFiles) {
  try { await access(path); } catch { errors.push(`missing ${path}`); }
}

for (const name of requiredSkills) {
  const path = `.agents/skills/${name}/SKILL.md`;
  try {
    const text = await readFile(path, "utf8");
    if (!text.startsWith("---\n") || !text.includes(`name: ${name}\n`) || !text.includes("description:")) {
      errors.push(`invalid skill frontmatter: ${path}`);
    }
  } catch {
    errors.push(`missing ${path}`);
  }
}

try {
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
  errors.push(...validateCurrentHarnessState({
    state: JSON.parse(stateText), selection: JSON.parse(selectionText), manifest: JSON.parse(manifestText),
    board, officialState, judgingMap, judgeGate, readme, handoff, runbook,
    productThesis, interactionContract, researchUxReview, decisionRegistry, firstPlaceGoal,
    cornerTransformContract, syntheticPersonaReview, firstPlaceRetrospective,
  }));
} catch (error) {
  errors.push(`current harness state could not be validated: ${error.message}`);
}

if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}
console.log(`[PASS] harness: ${requiredFiles.length} surfaces and ${requiredSkills.length} skills`);
