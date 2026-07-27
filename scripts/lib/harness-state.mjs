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

export function validateLivePortfolioBoard({ board, ledger }) {
  const errors = [];
  const row = lineContaining(board, "| P0 | World Cup Tactics Web Challenge |");
  const receipt = ledger.split("\n").find((line) => line.includes("| plan-visual-qa |")) ?? "";
  const submittedReceipt = ledger.split("\n").find((line) => line.includes("| plan-submitted |")) ?? "";
  const pdfMatch = /\bpdf=([0-9a-f]{64})\b/u.exec(receipt);
  if (!row) return ["live portfolio board lacks the P0 World Cup row"];
  if (!pdfMatch) return ["submission ledger lacks the canonical plan-visual-qa PDF hash"];
  const shortHash = pdfMatch[1].slice(0, 8);
  if (!row.includes(shortHash)) errors.push(`live portfolio board does not bind canonical PDF ${shortHash}`);
  if (!row.includes("exact-hash independent review PASS")) {
    errors.push("live portfolio board does not record the exact-hash independent review PASS");
  }
  if (!row.includes("DAKER")) {
    errors.push("live portfolio board does not record the DAKER planning state");
  } else if (submittedReceipt) {
    if (!row.includes("제출 완료")) errors.push("live portfolio board does not record the observed DAKER submitted state");
  } else if (!row.includes("작성중")) {
    errors.push("live portfolio board does not retain the observed DAKER draft boundary");
  }
  return errors;
}

export function validateCurrentHarnessState({
  state, selection, manifest, board, officialState, judgingMap, judgeGate, readme, handoff, runbook,
  productThesis, interactionContract, researchUxReview, decisionRegistry,
  firstPlaceGoal, cornerTransformContract, syntheticPersonaReview, firstPlaceRetrospective,
  submissionStory, submissionLedger,
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
    const boardRow = lineContaining(board, "| P0 | World Cup Tactics Web Challenge |");
    const judgeStatus = lineContaining(judgeGate, "Status: `");
    const currentPdf = /\bpdf=([0-9a-f]{64})\b/u.exec(
      submissionLedger?.split("\n").find((line) => line.includes("| plan-visual-qa |")) ?? "",
    )?.[1]?.slice(0, 8);
    requireMarkers(errors, "competition board active row", boardRow, [
      "Corner Scout Lab is the canonical root product", currentPdf,
      "old `5/4/1` allocation video and the five-signature-only video are superseded",
      "397-corner tournament prior (`47% / 53%`)",
      "160-corner audit (`4.59%` log-loss reduction)",
      "P=0.9226 < 0.975", "exactly two video-review questions",
      "counterevidence `261095314`",
      "Zero means an observation gap, not a weakness",
      "`122/122` unit/contract suite", "`17/17` source interactions",
      "`12/12` static release matrix", "`56/56` pre-release matrix pass",
      "Exact-public, gallery, and video evidence must still be regenerated",
    ]);
    requireMarkers(errors, "judge gate status", judgeStatus, [
      "team-model and source-scene proof passed",
      "canonical public release and video reset are in progress",
    ]);
    requireMarkers(errors, "README current product", readme, [
      "The app is **Corner Scout Lab**", "397-corner tournament profile",
      "160-corner\nknockout evaluation", "failed the\nforecast promotion gate",
      "Five event-chain signatures support exactly two video-review questions",
      "261095314",
      "observation gap, not a weakness", "Causal\nrecommendation is `REJECT`",
    ]);
    requireMarkers(errors, "current product thesis", productThesis, [
      "Product selection ID: `corner-policy-lab`",
      "Product selection status: `PASS — partial-pooled team forecast + source-linked scene review`",
      "Event-chain matchup analysis status: `PASS — descriptive recorded sequences only`",
      "Full tactical weakness inference status: `REJECT",
      "46.7%", "4.59%", "0.9226",
      "7 scenes / 3 matches", "4 scenes / 3 matches",
      "corner event `261095314`",
      "Product Gate result: `PASS`",
    ]);
    requireMarkers(errors, "interaction acceptance contract", interactionContract, [
      "# Corner Scout Lab Interaction Acceptance Contract", "BG-01", "BG-15",
      "397 classifiable group-stage corners",
      "160 classifiable knockout corners", "4.59%",
      "P(gain > 0) = 0.9226 < 0.975",
      "`5`, `2`, `0`, `0`, `3`", "`2`, `0`, `0`, `0`, `2`",
      "Exactly two controls may be selected", "261095314",
      "observation gap, not a weakness",
    ]);
    requireMarkers(errors, "official state judging contract", officialState, [
      "First-round voting weights are submitter 60%, participant 20%, and public 20%",
      "Second-round internal judging is originality 30",
    ]);
    requireMarkers(errors, "current judging map", judgingMap, [
      "제출팀 | 60%", "참가팀 | 20%", "대중 | 20%", "참신성 | 30", "감독 경험 설계 | 25",
      "Observable Corner Scout Lab proof", "Portugal `47%` + tournament prior `53%`",
      "frozen 160-corner audit", "failed Uruguay-conditioning gate",
      "locks two concrete video-review questions", "observation gaps",
    ]);
    requireMarkers(errors, "decision registry D77", lineContaining(decisionRegistry, "| D77 |"), [
      "| accepted |", "`46.7%`", "397-corner tournament profile",
      "`4.59%` on 160 unseen knockout corners", "all three Portugal group matches",
    ]);
    requireMarkers(errors, "decision registry D78", lineContaining(decisionRegistry, "| D78 |"), [
      "| rejected |", "`P(gain > 0)=0.9226`", "`0.975` promotion gate",
      "Keep Uruguay out of the displayed forecast", "`관찰 공백`",
    ]);
    rejectMarkers(errors, "competition board active row", boardRow, [
      /CWR remains the root\/submission package/iu,
      /Corner Prep Lab is the canonical root product/iu,
      /full release matrix .* pass/iu,
    ]);
    rejectMarkers(errors, "judge differentiation gate", judgeGate, [/No official scoring weights have been published/iu, /가중치 미공개/iu]);
    rejectMarkers(errors, "README current product", readme, [
      /The app is \*\*Corner War Room\*\*/iu,
      /The app is \*\*Corner Prep Lab\*\*/iu,
      /place the set-piece defensive leader/iu,
      /allocate exactly ten/iu, /5\s*\/\s*2\s*\/\s*3/u,
      /allocate ten rehearsal/iu,
    ]);
    rejectMarkers(errors, "interaction acceptance contract", interactionContract, [
      /^# Corner War Room/mu, /^# Corner Policy Lab/mu,
      /vite\.invalid-artifact\.config\.ts/u, /두 역할을 어디에 둘까요/iu,
      /7\/5\/2/u, /5\/4\/1/u, /5\/2\/3/u, /corner_situation_rehearsal/u,
    ]);
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
