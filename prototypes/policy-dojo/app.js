const LANES = ["short", "near", "central-far", "other"];
const LABEL = { short: "숏 코너", near: "니어포스트", "central-far": "중앙·파포스트", other: "그 밖의 전달" };
const SHORT = { short: "숏", near: "니어", "central-far": "중앙·파", other: "그 밖" };
const MEETING_DECISIONS = {
  keep: "유지",
  revise: "다음 미팅에서 우선 구역 수정",
  defer: "판단 보류",
};

const app = document.querySelector("#app");
let report;
let state = freshState();

function freshState() {
  return { stage: "rehearsal", matchIndex: 0, selected: [], locked: false, abstained: false, revealed: false, counterexampleOpen: false, history: [], quickFixed: false, policySnapshot: null, meetingNote: null };
}

function validate(value) {
  const campaign = value?.policy_campaign;
  const allCampaignTrials = [...(campaign?.rehearsal_matches ?? []), ...(campaign?.final_audit_matches ?? [])].flatMap((match) => match.trials);
  const validCampaign = campaign?.partitions_disjoint === true && campaign.product_status === "PASS" &&
    campaign.empirical_campaign_status === "REVISE" && campaign.causal_recommendation_status === "REJECT" && campaign.reference_match_ids?.length === 48 &&
    campaign.rehearsal_matches?.length === 8 && campaign.final_audit_matches?.length === 8 &&
    allCampaignTrials.every((trial) => !campaign.reference_match_ids.includes(trial.state.match_id));
  if (value?.status !== "REJECT" || value?.population?.source_corners !== 603 ||
      value?.gates?.exact_source_population !== true || !value.clustered_bootstrap || !validCampaign) {
    throw new Error("고정 경기 분할 검증 보고서와 일치하지 않습니다.");
  }
  return value;
}

function percentage(part, whole) {
  return whole === 0 ? "0" : (part / whole * 100).toFixed(0);
}

function currentExperiment() {
  const campaign = report.policy_campaign;
  if (state.stage === "final") {
    const trials = campaign.final_audit_matches.flatMap((match) => match.trials);
    return { kind: "final", label: "최종 검증 · 8강 이후 8경기", resultName: "8강 이후 8경기", trials, matches: campaign.final_audit_matches };
  }
  if (state.quickFixed) {
    const trials = campaign.rehearsal_matches.flatMap((match) => match.trials);
    return { kind: "rehearsal", label: "중간 평가 · 16강 8경기", resultName: "16강 8경기", trials, matches: campaign.rehearsal_matches };
  }
  const match = campaign.rehearsal_matches[state.matchIndex];
  return { kind: "rehearsal", label: `정책 리허설 ${state.matchIndex + 1}/8 · 16강`, resultName: match.match_name, trials: match.trials, matches: [match] };
}

function evaluatePolicy(experiment, selected = state.selected, abstained = state.abstained) {
  const covered = experiment.trials.filter((trial) => selected.includes(trial.observed_action.value));
  const uncovered = experiment.trials.filter((trial) => !selected.includes(trial.observed_action.value));
  const coveredShots = covered.filter((trial) => trial.observed_outcome.attacking_shot);
  const uncoveredShots = uncovered.filter((trial) => trial.observed_outcome.attacking_shot);
  const counterexample = uncoveredShots[0] ?? uncovered[0] ?? coveredShots[0] ?? experiment.trials[0];
  const reason = abstained ? "판단을 보류한 뒤 확인한 대표 기록" : uncoveredShots[0] ? "선택 밖 구역에서 슈팅 기록" :
    uncovered[0] ? "선택 밖 구역으로 전달된 기록" :
      coveredShots[0] ? "선택 구역과 겹쳐도 슈팅이 이어진 기록" : "위치 겹침만으로 효과를 판정할 수 없는 기록";
  return { ...experiment, covered, uncovered, coveredShots, uncoveredShots, counterexample, reason };
}

function policyLabel() {
  return policyLabelFor(state.selected, state.abstained);
}

function policyLabelFor(selected, abstained = false) {
  return abstained ? "판단 보류" : selected.map((lane) => LABEL[lane]).join(" + ");
}

