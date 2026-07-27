const LANES = ["short", "near", "central-far", "other"];
const LABEL = {
  short: "숏 코너",
  near: "니어포스트",
  "central-far": "중앙·파포스트",
  other: "그 밖의 전달",
};
const TRAINING_REPS = 10;

const app = document.querySelector("#app");
let report;
let state = freshState();

function freshState() {
  return {
    allocation: Object.fromEntries(LANES.map((lane) => [lane, 0])),
    locked: false,
    revealed: false,
  };
}

function validate(value) {
  const scouting = value?.team_scouting;
  const example = scouting?.first_fixed_round_of_16_example;
  const probabilitySum = Object.values(example?.opponent_posterior_probabilities ?? {})
    .reduce((sum, probability) => sum + probability, 0);
  if (value?.population?.source_corners !== 603 ||
      value?.policy_campaign?.reference_match_ids?.length !== 48 ||
      scouting?.status !== "PASS" ||
      scouting?.model?.selection_data !== "group-stage reference only" ||
      example?.match_name !== "Uruguay - Portugal" ||
      example?.held_out_opponent_classified_corners !== 10 ||
      Math.abs(probabilitySum - 1) > Number.EPSILON * 8 ||
      scouting?.claim_boundary?.missing_endpoints_are_excluded !== true) {
    throw new Error("불러온 자료가 상대팀 스카우팅 계약과 일치하지 않습니다.");
  }
  return value;
}

