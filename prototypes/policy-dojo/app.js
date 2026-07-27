const LANES = ["short", "near", "central-far", "other"];
const LABEL = { short: "숏 코너", near: "니어포스트", "central-far": "중앙·파포스트", other: "그 밖의 전달" };
const SHORT = { short: "숏", near: "니어", "central-far": "중앙·파", other: "그 밖" };
const MEETING_DECISIONS = {
  keep: "다음 회의에서도 이 구역 유지",
  revise: "다음 회의에서 우선 구역 수정",
  defer: "다음 회의에서 결정 보류",
};
const DEMO_MANAGER = "우루과이";
const DEMO_OPPONENT = "포르투갈";

const app = document.querySelector("#app");
let report;
let state = freshState();

function freshState() {
  return { stage: "rehearsal", matchIndex: 0, selected: [], outletKept: false, minimumOverlap: null, locked: false, abstained: false, revealed: false, counterexampleOpen: false, history: [], quickFixed: false, policySnapshot: null, meetingNote: null };
}

function validate(value) {
  const campaign = value?.policy_campaign;
  const scouting = value?.team_scouting;
  const allCampaignTrials = [...(campaign?.rehearsal_matches ?? []), ...(campaign?.final_audit_matches ?? [])].flatMap((match) => match.trials);
  const validCampaign = campaign?.partitions_disjoint === true && campaign.product_status === "PASS" &&
    campaign.empirical_campaign_status === "REVISE" && campaign.causal_recommendation_status === "REJECT" && campaign.reference_match_ids?.length === 48 &&
    campaign.rehearsal_matches?.length === 8 && campaign.final_audit_matches?.length === 8 &&
    campaign.reference_outlet_context?.label === "recorded-defending-pass-or-clearance-touching-attacking-outlet-band" &&
    campaign.reference_outlet_context.corners === campaign.reference_corners &&
    allCampaignTrials.every((trial) =>
      !campaign.reference_match_ids.includes(trial.state.match_id) &&
      typeof trial.observed_outcome.defending_outlet_contact === "boolean");
  const validScouting = scouting?.status === "PASS" &&
    scouting?.model?.selection_data === "group-stage reference only" &&
    scouting?.first_fixed_round_of_16_example?.match_name === "Uruguay - Portugal" &&
    scouting?.first_fixed_round_of_16_example?.opponent_group_stage_classified_corners === 14 &&
    scouting?.matchup_challenger?.status === "REJECT" &&
    scouting?.matchup_challenger?.selected?.defending_weight === 0.5 &&
    scouting?.matchup_challenger?.promotion_gates?.match_cluster_probability_at_least_0975 === false &&
    scouting?.top_two_coverage?.round_of_16?.tournament_top_two_covered ===
      scouting?.top_two_coverage?.round_of_16?.team_conditioned_top_two_covered;
  if (value?.status !== "REJECT" || value?.population?.source_corners !== 603 ||
      value?.gates?.exact_source_population !== true || !value.clustered_bootstrap ||
      !validCampaign || !validScouting) {
    throw new Error("불러온 자료가 이 서비스의 경기 기록과 일치하지 않습니다.");
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
    return { kind: "final", label: "마지막 확인 · 8강 이후 8경기", resultName: "8강 이후 8경기", trials, matches: campaign.final_audit_matches };
  }
  if (state.quickFixed) {
    const trials = campaign.rehearsal_matches.flatMap((match) => match.trials);
    return { kind: "rehearsal", label: "첫 확인 · 16강 8경기", resultName: "16강 8경기", trials, matches: campaign.rehearsal_matches };
  }
  const match = campaign.rehearsal_matches[state.matchIndex];
  return { kind: "rehearsal", label: `16강 경기 ${state.matchIndex + 1}/8 확인`, resultName: match.match_name, trials: match.trials, matches: [match] };
}