function policyFingerprint(selected, abstained = false) {
  const source = `${abstained ? "abstain" : [...selected].sort().join("+")}|reference:48|rehearsal:8|final:8`;
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `P-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function sealedPolicyId() {
  return state.policySnapshot?.fingerprint ?? policyFingerprint(state.selected, state.abstained);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function meetingNoteMarkup() {
  if (state.meetingNote) {
    return `<section class="meeting-note-receipt" data-testid="meeting-note-receipt" role="status" tabindex="-1">
      <p class="eyebrow">NEXT MEETING NOTE</p>
      <h4>다음 미팅 메모 저장됨</h4>
      <p><strong>${MEETING_DECISIONS[state.meetingNote.decision]}</strong></p>
      <p>${escapeHtml(state.meetingNote.reason)}</p>
      <p class="sealed-anchor">봉인 정책 ${state.meetingNote.policyId} · 정책 변경 0회 · 검증 결과는 그대로입니다.</p>
      <button class="primary" type="button" data-action="restart">처음부터 다시 실험</button>
    </section>`;
  }
  return `<form class="meeting-note" data-action="save-meeting-note">
    <fieldset>
      <legend>이 검증을 보고 다음 미팅 메모를 남기세요.</legend>
      <p id="meeting-note-help">아래 선택은 다음 세트피스 미팅을 위한 메모입니다. 봉인 정책, 위치 겹침 결과, 평가 영수증은 바뀌지 않습니다.</p>
      <div class="meeting-options" role="radiogroup" aria-describedby="meeting-note-help">
        ${Object.entries(MEETING_DECISIONS).map(([value, label]) => `<label><input required type="radio" name="meeting-decision" value="${value}"><span>${label}</span></label>`).join("")}
      </div>
      <label class="meeting-reason" for="meeting-reason">이유 <span>(120자 이내)</span></label>
      <textarea id="meeting-reason" maxlength="120" name="meeting-reason" required rows="3" placeholder="예: 선택 밖 전달이 반복돼 다음 미팅에서 구역 조합을 다시 검토"></textarea>
      <button class="primary" type="submit">다음 미팅 메모 저장</button>
    </fieldset>
  </form>`;
}

function supportPath() {
  const campaign = report.policy_campaign;
  const selectedCounts = state.selected.map((lane) => `${LABEL[lane]} ${campaign.reference_summary[lane].corners}회`);
  const selectedBounds = state.selected.map((lane) => {
    const bounds = campaign.segment_coverage.reference.delivery_share_bounds[lane];
    return `${LABEL[lane]} ${(bounds.lower * 100).toFixed(1)}~${(bounds.upper * 100).toFixed(1)}%`;
  });
  const interval = campaign.reference_bootstrap.shot_rate_difference_interval;
  return [
    `MatchContext: 조별리그 48경기 · 유효 코너 ${campaign.reference_corners}개`,
    `분류 누락: 조별리그 ${campaign.segment_coverage.reference.source_corners}개 중 ${campaign.segment_coverage.reference.placeholder_corners}개`,
    `ScoutingPolicy: ${state.abstained ? "근거 부족으로 선택 보류" : selectedCounts.join(" · ")}`,
    state.abstained ? "누락 민감도: 구역 선택을 하지 않아 계산하지 않음" : `누락 39개가 한 구역에 모두 속한다고 가정한 비중 범위: ${selectedBounds.join(" · ")}`,
    `불확실성 점검: 슈팅 연관률 1·2위 구역의 차이 ${(interval.lower_95 * 100).toFixed(1)}~${(interval.upper_95 * 100).toFixed(1)}%p`,
    "허용 관계: ScoutingPolicy COVERS_RECORDED_ACTION DeliveryAction",
    "금지 관계: WOULD_PREVENT · OPTIMAL_POLICY",
  ];
}

function trainingCard(lane) {
  const summary = report.policy_campaign.reference_summary;
  const cell = summary[lane];
  const total = Object.values(summary).reduce((sum, item) => sum + item.corners, 0);
  return `<button class="lane-card" type="button" data-lane="${lane}" aria-pressed="${state.selected.includes(lane)}" ${state.locked ? "disabled" : ""}>
    <span>${LABEL[lane]}</span><strong>${cell.corners}회</strong><small>분류된 ${total}개 중 ${percentage(cell.corners, total)}%</small>
  </button>`;
}

function resultRows(evaluation) {
  return evaluation.trials.map((trial) => {
    const covered = state.selected.includes(trial.observed_action.value);
    return `<li><span>${trial.provenance.match_name}</span><span>코너 #${trial.provenance.corner_event_id}</span><strong>${LABEL[trial.observed_action.value]}</strong><span>${state.abstained ? "판단 보류" : covered ? "선택 구역과 겹침" : "선택 밖"}</span><span>${trial.observed_outcome.attacking_shot ? "10초 이내 슈팅 기록" : "슈팅 기록 없음"}</span></li>`;
  }).join("");
}

