function requireText(errors, label, text, values) {
  for (const value of values) {
    if (!text.includes(value)) errors.push(`${label} is not bound to the selected product: ${value}`);
  }
}

function rejectText(errors, label, text, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(text)) errors.push(`${label} still contains predecessor behavior: ${pattern.source}`);
  }
}

export function validateReleaseCoherence({
  selection,
  packageJson,
  candidateBuilder,
  stampedBuilder,
  invalidFixture,
  preReleaseRunner,
  finalRunner,
  finalSpec,
  pagesWorkflow,
  demoRecorder,
  narrationRenderer,
  editorialTreatment,
  interactionContract,
  judgingMap,
}) {
  const errors = [];
  if (selection?.status !== "selected" || selection?.product_id !== "corner-policy-lab") {
    return ["release coherence requires selected product corner-policy-lab"];
  }

  const scripts = packageJson?.scripts ?? {};
  if (scripts.dev !== "node scripts/build-policy-lab.mjs && node scripts/serve-policy-release.mjs") {
    errors.push("package dev command does not serve the selected product");
  }
  if (scripts.build !== "tsc -b && node scripts/build-policy-lab.mjs --output dist") {
    errors.push("package build command does not build the selected product");
  }
  if (scripts["test:e2e"] !== "playwright test --config playwright.policy.release.config.ts") {
    errors.push("package browser command does not test the selected release");
  }
  if (scripts["test:e2e:pre-release"] !== "node scripts/run-pre-release-browser.mjs") {
    errors.push("package pre-release browser command does not run the BG matrix");
  }
  if (scripts["test:e2e:final"] !== "node scripts/run-final-browser.mjs") {
    errors.push("package final browser command is not the evidence runner");
  }

  requireText(errors, "candidate builder", candidateBuilder, [
    'from "./lib/policy-lab-release.mjs"', "buildPolicyLabRelease",
  ]);
  requireText(errors, "stamped builder", stampedBuilder, [
    'from "./lib/policy-lab-release.mjs"', "await buildPolicyLabRelease", 'releaseStatus: "stamped-final"',
  ]);
  rejectText(errors, "stamped builder", stampedBuilder, [
    /node_modules\/vite\/bin\/vite\.js/u,
  ]);
  requireText(errors, "invalid fixture", invalidFixture, [
    'from "./lib/policy-lab-release.mjs"', "corner_situation_rehearsal", 'status = "REVISE"',
  ]);
  requireText(errors, "pre-release runner", preReleaseRunner, [
    "build-policy-lab.mjs", "serve-policy-release.mjs", 'const baseUrl = "http://127.0.0.1:4173/"',
    '"--grep-invert", "BG-12 production marker binds the Policy Lab release and admitted data"',
  ]);
  rejectText(errors, "pre-release runner", preReleaseRunner, [
    /corner-war-room/iu, /node_modules\/vite\/bin\/vite\.js/u,
  ]);
  requireText(errors, "final runner", finalRunner, [
    "FINAL_EVIDENCE_SOURCE_PATHS", "playwright.final.config.ts",
  ]);
  requireText(errors, "final browser spec", finalSpec, [
    "포르투갈 코너 상황 3유형", "훈련 10회를 어떻게 나눌까요",
    "훈련 10회를 결과 전에 잠그기", "가려 둔 맞대결 첫 전개 보기",
    'manager_loop: "team-situation-rehearsal"', 'product_id: "corner-policy-lab"',
    'toHaveText(["5", "4", "1"])', 'toHaveText(["5", "2", "3"])',
    "meeting-note-receipt", "BG-15",
  ]);
  rejectText(errors, "final browser spec", finalSpec, [
    /Corner War Room/iu, /const headline\s*=\s*.*두 역할/iu,
    /이 선택을 확정하고 16경기 확인/iu, /선택 변경 0회/iu,
  ]);
  requireText(errors, "Pages workflow", pagesWorkflow, [
    'pnpm submission:build -- --release-commit "$GITHUB_SHA"', "path: ./dist",
  ]);
  rejectText(errors, "Pages workflow", pagesWorkflow, [/^\s+pnpm build\s*$/mu]);

  requireText(errors, "frozen-public demo recorder", demoRecorder, [
    "포르투갈 코너 상황 3유형", "훈련 10회를 결과 전에 잠그기",
    "가려 둔 맞대결 첫 전개 보기", "다음 회의 메모 저장",
    '[data-routine-card="short-recorded-endpoint"]', "short-add-5",
    "meeting-note-receipt", "docs/demo-editorial-treatment.json",
  ]);
  rejectText(errors, "frozen-public demo recorder", demoRecorder, [
    /corner-war-room/iu, /두 역할/iu, /이 선택을 확정하고 16경기 확인/iu,
  ]);
  requireText(errors, "narration renderer", narrationRenderer, [
    "docs/policy-lab-demo-narration.json", "docs/policy-lab-demo-captions.ko.srt",
    "docs/demo-editorial-treatment.json",
  ]);
  rejectText(errors, "narration renderer", narrationRenderer, [/corner-war-room/iu]);
  if (editorialTreatment?.status !== "editorial-overlay-not-product-ui-or-human-evidence") {
    errors.push("editorial treatment must remain explicitly separate from product UI and human evidence");
  }
  const expectedEditorialChapters = [
    ["hook", 0],
    ["evidence", 6],
    ["allocate", 15],
    ["lock", 25],
    ["reveal", 31],
    ["receipts", 42],
    ["memo", 50],
    ["final", 57],
  ];
  const actualEditorialChapters = editorialTreatment?.chapters?.map(
    ({ id, scheduled_seconds }) => [id, scheduled_seconds],
  );
  if (editorialTreatment?.schema_version !== 2 ||
      editorialTreatment?.label !== "[편집 요약]" ||
      JSON.stringify(actualEditorialChapters) !== JSON.stringify(expectedEditorialChapters)) {
    errors.push("editorial treatment disclosure or chapter contract drifted");
  }
  if (editorialTreatment?.claim_boundary?.result_prediction !== false ||
      editorialTreatment?.claim_boundary?.causal_effect !== false ||
      editorialTreatment?.claim_boundary?.product_ui !== false) {
    errors.push("editorial treatment claim boundary drifted");
  }

  requireText(errors, "interaction contract", interactionContract, [
    "# Corner Prep Lab Interaction Acceptance Contract", "BG-01", "BG-15",
    "14/14", "5/6", "7/5/2", "5/4/1", "5/2/3", "0/-2/+2",
    "다음 회의 메모 저장", "team_scouting.corner_situation_rehearsal",
  ]);
  rejectText(errors, "interaction contract", interactionContract, [
    /^# Corner War Room/mu, /^# Corner Policy Lab/mu,
    /두 역할을 어디에 둘까요/iu, /48–8–8/u, /선택 변경 0회/iu,
    /vite\.invalid-artifact\.config\.ts/u,
  ]);
  requireText(errors, "judging map", judgingMap, [
    "Observable Corner Prep Lab proof", "7/5/2 → 5/4/1 → 5/2/3",
    "precommit", "next-meeting memo",
  ]);
  rejectText(errors, "judging map", judgingMap, [
    /Observable Corner War Room proof/u, /Observable Corner Policy Lab proof/u,
    /defensive leader/iu, /outlet role/iu,
  ]);
  return errors;
}