function evaluatePolicy(experiment, selected = state.selected, abstained = state.abstained) {
  const covered = experiment.trials.filter((trial) => selected.includes(trial.observed_action.value));
  const uncovered = experiment.trials.filter((trial) => !selected.includes(trial.observed_action.value));
  const coveredShots = covered.filter((trial) => trial.observed_outcome.attacking_shot);
  const uncoveredShots = uncovered.filter((trial) => trial.observed_outcome.attacking_shot);
  const outletContacts = experiment.trials.filter((trial) => trial.observed_outcome.defending_outlet_contact);
  const counterexample = uncoveredShots[0] ?? uncovered[0] ?? coveredShots[0] ?? experiment.trials[0];
  const reason = abstained ? "판단을 보류한 뒤 확인한 대표 기록" : uncoveredShots[0] ? "선택 밖 구역에서 슈팅 기록" :
    uncovered[0] ? "선택 밖 구역으로 전달된 기록" :
      coveredShots[0] ? "선택 구역과 겹쳐도 슈팅이 이어진 기록" : "위치 겹침만으로 효과를 판정할 수 없는 기록";
  return { ...experiment, covered, uncovered, coveredShots, uncoveredShots, outletContacts, counterexample, reason };
}

function policyLabel() {
  return policyLabelFor(state.selected, state.abstained, state.outletKept);
}

function policyLabelFor(selected, abstained = false, outletKept = false) {
  if (abstained) return "판단 보류";
  const zones = selected.map((lane) => LABEL[lane]).join(" + ");
  return outletKept ? `${zones} · 역습 1명 유지` : selected.length === 2 ? `${zones} · 역습 1명 수비 전환` : zones;
}