function historyMarkup() {
  if (state.history.length === 0) return "";
  return `<details class="history"><summary>16강 평가 영수증 ${state.history.length}개</summary><ol>${state.history.map((entry) => `<li><span>${entry.matchName}</span><strong>${entry.policy}${entry.policyId ? ` · ${entry.policyId}` : ""}</strong><span>위치 겹침 ${entry.covered}/${entry.corners}</span><span>대표 반례 #${entry.counterexampleId}</span></li>`).join("")}</ol></details>`;
}

function historyEntry(experiment, evaluation, policy = policyLabel(), policyId = null) {
  return { matchName: experiment.resultName, policy, policyId, covered: evaluation.covered.length, corners: evaluation.trials.length, counterexampleId: evaluation.counterexample.provenance.corner_event_id };
}

function render() {
  const experiment = currentExperiment();
  const evaluation = state.revealed ? evaluatePolicy(experiment) : null;
  const campaign = report.policy_campaign;
  const finalStage = experiment.kind === "final";
  app.innerHTML = `
    <header class="hero">
      <p class="eyebrow">CORNER POLICY LAB · 인과 추천 차단</p>
      <h1>조별리그에서 세우고, 토너먼트에서 깨뜨리세요.</h1>
      <p class="hero-copy">조별리그 48경기의 전달 위치만 참고해 관찰 정책을 정합니다. 16강에서 중간 평가하고, 공개하지 않고 남겨 둔 8강 이후 8경기에 같은 정책을 다시 적용합니다.</p>
      <div class="boundary"><strong>과거 기록을 활용한 위치 스트레스 테스트입니다.</strong> 전달 위치 겹침만 계산하며 슈팅 방지 효과나 최적 전술을 판정하지 않습니다.</div>
      <div class="campaign-map" aria-label="고정 캠페인 분할"><div><strong>48경기</strong><span>조별리그 참고</span></div><b>→</b><div><strong>8경기</strong><span>16강 중간 평가</span></div><b>→</b><div class="sealed"><strong>8경기</strong><span>8강 이후 봉인 검증</span></div></div>
    </header>
    <section class="stage" aria-labelledby="policy-title" data-partitions-disjoint="${campaign.partitions_disjoint}" data-stage="${state.stage}">
      <div class="round"><span>${experiment.label}</span><span>16강 평가 영수증 ${state.history.length}개</span></div>
      <div class="phase"><span class="active">1 정책 설정</span><span class="${state.locked ? "active" : ""}">2 잠금</span><span class="${state.revealed ? "active" : ""}">3 반례 검토</span><span class="${finalStage && state.counterexampleOpen ? "active" : ""}">4 다음 미팅 메모</span></div>
      <h2 id="policy-title">세트피스 미팅에서 우선 검토할 구역 두 곳을 고르세요 <small>${state.selected.length}/2</small></h2>
      <p class="tradeoff">고르지 않은 두 구역은 이번 미팅의 우선 검토에서 제외됩니다.</p>
      <p class="training-scope">고정 참고 집합: 조별리그 48경기 · ${campaign.segment_coverage.reference.source_corners}개 중 ${campaign.reference_corners}개 분류 가능 (${(campaign.segment_coverage.reference.classified_rate * 100).toFixed(1)}%)</p>
      <div class="policy-layout">
        <div class="pitch" role="group" aria-label="코너 전달 구역 지도"><span class="corner" aria-hidden="true">●</span>${LANES.map((lane) => `<button type="button" data-zone-lane="${lane}" aria-label="${LABEL[lane]}에 주의 토큰 배치" aria-pressed="${state.selected.includes(lane)}" class="zone zone-${lane} ${state.selected.includes(lane) ? "selected" : ""} ${evaluation?.trials.some((trial) => trial.observed_action.value === lane) ? "observed" : ""}" ${state.locked ? "disabled" : ""}>${state.selected.includes(lane) ? "✓ " : ""}${SHORT[lane]}</button>`).join("")}</div>
        <div class="lane-cards" aria-label="스카우팅 우선 구역 선택">${LANES.map(trainingCard).join("")}</div>
      </div>
      ${!state.locked && finalStage ? `<div class="policy-actions"><button class="primary" type="button" data-action="final-verify" ${state.selected.length === 2 ? "" : "disabled"}>최종 정책 잠금 · 봉인 8경기 검증</button><button class="secondary" type="button" data-action="final-abstain">최종 판단 보류 · 봉인 검증</button></div>` : !state.locked ? `<div class="policy-actions"><button class="primary" type="button" data-action="quick-lock" ${state.selected.length === 2 ? "" : "disabled"}>이 정책을 잠가 두 시험에 적용</button><button class="secondary" type="button" data-action="quick-abstain">판단 보류를 두 시험에 적용</button></div><details class="manual-mode"><summary>한 경기씩 검토하며 정책 바꾸기</summary><button class="tertiary" type="button" data-action="lock" ${state.selected.length === 2 ? "" : "disabled"}>첫 16강 경기만 잠금</button></details>` : !state.revealed ? `
        <div class="receipt" data-testid="lock-receipt"><p><strong>${policyLabel()}</strong>${state.abstained ? "를 결과 공개 전에 선언했습니다." : " 관찰 정책을 결과 공개 전에 잠갔습니다."}${state.policySnapshot ? ` <span class="policy-id">${state.policySnapshot.fingerprint}</span>` : ""}</p><p>${state.quickFixed ? "16강 8경기와 봉인된 8강 이후 8경기에 동일하게 적용합니다. 아직 어느 결과도 공개하지 않았습니다." : `${finalStage ? "8강 이후 8경기" : "이번 16강 경기"}의 이름과 코너 기록은 아직 숨겨져 있습니다.`}</p><button class="primary" type="button" data-action="reveal">${state.quickFixed ? "16강 8경기 평가 요약 공개" : finalStage ? "최종 검증 8경기 공개" : "미공개 16강 경기 공개"}</button></div>` : `
        <section class="scorecard" aria-labelledby="result-title">
          <p class="receipt-label">고정 참고 48경기 → ${finalStage ? "최종 검증 8경기" : state.quickFixed ? "16강 중간 평가 8경기" : `정책 리허설 ${state.matchIndex + 1}/8`}</p><h2 id="result-title">${experiment.resultName} · ${state.abstained ? "판단 보류 검증" : `위치 겹침 ${evaluation.covered.length}/${evaluation.trials.length}`}</h2>
          ${state.abstained ? `<div class="metrics"><div><strong>보류</strong><span>사전 정책</span></div><div><strong>${new Set(evaluation.trials.map((trial) => trial.observed_action.value)).size}</strong><span>실제 전달 구역</span></div><div><strong>${evaluation.trials.filter((trial) => trial.observed_outcome.attacking_shot).length}</strong><span>10초 이내 슈팅 기록</span></div></div>` : `<div class="metrics"><div><strong>${percentage(evaluation.covered.length, evaluation.trials.length)}%</strong><span>전달 위치 겹침</span></div><div><strong>${evaluation.uncovered.length}</strong><span>선택 밖 전달</span></div><div><strong>${evaluation.uncoveredShots.length}</strong><span>선택 밖 슈팅 기록</span></div></div>`}
          <p class="causal-warning">이 수치는 수비 성공률이 아닙니다. ${state.quickFixed ? `전달 위치를 분류할 수 없는 ${finalStage ? "2" : "5"}개 기록은 어느 구역에도 넣지 않았습니다. ` : ""}실제 선수 배치와 반사실적 경기 결과는 데이터에 없습니다.</p>
          <details class="event-ledger"><summary>${finalStage ? "최종 검증" : state.quickFixed ? "16강 중간 평가" : "이번 경기"} 코너 ${evaluation.trials.length}개 기록표</summary><ol>${resultRows(evaluation)}</ol></details>
          <button class="skeptic" type="button" data-action="counterexample">대표 반례 보기</button>
          ${state.counterexampleOpen ? `<article class="counterexample" tabindex="-1" data-testid="counterexample"><p class="eyebrow">ONTOLOGY CONTRADICTION</p><h3>${evaluation.reason}</h3><p>${evaluation.counterexample.provenance.match_name} · 코너 #${evaluation.counterexample.provenance.corner_event_id} · 실제 전달 ${LABEL[evaluation.counterexample.observed_action.value]}${evaluation.counterexample.observed_outcome.attacking_shot ? " · 10초 이내 슈팅 기록" : ""}</p><ol class="path"><li>MatchContext TESTED_IN ScoutingPolicy</li><li>ScoutingPolicy: ${policyLabel()}${state.policySnapshot ? ` · ${state.policySnapshot.fingerprint}` : ""}</li><li>CornerRestart RECORDED_ACTION DeliveryAction: ${LABEL[evaluation.counterexample.observed_action.value]}</li><li>CornerRestart OBSERVED_NEXT ObservedEvent</li><li>ObservedEvent OBSERVED_OUTCOME OutcomeProxy: ${evaluation.counterexample.observed_outcome.attacking_shot ? "공격팀 슈팅 기록" : "슈팅 기록 없음"}</li><li>ObservedEvent DERIVED_FROM Source: Pappalardo Wyscout World Cup 2018 · CC BY 4.0</li><li>금지 관계: WOULD_PREVENT · OPTIMAL_POLICY</li></ol>${finalStage ? `<div class="final-receipt" data-testid="final-receipt"><strong>최종 정책 검증 완료</strong><span>${state.quickFixed ? `정책 변경 0회 · 최초 잠금 정책 ${state.policySnapshot.fingerprint}을 16강과 공개하지 않고 남겨 둔 8강 이후 8경기에 그대로 적용했습니다.` : `16강 평가 영수증 ${state.history.length}개를 남긴 뒤, 최종 정책을 남겨 둔 8경기에 한 번만 적용했습니다.`}</span></div>${meetingNoteMarkup()}` : state.quickFixed ? `<div class="fixed-policy-actions"><p>8강 이후 8경기는 아직 봉인돼 있습니다. 정책 ${state.policySnapshot.fingerprint}은 바꿀 수 없습니다.</p><button class="primary" type="button" data-action="quick-final">같은 정책으로 봉인 검증 8경기 공개</button></div>` : `<div class="revision-actions"><button class="primary" type="button" data-action="revise">평가 영수증 남기고 다음 미공개 경기</button><button class="secondary" type="button" data-action="batch-rehearsal">현재 정책으로 남은 16강 일괄 검증</button></div>`}</article>` : ""}
        </section>`}
      ${historyMarkup()}
    </section>
    <aside class="agent" aria-labelledby="agent-title">
      <div><p class="eyebrow">근거 제한 에이전트</p><h2 id="agent-title">지금 기록만으로 어느 구역을 우선해야 한다고 말하기 어렵습니다.</h2><p>분류 가능률은 조별리그 ${campaign.segment_coverage.reference.classified_corners}/${campaign.segment_coverage.reference.source_corners}, 16강 ${campaign.segment_coverage.rehearsal.classified_corners}/${campaign.segment_coverage.rehearsal.source_corners}, 8강 이후 ${campaign.segment_coverage.final_audit.classified_corners}/${campaign.segment_coverage.final_audit.source_corners}입니다. 경기별 차이를 감안하면 구역별 슈팅 연관 차이도 확정되지 않아 특정 구역을 추천하지 않습니다.</p></div>
      ${state.locked ? `<details><summary>온톨로지 설명 경로</summary><ol class="path">${supportPath().map((item) => `<li>${item}</li>`).join("")}</ol></details>` : ""}
    </aside>`;
}

