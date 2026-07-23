function lineContaining(text, marker) {
  return text.split("\n").find((line) => line.includes(marker)) ?? "";
}

function section(text, heading) {
  const start = text.indexOf(heading);
  if (start < 0) return "";
  const next = text.indexOf("\n## ", start + heading.length);
  return text.slice(start, next < 0 ? text.length : next);
}

function requireMarkers(errors, label, text, markers) {
  for (const marker of markers) if (!text.includes(marker)) errors.push(`${label} missing current-state marker: ${marker}`);
}

function rejectMarkers(errors, label, text, patterns) {
  for (const pattern of patterns) if (pattern.test(text)) errors.push(`${label} contains stale current-state marker: ${pattern.source}`);
}

export function validateCurrentHarnessState({
  state, selection, manifest, board, officialState, judgingMap, judgeGate, readme, handoff, runbook,
  productThesis, interactionContract, researchUxReview, decisionRegistry,
  firstPlaceGoal, cornerTransformContract, syntheticPersonaReview, firstPlaceRetrospective,
}) {
  const errors = [];
  if (state?.status !== "resolved-official-open-historical" || selection?.status !== "selected") return errors;

  const acceptedIds = new Set((manifest?.sources ?? []).filter((source) => source.status === "accepted").map((source) => source.id));
  for (const id of selection.source_ids ?? []) if (!acceptedIds.has(id)) errors.push(`selected source is not accepted in manifest: ${id}`);
  const selectedIds = [...(selection.source_ids ?? [])].sort();
  const evidenceIds = [...(state.evidence_source_ids ?? [])].sort();
  if (JSON.stringify(selectedIds) !== JSON.stringify(evidenceIds)) {
    errors.push("selected source IDs drift from eligibility evidence source IDs");
  }
  if (selection.product_id !== state.binding?.product_id) errors.push("selected product drifts from eligibility product binding");

  if (selection.product_id === "corner-policy-lab") {
    const boardRow = lineContaining(board, "| P1 | World Cup Tactics Web Challenge |");
    const judgeStatus = lineContaining(judgeGate, "Status: `");
    const handoffCheckpoint = section(handoff, "## 2026-07-19 23:59 KST — canonical Policy Lab conversion checkpoint");
    const runbookCurrent = section(runbook, "## Current verified state");
    requireMarkers(errors, "competition board active row", boardRow, [
      "Corner Policy Lab is the canonical root product", "558e8f0b", "exact refreshed PDF review and plan preflight PASS",
    ]);
    requireMarkers(errors, "judge gate status", judgeStatus, ["technical product proof and public candidate byte parity passed"]);
    requireMarkers(errors, "README current product", readme, [
      "The app is **Corner Policy Lab**", "48-match group-stage reference", "causal recommendation is `REJECT`",
    ]);
    requireMarkers(errors, "canonical handoff checkpoint", handoffCheckpoint, [
      "selected `corner-policy-lab`", "Root `pnpm dev`, `pnpm build`, and `dist/` now serve Corner Policy Lab",
      "59.520s", "34.005s", "output/pdf/corner-policy-lab-planning.pdf", "Human outcome evidence remains unavailable/no-claim",
    ]);
    requireMarkers(errors, "post-P0 execution runbook current state", runbookCurrent, [
      "PASS — LOCAL FREEZE", "World Cup repository is activated", "Corner Policy Lab is the\nselected root product",
      "7/7 policy data/release", "12/12 static four-environment browser PASS",
    ]);
    requireMarkers(errors, "post-P0 execution runbook", runbook, [
      "output/pdf/corner-policy-lab-planning.pdf", "| 8B | complete exact document gate |",
      "--require-final-submitted true", "VoiceOver stays unavailable/no-claim",
    ]);
    requireMarkers(errors, "current product thesis", productThesis, [
      "Product selection ID: `corner-policy-lab`", "policy data/release contracts: `7/7`",
      "built static release: `12/12`", "human comprehension or preference\nevidence remain incomplete",
    ]);
    requireMarkers(errors, "official state judging contract", officialState, [
      "First-round voting weights are submitter 60%, participant 20%, and public 20%",
      "Second-round internal judging is originality 30",
    ]);
    requireMarkers(errors, "current judging map", judgingMap, [
      "제출팀 | 60%", "참가팀 | 20%", "대중 | 20%", "참신성 | 30", "감독 경험 설계 | 25",
    ]);
    requireMarkers(errors, "decision registry D48", lineContaining(decisionRegistry, "| D48 |"), [
      "| accepted |", "Corner Policy Lab", "98/100", "Corner War Room", "97/100",
    ]);
    rejectMarkers(errors, "competition board active row", boardRow, [/CWR remains the root\/submission package/iu, /convert root app/iu]);
    rejectMarkers(errors, "judge differentiation gate", judgeGate, [/No official scoring weights have been published/iu, /가중치 미공개/iu]);
    rejectMarkers(errors, "README current product", readme, [/The app is \*\*Corner War Room\*\*/iu, /42-window Brazil/iu]);
    rejectMarkers(errors, "canonical handoff checkpoint", handoffCheckpoint, [/official product remains `corner-war-room`/iu, /Policy Lab remains a research challenger/iu]);
    rejectMarkers(errors, "post-P0 execution runbook current state", runbookCurrent, [/portfolio P0 freeze boundary is\s*`PENDING`/iu, /Corner War Room is implemented/iu]);
    return errors;
  }

  const boardRow = lineContaining(board, "| P1 | World Cup Tactics Web Challenge |");
  const judgeStatus = lineContaining(judgeGate, "Status: `");
  const handoffCheckpoint = section(handoff, "## 2026-07-18 authoritative continuation checkpoint");
  const activeHandoffStart = handoffCheckpoint.indexOf("- Goal remains active:");
  const activeHandoff = activeHandoffStart < 0 ? "" : handoffCheckpoint.slice(activeHandoffStart);
  if (!boardRow) errors.push("competition board missing the active World Cup row");
  if (!judgeStatus) errors.push("judge gate missing its current Status line");
  if (!handoffCheckpoint || !activeHandoff) errors.push("session handoff missing the authoritative current checkpoint");

  requireMarkers(errors, "competition board active row", boardRow, ["Corner War Room", "implemented"]);
  requireMarkers(errors, "judge gate status", judgeStatus, ["technical product proof passed"]);
  requireMarkers(errors, "README current product", readme, ["The app is **Corner War Room**", "42-window"]);
  requireMarkers(errors, "authoritative handoff checkpoint", activeHandoff, [
    "strict promotion passes", "Corner War Room now replaces Touchline Lab",
    "release builder runs complete\n  raw-free `pnpm verify`", "--require-final-submitted true",
  ]);
  requireMarkers(errors, "post-P0 execution runbook", runbook, [
    "CURRENT IMPLEMENTATION VERIFIED — PLAN PACKAGE GREEN / EXTERNAL OWNER ACTIONS PENDING",
    "portfolio P0 freeze boundary is\n`PENDING`",
    "| 7 | unavailable / no claim |",
    "| 8A | pending account gate |",
    "| 8B | complete document gate |",
    "registered for this challenge and can reach the planning-submission surface",
    "keep identity details out of the public repository",
    "independent-agent `plan-visual-qa` row",
    "docs/reviews/plan-visual-agent-review-10d48250ef48aaeb.json",
    "output/pdf/corner-policy-lab-planning.pdf",
    "--require-final-submitted true",
    "pnpm demo:rehearse --",
    "--demo-manifest <EXACT_UPLOAD_CANDIDATE_MANIFEST>",
    "--artifact-review <SHA_BOUND_INDEPENDENT_AGENT_REVIEW_JSON>",
    "--youtube-upload-confirmation <CONTENT_ADDRESSED_OWNER_ATTESTATION_JSON>",
    "VoiceOver stays unavailable/no-claim",
  ]);
  requireMarkers(errors, "official state judging contract", officialState, [
    "First-round voting weights are submitter 60%, participant 20%, and public 20%",
    "Second-round internal judging is originality 30",
  ]);
  requireMarkers(errors, "current judging map", judgingMap, [
    "제출팀 | 60%", "참가팀 | 20%", "대중 | 20%",
    "참신성 | 30", "감독 경험 설계 | 25", "완성도 | 25", "기획/구현 일관성 | 20",
    "first upload",
  ]);
  requireMarkers(errors, "current product thesis", productThesis, [
    "78/78 unit/contract suite", "56/56 pre-release gates", "human\ncomprehension are unavailable",
  ]);
  requireMarkers(errors, "interaction acceptance contract", interactionContract, [
    "MACHINE PASS", "78/78 unit/contract", "56/56 four-project pre-release",
    "BG-12 public release pending", "human comprehension\nunavailable / no claim",
  ]);
  requireMarkers(errors, "research UX review", researchUxReview, [
    "HISTORICAL SHELL REVIEW CLOSED", "56/56 total", "no result is claimed",
  ]);
  requireMarkers(errors, "decision registry D35", lineContaining(decisionRegistry, "| D35 |"), [
    "| accepted |", "78/78 unit/contract checks", "56/56 four-project pre-release gates",
  ]);
  requireMarkers(errors, "decision registry D15", lineContaining(decisionRegistry, "| D15 |"), [
    "| accepted |", "56/56 four-project pre-release contracts", "unevaluated and unclaimed",
  ]);
  requireMarkers(errors, "first-place goal", firstPlaceGoal, [
    "Human-outcome rows\nare claim gates only", "Five-second comprehension — UNEVALUATED / NO CLAIM",
    "Comparative recall — UNEVALUATED / NO CLAIM",
  ]);
  requireMarkers(errors, "corner transform contract", cornerTransformContract, [
    "Status: `PASS", "42/42 structural/semantic audit complete", "no preference, usability, or memorability claim",
  ]);
  requireMarkers(errors, "synthetic persona review", syntheticPersonaReview, [
    "clearest focal element in this synthetic design critique", "current\n  canonical planning evidence is 68/68",
  ]);
  requireMarkers(errors, "first-place retrospective", firstPlaceRetrospective, [
    "subsequent canonical verification is 68/68", "83 surfaces",
  ]);
  requireMarkers(errors, "judge differentiation evidence", judgeGate, [
    "78/78 unit/contract tests", "56/56 pre-release contracts",
  ]);

  const stale = [
    /zero accepted sources/iu,
    /implementation[- ]unauthorized/iu,
    /promotion (?:still )?fails/iu,
    /strict promotion remains (?:red|blocked)/iu,
    /Touchline Lab remains/iu,
    /Replace Touchline Lab/iu,
  ];
  rejectMarkers(errors, "competition board active row", boardRow, stale);
  rejectMarkers(errors, "judge gate status", judgeStatus, stale);
  rejectMarkers(errors, "README current product", readme, stale);
  rejectMarkers(errors, "authoritative handoff checkpoint", activeHandoff, stale);
  rejectMarkers(errors, "post-P0 execution runbook", runbook, [
    /SOURCE ADMISSION ACTIVE/iu,
    /Current result:\s*`3 \/ 4`/iu,
    /Only accepted-data promotion remains red/iu,
    /reserve up to three fresh five-person/iu,
    /submissions\/corner-war-room-planning\.pdf/iu,
    /output\/pdf\/world-cup-tactics-planning-candidate\.pdf/iu,
  ]);
  rejectMarkers(errors, "current judging map", judgingMap, [/has not published weighted scoring criteria/iu, /가중치 미공개/iu]);
  rejectMarkers(errors, "judge differentiation gate", judgeGate, [/No official scoring weights have been published/iu, /가중치 미공개/iu]);
  rejectMarkers(errors, "interaction acceptance contract", interactionContract, [
    /PASS — Chromium implementation slice/iu,
    /cross-browser, physical-device,[\s\S]{0,80}gates remain/iu,
  ]);
  rejectMarkers(errors, "research UX review", researchUxReview, [
    /Status: `CURRENT SHELL REJECT/iu,
    /The current `Touchline Lab` shell/iu,
  ]);
  rejectMarkers(errors, "decision registry D35", lineContaining(decisionRegistry, "| D35 |"), [/\| revise \|/iu]);
  rejectMarkers(errors, "decision registry D15", lineContaining(decisionRegistry, "| D15 |"), [/\| revise \|/iu]);
  rejectMarkers(errors, "synthetic persona review", syntheticPersonaReview, [/most memorable product element/iu]);
  return errors;
}