function policyFingerprint(selected, abstained = false, minimumOverlap = state.minimumOverlap, outletKept = state.outletKept) {
  const staffing = abstained ? "abstain" : outletKept ? "outlet-kept" : "outlet-to-defense";
  const roleAssignment = abstained
    ? "abstain"
    : outletKept
      ? `leader:${selected[0] ?? "none"}|outlet:kept`
      : `leader:${selected[0] ?? "none"}|second:${selected[1] ?? "none"}`;
  const source = `${roleAssignment}|staffing:${staffing}|minimum-overlap:${minimumOverlap ?? "none"}|reference:48|rehearsal:8|final:8`;
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `P-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function staffingReady() {
  return state.selected.length === 2 || state.selected.length === 1 && state.outletKept;
}

function staffingLabel() {
  if (state.outletKept) return "역습 역할 1명 전방 유지";
  if (state.selected.length === 2) return "역습 역할 1명 두 번째 수비 구역 전환";
  return "역습 역할 결정 필요";
}

function sealedPolicyId() {
  return state.policySnapshot?.fingerprint ?? policyFingerprint(state.selected, state.abstained);
}

function thresholdVerdict(evaluation) {
  if (state.abstained || state.minimumOverlap === null) return null;
  const rate = evaluation.trials.length === 0 ? 0 : evaluation.covered.length / evaluation.trials.length;
  return {
    rate,
    passed: rate >= state.minimumOverlap,
    label: rate >= state.minimumOverlap ? "사전 기준 충족" : "사전 기준 미달",
  };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function meetingNoteMarkup() {
  if (state.meetingNote) {
    return `<section class="meeting-note-receipt" data-testid="meeting-note-receipt" role="status" tabindex="-1">
      <p class="eyebrow">다음 회의</p>
      <h4>다음 전술 회의 메모를 저장했습니다</h4>
      <p><strong>${MEETING_DECISIONS[state.meetingNote.decision]}</strong></p>
      <p>${escapeHtml(state.meetingNote.reason)}</p>
      <p class="sealed-anchor">처음 확정한 선택 ${state.meetingNote.policyId} · 선택 변경 0회 · 확인 결과는 그대로입니다.</p>
      <button class="primary" type="button" data-action="restart">처음부터 다시 해보기</button>
    </section>`;
  }
  return `<form class="meeting-note" data-action="save-meeting-note">
    <fieldset>
      <legend>이 결과를 보고 다음 전술 회의에서 검토할 내용을 남기세요.</legend>
      <p id="meeting-note-help">아래 메모는 다음 회의를 위한 기록입니다. 이미 확정한 선택과 확인 결과는 바뀌지 않습니다.</p>
      <div class="meeting-options" role="radiogroup" aria-describedby="meeting-note-help">
        ${Object.entries(MEETING_DECISIONS).map(([value, label]) => `<label><input required type="radio" name="meeting-decision" value="${value}"><span>${label}</span></label>`).join("")}
      </div>
      <label class="meeting-reason" for="meeting-reason">바꿀 점 또는 유지할 이유 <span>(120자 이내)</span></label>
      <textarea id="meeting-reason" maxlength="120" name="meeting-reason" required rows="3" placeholder="예: 선택 밖 전달이 반복돼 다음 회의에서 구역 조합을 다시 검토"></textarea>
      <button class="primary" type="submit">다음 회의 메모 저장</button>
    </fieldset>
  </form>`;
}

function contradictionPathMarkup(evaluation) {
  return `<ol class="path"><li>경기 묶음 → 확인한 선택</li><li>확인한 선택 → ${policyLabel()}${state.minimumOverlap === null ? "" : ` · 통과 기준 ${Math.round(state.minimumOverlap * 100)}%`}${state.policySnapshot ? ` · 선택 번호 ${state.policySnapshot.fingerprint}` : ""}</li><li>코너킥 → 실제 전달 위치: ${LABEL[evaluation.counterexample.observed_action.value]}</li><li>코너킥 → 이어서 나온 실제 경기 기록</li><li>이어서 나온 기록 → ${evaluation.counterexample.observed_outcome.attacking_shot ? "10초 이내 공격팀 슈팅 있음" : "10초 이내 공격팀 슈팅 없음"}</li><li>자료 출처 → Pappalardo Wyscout World Cup 2018 · CC BY 4.0</li><li>이 기록으로 말할 수 없음 → 이 선택이 실점을 막았을지 · 최적 전술인지</li></ol>`;
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
    state.abstained ? "사전 기준: 판단 보류" : `사전 기준: 분류 가능한 전달의 위치 겹침 ${Math.round(state.minimumOverlap * 100)}% 이상`,
    state.abstained ? "누락 민감도: 구역 선택을 하지 않아 계산하지 않음" : `누락 39개가 한 구역에 모두 속한다고 가정한 비중 범위: ${selectedBounds.join(" · ")}`,
    `불확실성 점검: 슈팅 연관률 1·2위 구역의 차이 ${(interval.lower_95 * 100).toFixed(1)}~${(interval.upper_95 * 100).toFixed(1)}%p`,
    "확인할 수 있는 관계: 선택 구역과 실제 전달 위치의 겹침",
    "확인할 수 없는 관계: 이 선택이 실점을 막았을지 · 최적 전술인지",
  ];
}

function trainingCard(lane) {
  const dossier = report.team_scouting.first_fixed_round_of_16_example;
  const probability = dossier.opponent_posterior_probabilities[lane];
  const tournament = report.team_scouting.reference.tournament_probabilities[lane];
  const raw = dossier.opponent_group_stage_action_counts[lane];
  const roleIndex = state.selected.indexOf(lane);
  const role = roleIndex === 0 ? "수비 리더" : roleIndex === 1 ? "역습 전환" : "";
  return `<button class="lane-card" type="button" data-lane="${lane}" aria-pressed="${state.selected.includes(lane)}" ${state.locked ? "disabled" : ""}>
    <span>${LABEL[lane]}${role ? `<em>${role}</em>` : ""}</span><strong>${(probability * 100).toFixed(1)}%</strong><small>${DEMO_OPPONENT} 조별리그 ${raw}회 · 대회 평균 ${(tournament * 100).toFixed(1)}%</small>
  </button>`;
}

function opponentResultMarkup(finalStage) {
  if (finalStage) return "";
  const dossier = report.team_scouting.first_fixed_round_of_16_example;
  const counts = dossier.held_out_opponent_action_counts;
  const covered = state.selected.reduce((sum, lane) => sum + counts[lane], 0);
  return `<section class="opponent-result" data-testid="opponent-result" aria-labelledby="opponent-result-title">
    <div>
      <p class="eyebrow">상대전 먼저 확인</p>
      <h3 id="opponent-result-title">${DEMO_OPPONENT}의 실제 코너 전달 ${dossier.held_out_opponent_classified_corners}개</h3>
      <p>${state.abstained ? "결정을 보류한 상태로 기록만 확인합니다." : `감독이 고른 구역으로 ${covered}/${dossier.held_out_opponent_classified_corners}개가 왔습니다.`}</p>
    </div>
    <dl>${LANES.map((lane) => `<div><dt>${LABEL[lane]}</dt><dd>${counts[lane]}개</dd></div>`).join("")}</dl>
    <small>한 경기 기록만으로 선택이 옳았다고 판정하지 않습니다. 아래 8경기 묶음은 같은 선택이 다른 상대에서도 버티는지 따로 확인합니다.</small>
  </section>`;
}

function resultRows(evaluation) {
  return evaluation.trials.map((trial) => {
    const covered = state.selected.includes(trial.observed_action.value);
    return `<li><span>${trial.provenance.match_name}</span><span>코너 #${trial.provenance.corner_event_id}</span><strong>${LABEL[trial.observed_action.value]}</strong><span>${state.abstained ? "판단 보류" : covered ? "선택 구역과 겹침" : "선택 밖"}</span><span>${trial.observed_outcome.attacking_shot ? "10초 이내 슈팅 기록" : "슈팅 기록 없음"}</span></li>`;
  }).join("");
}