app.addEventListener("click", (event) => {
  const lane = event.target.closest("[data-lane]")?.dataset.lane;
  const zoneLane = event.target.closest("[data-zone-lane]")?.dataset.zoneLane;
  const action = event.target.closest("[data-action]")?.dataset.action;
  const selectedLane = lane ?? zoneLane;
  if (selectedLane && !state.locked) {
    const selected = state.selected.includes(selectedLane) ? state.selected.filter((item) => item !== selectedLane) : state.selected.length < 2 ? [...state.selected, selectedLane] : state.selected;
    state = { ...state, selected };
    render();
    return;
  }
  if (action === "lock" && state.selected.length === 2) state = { ...state, locked: true };
  else if (action === "quick-lock" && state.selected.length === 2 && state.stage === "rehearsal") state = { ...state, locked: true, quickFixed: true, policySnapshot: { label: policyLabel(), fingerprint: policyFingerprint(state.selected) } };
  else if (action === "quick-abstain" && state.stage === "rehearsal") state = { ...state, selected: [], locked: true, abstained: true, quickFixed: true, policySnapshot: { label: "판단 보류", fingerprint: policyFingerprint([], true) } };
  else if (action === "final-verify" && state.selected.length === 2 && state.stage === "final" && state.history.length === 8) state = { ...state, locked: true, revealed: true, counterexampleOpen: true };
  else if (action === "final-abstain" && state.stage === "final" && state.history.length === 8) state = { ...state, selected: [], locked: true, abstained: true, revealed: true, counterexampleOpen: true };
  else if (action === "abstain" && !state.locked) state = { ...state, selected: [], locked: true, abstained: true };
  else if (action === "reveal" && state.locked && !state.revealed) {
    if (state.quickFixed && state.stage === "rehearsal") {
      const policy = state.policySnapshot.label;
      const history = report.policy_campaign.rehearsal_matches.map((match, index) => {
        const experiment = { kind: "rehearsal", label: `정책 리허설 ${index + 1}/8 · 16강`, resultName: match.match_name, trials: match.trials, matches: [match] };
        return historyEntry(experiment, evaluatePolicy(experiment), policy, state.policySnapshot.fingerprint);
      });
      state = { ...state, revealed: true, counterexampleOpen: true, history };
    } else state = { ...state, revealed: true };
  }
  else if (action === "quick-final" && state.quickFixed && state.revealed && state.stage === "rehearsal" && state.history.length === 8) state = { ...state, stage: "final", revealed: true, counterexampleOpen: true };
  else if (action === "counterexample" && state.revealed) state = { ...state, counterexampleOpen: true };
  else if (action === "revise" && state.counterexampleOpen && state.stage === "rehearsal") {
    const evaluation = evaluatePolicy(currentExperiment());
    const history = [...state.history, historyEntry(currentExperiment(), evaluation)];
    state = state.matchIndex === 7 ? { ...freshState(), stage: "final", selected: [...state.selected], history } : { ...freshState(), matchIndex: state.matchIndex + 1, history };
  } else if (action === "batch-rehearsal" && state.counterexampleOpen && state.stage === "rehearsal") {
    const history = [...state.history];
    for (let index = state.matchIndex; index < report.policy_campaign.rehearsal_matches.length; index += 1) {
      const match = report.policy_campaign.rehearsal_matches[index];
      const experiment = { kind: "rehearsal", label: `정책 리허설 ${index + 1}/8 · 16강`, resultName: match.match_name, trials: match.trials, matches: [match] };
      history.push(historyEntry(experiment, evaluatePolicy(experiment)));
    }
    state = { ...freshState(), stage: "final", selected: [...state.selected], history };
  } else if (action === "restart") state = freshState();
  else return;
  render();
  if (action === "counterexample" || action === "reveal" && state.quickFixed || action === "quick-final" || action === "final-verify" || action === "final-abstain") document.querySelector("[data-testid=counterexample]")?.focus();
}
);

app.addEventListener("submit", (event) => {
  const form = event.target.closest('[data-action="save-meeting-note"]');
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (!state.locked || !state.revealed || !state.counterexampleOpen || currentExperiment().kind !== "final" || state.meetingNote) return;
  const formData = new FormData(form);
  const decision = String(formData.get("meeting-decision") ?? "");
  const reason = String(formData.get("meeting-reason") ?? "").trim();
  if (!(decision in MEETING_DECISIONS) || reason.length === 0 || reason.length > 120) return;
  state = { ...state, meetingNote: { decision, reason, policyId: sealedPolicyId() } };
  render();
  document.querySelector("[data-testid=meeting-note-receipt]")?.focus();
});

try {
  const reportUrl = document.querySelector('meta[name="policy-report"]')?.content ?? "../../data/audit/policy-lab-spike.json";
  report = validate(await fetch(reportUrl, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`보고서를 불러오지 못했습니다: ${response.status}`);
    return response.json();
  }));
  render();
} catch (error) {
  app.innerHTML = `<section class="error" role="alert"><h1>Policy Lab을 열 수 없습니다.</h1><p>${error instanceof Error ? error.message : "알 수 없는 오류"}</p></section>`;
}