function percent(value, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

function dossier() {
  return report.team_scouting.first_fixed_round_of_16_example;
}

function allocated() {
  return LANES.reduce((sum, lane) => sum + state.allocation[lane], 0);
}

function adjustAllocation(lane, delta) {
  if (state.locked) return;
  const next = state.allocation[lane] + delta;
  if (next < 0 || next > TRAINING_REPS || allocated() + delta > TRAINING_REPS) return;
  state.allocation = { ...state.allocation, [lane]: next };
}

function laneCards(current) {
  const tournament = report.team_scouting.reference.tournament_probabilities;
  return LANES.map((lane) => {
    const team = current.opponent_posterior_probabilities[lane];
    const raw = current.opponent_group_stage_action_counts[lane];
    const count = state.allocation[lane];
    return `<article class="lane" data-lane-card="${lane}">
      <span class="lane-title"><strong>${LABEL[lane]}</strong><em>조별리그 ${raw}회</em></span>
      <span class="bars" aria-hidden="true">
        <i class="team-bar" style="--value:${team}"></i>
        <i class="base-bar" style="--value:${tournament[lane]}"></i>
      </span>
      <span class="numbers"><b>예상 ${percent(team, 1)}</b><small>대회 ${percent(tournament[lane], 1)}</small></span>
      <div class="allocator">
        <button type="button" data-adjust="-1" data-lane="${lane}" aria-label="${LABEL[lane]} 훈련 1회 빼기" ${state.locked || count === 0 ? "disabled" : ""}>−</button>
        <span aria-live="polite"><strong>${count}</strong><small>회</small></span>
        <button type="button" data-adjust="1" data-lane="${lane}" aria-label="${LABEL[lane]} 훈련 1회 추가" ${state.locked || allocated() === TRAINING_REPS ? "disabled" : ""}>+</button>
      </div>
      <div class="tokens" aria-hidden="true">${Array.from({ length: count }, () => "<i></i>").join("")}</div>
    </article>`;
  }).join("");
}

function comparisonRow(label, values, className = "") {
  return `<div class="comparison-row ${className}">
    <strong>${label}</strong>
    ${LANES.map((lane) => `<span>${values[lane]}</span>`).join("")}
  </div>`;
}

function resultMarkup(current) {
  if (!state.revealed) return "";
  const predicted = Object.fromEntries(LANES.map((lane) => [
    lane,
    (current.opponent_posterior_probabilities[lane] * TRAINING_REPS).toFixed(1),
  ]));
  return `<section class="result" data-testid="scouting-result" tabindex="-1">
    <p class="eyebrow">잠가 둔 경기 기록 공개</p>
    <h2>우루과이–포르투갈 · 포르투갈의 실제 코너 10개</h2>
    <div class="comparison" role="table" aria-label="훈련 배분, 사전 확률, 실제 전달 위치 비교">
      <div class="comparison-row headings"><strong></strong>${LANES.map((lane) => `<span>${LABEL[lane]}</span>`).join("")}</div>
      ${comparisonRow("내 훈련 배분", state.allocation, "user-row")}
      ${comparisonRow("사전 분포 × 10", predicted)}
      ${comparisonRow("실제 기록", current.held_out_opponent_action_counts, "actual-row")}
    </div>
    <p class="boundary"><strong>이 표는 훈련의 효과나 정답을 매기지 않습니다.</strong> 회의 전에 본 상대 분포와 이후 기록이 어디서 맞고 빗나갔는지만 비교합니다.</p>
    ${current.held_out_opponent_placeholder_corners > 0
      ? `<p class="missing">이 경기의 끝점 미분류 ${current.held_out_opponent_placeholder_corners}개는 계산에서 제외했습니다.</p>`
      : ""}
    <button class="restart" type="button" data-action="restart">배분 다시 해보기</button>
  </section>`;
}

function render() {
  const scouting = report.team_scouting;
  const current = dossier();
  const used = allocated();
  const remaining = TRAINING_REPS - used;
  app.innerHTML = `
    <header class="hero">
      <p class="eyebrow">SET PIECE SCOUT · 2018 WORLD CUP</p>
      <h1>포르투갈전 코너 수비 훈련 10회,<br><span>어디에 배분할까요?</span></h1>
      <p>조별리그 코너 14개와 대회 전체 기록을 함께 보고, 네 구역에 훈련 횟수를 나눠 보세요. 결과를 보기 전에 배분을 잠급니다.</p>
      <aside><strong>수비 위치나 승률을 추천하지 않습니다.</strong> 2018년 코너 전달 위치를 바탕으로 경기 전 훈련 회의를 돕는 도구입니다.</aside>
    </header>

    <section class="workspace" data-team-scouting-status="${scouting.status}">
      <div class="matchup">
        <strong>16강 · 우루과이 수비 vs 포르투갈 코너</strong>
        <span>맞대결 결과는 배분을 잠글 때까지 가려 둡니다.</span>
      </div>

      <div class="briefing">
        <div>
          <p class="eyebrow">상대팀 조별리그 브리핑</p>
          <h2>포르투갈 코너 ${current.opponent_group_stage_classified_corners}개와 대회 전체 기록을 함께 반영했습니다</h2>
          <p>계산에 반영한 비중 · 포르투갈 <strong>${percent(current.opponent_evidence_weight)}</strong> · 대회 전체 <strong>${percent(current.tournament_prior_weight)}</strong></p>
        </div>
        <div class="support">
          <span>포르투갈 조별리그 코너</span>
          <strong>${current.opponent_group_stage_classified_corners}/${current.opponent_group_stage_source_corners}</strong>
          <small>전달 위치를 분류한 코너</small>
        </div>
        <div class="support">
          <span>우루과이가 수비한 코너</span>
          <strong>${current.manager_group_stage_defensive_exposure_classified_corners}/${current.manager_group_stage_defensive_exposure_source_corners}</strong>
          <small>별도 참고 · 예측에는 합치지 않음</small>
        </div>
      </div>

      <div class="legend"><span><i class="team-key"></i>포르투갈 예상 분포</span><span><i class="base-key"></i>대회 평균</span></div>
      <div class="lane-grid" aria-label="코너 수비 훈련 10회 배분">${laneCards(current)}</div>

      <div class="commit">
        <div>
          <span>훈련 배분</span>
          <strong data-testid="allocation-summary">${used}회 배분 · ${remaining}회 남음</strong>
          <small>${state.locked ? "맞대결 결과를 보기 전에 잠갔습니다." : "자동 추천 없이 직접 10회를 모두 나누세요."}</small>
        </div>
        ${!state.locked
          ? `<button type="button" data-action="lock" ${remaining === 0 ? "" : "disabled"}>이 배분을 결과 보기 전에 잠그기</button>`
          : !state.revealed
            ? `<button type="button" data-action="reveal">가려 둔 맞대결 기록 보기</button>`
            : ""}
      </div>
      <p class="always-boundary">이 분포는 2018년 기록된 코너 전달 위치의 확률입니다. 훈련 배분의 효과, 수비 성공, 실점 방지 또는 최적 전술을 뜻하지 않습니다. 위치를 확인할 수 없는 코너는 제외했습니다.</p>
      ${resultMarkup(current)}
    </section>

    <section class="audit">
      <div>
        <p class="eyebrow">예측 모델 전체 점검 · 사용자의 훈련 배분 성과가 아님</p>
        <h2>조별리그 48경기로 만든 팀 분포가, 미리 보지 않은 토너먼트 코너 160개의 전달 위치를 대회 평균보다 더 잘 예측했습니다.</h2>
      </div>
      <div class="audit-metrics">
        <article><strong>2.14%↓</strong><span>16강 8경기 예측 오차 · 로그손실</span></article>
        <article><strong>7.21%↓</strong><span>8강 이후 8경기 예측 오차 · 로그손실</span></article>
        <article><strong>12/16</strong><span>개선된 팀 · 4팀은 악화</span></article>
      </div>
      <p>전체 16경기에서는 로그손실이 4.59% 줄었습니다. 단, 각 팀의 상위 두 구역만 뽑으면 대회 평균 상위 두 구역과 전체 적중 수가 같았습니다. 그래서 “최적 두 곳”이나 자동 배분은 추천하지 않습니다.</p>
      <details>
        <summary>자료와 판단 범위</summary>
        <ul>
          <li>조별리그 48경기 397개로만 보정 강도와 팀별 확률을 정했습니다.</li>
          <li>16강 84개와 8강 이후 76개는 확률 예측을 점검할 때만 열었습니다.</li>
          <li>603개 중 전달이 끝난 위치를 분류할 수 없는 46개는 제외하고 수를 공개합니다.</li>
          <li>선수 위치, 대인·지역 방어 역할, 선수 도달 범위, xG, 다른 배치를 했을 때의 결과는 이 자료에 없습니다.</li>
          <li>Pappalardo &amp; Massucco Wyscout World Cup 2018 Events/Matches · CC BY 4.0.</li>
        </ul>
      </details>
    </section>`;
}

app.addEventListener("click", (event) => {
  const adjuster = event.target.closest("[data-adjust]");
  if (adjuster) {
    adjustAllocation(adjuster.dataset.lane, Number(adjuster.dataset.adjust));
    render();
    document.querySelector(`[data-lane="${adjuster.dataset.lane}"][data-adjust="${adjuster.dataset.adjust}"]`)?.focus();
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "lock" && allocated() === TRAINING_REPS) {
    state.locked = true;
  } else if (action === "reveal" && state.locked) {
    state.revealed = true;
  } else if (action === "restart") {
    state = freshState();
  } else {
    return;
  }
  render();
  if (action === "reveal") document.querySelector("[data-testid=scouting-result]")?.focus();
  if (action === "restart") document.querySelector('[data-lane="short"][data-adjust="1"]')?.focus();
});

try {
  const reportUrl = document.querySelector('meta[name="policy-report"]')?.content ??
    "../../data/audit/policy-lab-spike.json";
  report = validate(await fetch(reportUrl, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`보고서를 불러오지 못했습니다: ${response.status}`);
    return response.json();
  }));
  render();
} catch (error) {
  app.innerHTML = `<section class="error" role="alert"><h1>상대팀 브리핑을 열 수 없습니다.</h1><p>${error instanceof Error ? error.message : "알 수 없는 오류"}</p></section>`;
}