function historyMarkup() {
  if (state.history.length === 0) return "";
  return `<details class="history"><summary>16강 확인 기록 ${state.history.length}개</summary><ol>${state.history.map((entry) => `<li><span>${entry.matchName}</span><strong>${entry.policy}${entry.policyId ? ` · ${entry.policyId}` : ""}</strong><span>${entry.verdict} · 선택 구역과 겹침 ${entry.covered}/${entry.corners}</span><span>선택 밖 코너 #${entry.counterexampleId}</span></li>`).join("")}</ol></details>`;
}

function historyEntry(experiment, evaluation, policy = policyLabel(), policyId = null) {
  const verdict = thresholdVerdict(evaluation);
  return { matchName: experiment.resultName, policy, policyId, verdict: verdict?.label ?? "판단 보류", covered: evaluation.covered.length, corners: evaluation.trials.length, counterexampleId: evaluation.counterexample.provenance.corner_event_id };
}

function roleTradeoffMarkup(evaluation = null) {
  const outlet = evaluation
    ? { contacts: evaluation.outletContacts.length, corners: evaluation.trials.length }
    : report.policy_campaign.reference_outlet_context;
  const zoneCount = state.selected.length;
  if (zoneCount === 0 && !evaluation) return "";
  return `<div class="role-tradeoff" data-testid="role-tradeoff">
    <div><span>위치 검토 범위</span><strong>${zoneCount}개 구역</strong><small>${state.outletKept ? "수비 리더 1명 배치" : zoneCount === 2 ? "두 역할을 수비에 배치" : "수비 리더를 먼저 배치"}</small></div>
    <div><span>역습 역할</span><strong>${state.outletKept ? "전방 유지" : zoneCount === 2 ? "수비 전환" : "결정 필요"}</strong><small>효과는 데이터로 계산하지 않음</small></div>
    <div><span>참고 · 역습 대기 구역</span><strong>${outlet.contacts}/${outlet.corners}</strong><small>수비팀 패스·걷어내기 기록 · 결과와 합산 안 함</small></div>
  </div>`;
}

function render() {
  const experiment = currentExperiment();
  const evaluation = state.revealed ? evaluatePolicy(experiment) : null;
  const campaign = report.policy_campaign;
  const scouting = report.team_scouting;
  const dossier = scouting.first_fixed_round_of_16_example;
  const matchup = scouting.matchup_challenger;
  const matchupGain = matchup.partition_scores.all_knockout
    .improvement_vs_opponent_only.log_loss_reduction_rate * 100;
  const matchupProbability = matchup.bootstrap.probability_gain_above_zero * 100;
  const finalStage = experiment.kind === "final";
  const verdict = evaluation ? thresholdVerdict(evaluation) : null;
  app.innerHTML = `
    <header class="hero">
      <p class="eyebrow">CORNER POLICY LAB · 2018 월드컵 코너킥 기록</p>
      <h1>${DEMO_OPPONENT}전 코너킥 수비,<br><span>두 역할을 어디에 둘까요?</span></h1>
      <p class="hero-copy"><strong>${DEMO_OPPONENT} 조별리그 코너 ${dossier.opponent_group_stage_classified_corners}개와 대회 전체 기록을 함께 보고 선택하세요.</strong> 결과를 보기 전에 수비 구역과 기준을 확정하면, 2018 월드컵 토너먼트 16경기에 같은 선택을 적용해 선택하지 않은 구역으로 간 코너 기록까지 보여줍니다.</p>
      <div class="boundary"><strong>실제 코너 전달이 선택한 구역으로 왔는지만 확인합니다.</strong> 수비 성공이나 승리 확률을 예측하지 않습니다.</div>
      <div class="campaign-map" aria-label="고정 경기 분할"><div><strong>48경기</strong><span>조별리그에서 기준 정하기</span></div><b>→</b><div><strong>8경기</strong><span>16강에서 첫 확인</span></div><b>→</b><div class="sealed"><strong>8경기</strong><span>8강 이후 마지막 확인</span></div></div>
    </header>
    <section class="stage" aria-labelledby="policy-title" data-partitions-disjoint="${campaign.partitions_disjoint}" data-stage="${state.stage}">
      <div class="round"><span>${experiment.label}</span><span>16강 확인 기록 ${state.history.length}개</span></div>
      <div class="phase"><span class="active">1 먼저 정하기</span><span class="${state.locked ? "active" : ""}">2 결과 전에 확정</span><span class="${state.revealed ? "active" : ""}">3 실제 기록 확인</span><span class="${finalStage && state.counterexampleOpen ? "active" : ""}">4 다음 회의 메모</span></div>
      <h2 id="policy-title">수비 역할 2명을 어떻게 쓸지 정하세요 <small role="status" aria-live="polite" aria-atomic="true" data-testid="selection-count">${state.selected.length}/2</small></h2>
      <p class="tradeoff">한 명은 수비 구역에 둡니다. 다른 한 명은 두 번째 구역을 맡기거나, 역습을 위해 앞에 남길 수 있습니다.</p>
      <div class="team-context" data-testid="team-context">
        <strong>① 상대 공격 성향 · ${DEMO_OPPONENT} 조별리그 ${dossier.opponent_group_stage_classified_corners}개</strong>
        <span>근거 비중 ${DEMO_OPPONENT} ${(dossier.opponent_evidence_weight * 100).toFixed(0)}% · 대회 전체 ${(dossier.tournament_prior_weight * 100).toFixed(0)}%</span>
        <strong class="rejected">② ${DEMO_MANAGER} 수비까지 결합 · 채택 안 함</strong>
        <span>전체 오차 ${matchupGain.toFixed(2)}%↓ · 개선 확률 ${matchupProbability.toFixed(1)}% &lt; 기준 97.5%</span>
        <small>${DEMO_MANAGER}가 조별리그에서 수비한 코너는 ${dossier.manager_group_stage_defensive_exposure_classified_corners}/${dossier.manager_group_stage_defensive_exposure_source_corners}뿐입니다. 두 팀 결합안의 95% 불확실성 구간이 0을 지나므로, 아래 확률에는 ${DEMO_OPPONENT} 공격 기록만 반영했습니다.</small>
      </div>
      <div class="policy-layout">
        <div class="pitch" role="group" aria-label="코너 수비 역할 배치 지도"><span class="corner" aria-hidden="true">●</span><span class="outlet-position ${state.outletKept ? "kept" : ""}" aria-hidden="true">역습 대기</span>${LANES.map((lane) => {
          const roleIndex = state.selected.indexOf(lane);
          const token = roleIndex === 0 ? '<i class="role-marker">1</i>' : roleIndex === 1 ? '<i class="role-marker outlet-role">2</i>' : "";
          return `<button type="button" data-zone-lane="${lane}" aria-label="${LABEL[lane]}에 주의 토큰 배치" aria-pressed="${state.selected.includes(lane)}" class="zone zone-${lane} ${state.selected.includes(lane) ? "selected" : ""} ${evaluation?.trials.some((trial) => trial.observed_action.value === lane) ? "observed" : ""}" ${state.locked ? "disabled" : ""}>${token}${SHORT[lane]}</button>`;
        }).join("")}</div>
        <div><div class="lane-cards" aria-label="수비 역할 우선 구역 선택">${LANES.map(trainingCard).join("")}</div>
          <button class="outlet-choice" type="button" data-action="keep-outlet" aria-pressed="${state.outletKept}" ${state.locked || state.selected.length === 0 ? "disabled" : ""}><span>역습 역할 1명</span><strong>${state.outletKept ? "전방 유지 선택됨" : state.selected.length === 2 ? "수비 전환 선택됨" : "전방에 남기기"}</strong><small>역습 대기 구역의 당시 기록은 결과와 따로 확인</small></button>
        </div>
      </div>
      ${roleTradeoffMarkup(evaluation)}
      <div class="forecast-audit" data-testid="forecast-audit"><span>상대 공격 분포 점검</span><strong>16강 예측 오차 2.14%↓ · 8강 이후 7.21%↓</strong><small>로그손실 기준 · 16팀 중 12팀 개선, 4팀 악화 · 상위 두 구역만 뽑으면 대회 평균안과 전체 적중 수가 같아 자동 추천하지 않음</small></div>
      ${!state.locked ? `<fieldset class="threshold-picker"><legend>실제 코너 전달 중 몇 %가 선택 구역으로 오면 통과로 볼까요?</legend><div>${[40, 50, 60].map((value) => `<button type="button" data-threshold="${value / 100}" aria-label="최소 위치 겹침률 ${value}% 선택" aria-pressed="${state.minimumOverlap === value / 100}">${value}%</button>`).join("")}</div><p>결과를 보기 전에 정하는 확인 기준입니다. 수비 성공률이나 승리 확률이 아닙니다.</p></fieldset>` : ""}
      ${!state.locked && finalStage ? `<div class="policy-actions"><button class="primary" type="button" data-action="final-verify" ${staffingReady() && state.minimumOverlap !== null ? "" : "disabled"}>이 선택을 확정하고 마지막 8경기 확인</button><button class="secondary" type="button" data-action="final-abstain">선택을 보류하고 마지막 8경기 확인</button></div>` : !state.locked ? `<div class="policy-actions"><button class="primary" type="button" data-action="quick-lock" ${staffingReady() && state.minimumOverlap !== null ? "" : "disabled"}>이 선택을 확정하고 16경기 확인</button><button class="secondary" type="button" data-action="quick-abstain">선택을 보류하고 16경기 확인</button></div><details class="manual-mode"><summary>16강 경기를 한 경기씩 확인하기</summary><button class="tertiary" type="button" data-action="lock" ${staffingReady() && state.minimumOverlap !== null ? "" : "disabled"}>첫 경기 선택만 확정</button></details>` : !state.revealed ? `
        <div class="receipt" data-testid="lock-receipt"><p><strong>${policyLabel()}</strong>${state.abstained ? "를 결과 공개 전에 선언했습니다." : " 선택을 결과 공개 전에 확정했습니다."}${state.policySnapshot ? ` <span>선택 번호 <span class="policy-id">${state.policySnapshot.fingerprint}</span></span>` : ""}</p><p>${state.abstained ? "" : `${staffingLabel()} · 통과 기준 ${Math.round(state.minimumOverlap * 100)}%도 함께 확정했습니다. `}${state.quickFixed ? "16강 8경기와 아직 보지 않은 8강 이후 8경기에 똑같이 적용합니다. 아직 어느 결과도 공개하지 않았습니다." : `${finalStage ? "8강 이후 8경기" : "이번 16강 경기"}의 이름과 코너 기록은 아직 숨겨져 있습니다.`}</p><button class="primary" type="button" data-action="reveal">${state.quickFixed ? "16강 8경기 결과 보기" : finalStage ? "마지막 8경기 결과 보기" : "이번 16강 경기 결과 보기"}</button></div>` : `
        <section class="scorecard" aria-labelledby="result-title">
          <p class="receipt-label">기준을 정한 48경기 → ${finalStage ? "마지막 확인 8경기" : state.quickFixed ? "16강 첫 확인 8경기" : `16강 경기 ${state.matchIndex + 1}/8`}</p><h2 id="result-title">${experiment.resultName} · ${state.abstained ? "판단 보류 결과" : `선택 구역과 겹침 ${evaluation.covered.length}/${evaluation.trials.length}`}</h2>
          ${opponentResultMarkup(finalStage)}
          ${verdict ? `<p class="threshold-verdict ${verdict.passed ? "passed" : "missed"}" data-testid="threshold-verdict"><strong>${verdict.label}</strong><span>실제 ${percentage(evaluation.covered.length, evaluation.trials.length)}% · 사전 기준 ${Math.round(state.minimumOverlap * 100)}%</span></p>` : ""}
          ${state.abstained ? `<div class="metrics"><div><strong>보류</strong><span>미리 정한 선택</span></div><div><strong>${new Set(evaluation.trials.map((trial) => trial.observed_action.value)).size}</strong><span>실제 전달 구역</span></div><div><strong>${evaluation.trials.filter((trial) => trial.observed_outcome.attacking_shot).length}</strong><span>10초 이내 슈팅 기록</span></div></div>` : `<div class="metrics"><div><strong>${percentage(evaluation.covered.length, evaluation.trials.length)}%</strong><span>선택 구역과 겹침</span></div><div><strong>${evaluation.uncovered.length}</strong><span>선택 밖 전달</span></div><div><strong>${evaluation.uncoveredShots.length}</strong><span>선택 밖 슈팅 기록</span></div></div>`}
          <p class="causal-warning">이 수치는 수비 성공률이 아닙니다. 선택 구역과의 겹침과 역습 대기 구역 참고 기록은 서로 더하지 않습니다. ${state.quickFixed ? `전달 위치를 확인할 수 없는 ${finalStage ? "2" : "5"}개 기록은 어느 구역에도 넣지 않았습니다. ` : ""}노란 역할 표시는 감독의 선택이며 실제 선수 도달, 수비 성공, 역습 성공을 뜻하지 않습니다.</p>
          <details class="event-ledger"><summary>${finalStage ? "마지막 확인" : state.quickFixed ? "16강 첫 확인" : "이번 경기"} 코너 ${evaluation.trials.length}개 기록표</summary><ol>${resultRows(evaluation)}</ol></details>
          <button class="skeptic" type="button" data-action="counterexample">선택 밖 코너 기록 보기</button>
          ${state.counterexampleOpen ? `<article class="counterexample" tabindex="-1" data-testid="counterexample"><p class="eyebrow">선택 밖 코너 기록</p><h3>${evaluation.reason}</h3><p>${evaluation.counterexample.provenance.match_name} · 코너 #${evaluation.counterexample.provenance.corner_event_id} · 실제 전달 ${LABEL[evaluation.counterexample.observed_action.value]}${evaluation.counterexample.observed_outcome.attacking_shot ? " · 10초 이내 슈팅 기록" : ""}</p><p>이 기록은 선택한 구역과 실제 전달 위치가 어디서 달랐는지 보여줍니다. 이 선택이 수비에 성공했는지, 경기 결과를 바꿨는지는 판단하지 않습니다.</p>${finalStage ? `<div class="final-receipt" data-testid="final-receipt"><strong>같은 선택으로 마지막 8경기 확인 완료 · ${verdict?.label ?? "판단 보류"}</strong><span>${state.quickFixed ? state.abstained ? `판단 보류 · 선택 변경 0회 · 처음 확정한 선택 ${state.policySnapshot.fingerprint}을 16강과 8강 이후 8경기에 그대로 적용했습니다.` : `${staffingLabel()} · 통과 기준 ${Math.round(state.minimumOverlap * 100)}% · 선택 변경 0회. 처음 확정한 선택 ${state.policySnapshot.fingerprint}을 16강과 8강 이후 8경기에 그대로 적용했습니다. 역습 대기 구역 참고 기록 ${evaluation.outletContacts.length}/${evaluation.trials.length}은 별도 기록이라 위치 겹침과 더하지 않습니다.` : `16강 확인 기록 ${state.history.length}개를 남긴 뒤, 같은 선택을 남겨 둔 8경기에 한 번만 적용했습니다.`}</span></div>${meetingNoteMarkup()}<details class="ontology-path"><summary>이 기록의 출처와 판단 범위 보기</summary>${contradictionPathMarkup(evaluation)}</details>` : `${state.quickFixed ? `<div class="fixed-policy-actions"><p>8강 이후 8경기는 아직 보지 않았습니다. 처음 확정한 선택${state.abstained ? "" : `과 통과 기준 ${Math.round(state.minimumOverlap * 100)}%`}을 다음 8경기에도 그대로 적용합니다.</p><button class="primary" type="button" data-action="quick-final">같은 선택으로 다음 8경기 확인</button></div>` : `<div class="revision-actions"><button class="primary" type="button" data-action="revise">확인 기록을 남기고 다음 경기 보기</button><button class="secondary" type="button" data-action="batch-rehearsal">같은 선택으로 남은 16강 확인</button></div>`}<details class="ontology-path"><summary>이 기록의 출처와 판단 범위 보기</summary>${contradictionPathMarkup(evaluation)}</details>`}</article>` : ""}
        </section>`}
      ${historyMarkup()}
    </section>
    <aside class="agent" aria-labelledby="agent-title">
      <div><p class="eyebrow">이 서비스가 말하지 않는 것</p><h2 id="agent-title">두 팀 결합안도 시험했지만, 근거가 약해 추천에는 쓰지 않았습니다.</h2><p>${DEMO_OPPONENT} 공격 기록을 반영한 네 구역의 분포와 선택 구역의 실제 겹침만 확인합니다. 선수의 도달, 수비 성공, 역습 성공, 경기 결과는 알 수 없습니다.</p></div>
      ${state.locked ? `<details><summary>근거·출처 경로</summary><ol class="path">${supportPath().map((item) => `<li>${item}</li>`).join("")}</ol></details>` : ""}
    </aside>`;
}

app.addEventListener("click", (event) => {
  const lane = event.target.closest("[data-lane]")?.dataset.lane;
  const zoneLane = event.target.closest("[data-zone-lane]")?.dataset.zoneLane;
  const threshold = event.target.closest("[data-threshold]")?.dataset.threshold;
  const action = event.target.closest("[data-action]")?.dataset.action;
  const selectedLane = lane ?? zoneLane;
  if (selectedLane && !state.locked) {
    const focusSelector = lane ? `[data-lane="${selectedLane}"]` : `[data-zone-lane="${selectedLane}"]`;
    const alreadySelected = state.selected.includes(selectedLane);
    const selected = alreadySelected
      ? state.selected.filter((item) => item !== selectedLane)
      : state.selected.length < 2 ? [...state.selected, selectedLane] : state.selected;
    const outletKept = alreadySelected && selected.length === 0 ? false :
      !alreadySelected && selected.length === 2 ? false : state.outletKept;
    state = { ...state, selected, outletKept };
    render();
    document.querySelector(focusSelector)?.focus();
    return;
  }
  if (threshold && !state.locked) {
    state = { ...state, minimumOverlap: Number(threshold) };
    render();
    document.querySelector(`[data-threshold="${threshold}"]`)?.focus();
    return;
  }
  if (action === "keep-outlet" && state.selected.length >= 1 && !state.locked) {
    state = state.outletKept
      ? { ...state, outletKept: false }
      : { ...state, selected: state.selected.slice(0, 1), outletKept: true };
  }
  else if (action === "lock" && staffingReady() && state.minimumOverlap !== null) state = { ...state, locked: true };
  else if (action === "quick-lock" && staffingReady() && state.minimumOverlap !== null && state.stage === "rehearsal") state = {
    ...state,
    locked: true,
    quickFixed: true,
    policySnapshot: {
      label: policyLabel(),
      minimumOverlap: state.minimumOverlap,
      outletKept: state.outletKept,
      fingerprint: policyFingerprint(state.selected),
    },
  };
  else if (action === "quick-abstain" && state.stage === "rehearsal") state = { ...state, selected: [], locked: true, abstained: true, quickFixed: true, policySnapshot: { label: "판단 보류", fingerprint: policyFingerprint([], true) } };
  else if (action === "final-verify" && staffingReady() && state.minimumOverlap !== null && state.stage === "final" && state.history.length === 8) state = { ...state, locked: true, revealed: true, counterexampleOpen: true };
  else if (action === "final-abstain" && state.stage === "final" && state.history.length === 8) state = { ...state, selected: [], locked: true, abstained: true, revealed: true, counterexampleOpen: true };
  else if (action === "abstain" && !state.locked) state = { ...state, selected: [], locked: true, abstained: true };
  else if (action === "reveal" && state.locked && !state.revealed) {
    if (state.quickFixed && state.stage === "rehearsal") {
      const policy = state.policySnapshot.label;
      const history = report.policy_campaign.rehearsal_matches.map((match, index) => {
        const experiment = { kind: "rehearsal", label: `16강 경기 ${index + 1}/8 확인`, resultName: match.match_name, trials: match.trials, matches: [match] };
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
    state = state.matchIndex === 7
      ? { ...freshState(), stage: "final", selected: [...state.selected], outletKept: state.outletKept, history }
      : { ...freshState(), matchIndex: state.matchIndex + 1, outletKept: state.outletKept, history };
  } else if (action === "batch-rehearsal" && state.counterexampleOpen && state.stage === "rehearsal") {
    const history = [...state.history];
    for (let index = state.matchIndex; index < report.policy_campaign.rehearsal_matches.length; index += 1) {
      const match = report.policy_campaign.rehearsal_matches[index];
      const experiment = { kind: "rehearsal", label: `16강 경기 ${index + 1}/8 확인`, resultName: match.match_name, trials: match.trials, matches: [match] };
      history.push(historyEntry(experiment, evaluatePolicy(experiment)));
    }
    state = { ...freshState(), stage: "final", selected: [...state.selected], outletKept: state.outletKept, history };
  } else if (action === "restart") state = freshState();
  else return;
  render();
  if (action === "counterexample" || action === "reveal" && state.quickFixed || action === "quick-final" || action === "final-verify" || action === "final-abstain") document.querySelector("[data-testid=counterexample]")?.focus();
  else if (action === "lock" || action === "quick-lock" || action === "quick-abstain") document.querySelector('[data-action="reveal"]')?.focus();
  else if (action === "restart") document.querySelector('[data-zone-lane="short"]')?.focus();
});

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
