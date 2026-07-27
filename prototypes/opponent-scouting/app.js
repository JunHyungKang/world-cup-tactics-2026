const SITUATIONS = [
  "short-recorded-endpoint",
  "aerial-recorded-follow-up",
  "other-recorded-follow-up",
];
const SIGNATURES = [
  "short-attacking-first",
  "aerial-attacking-first",
  "aerial-defending-first",
  "other-attacking-first",
  "other-defending-first",
];
const LABEL = {
  "short-attacking-first": "숏 구역 전달 뒤 · 공격팀 먼저 기록",
  "aerial-attacking-first": "공중 경합·헤더 뒤 · 공격팀 먼저 기록",
  "aerial-defending-first": "공중 경합·헤더 뒤 · 수비팀 먼저 기록",
  "other-attacking-first": "그 밖의 전개 뒤 · 공격팀 먼저 기록",
  "other-defending-first": "그 밖의 전개 뒤 · 수비팀 먼저 기록",
};
const DESCRIPTION = {
  "short-attacking-first": "숏 구역으로 보낸 뒤 첫 후속 이벤트가 공격팀",
  "aerial-attacking-first": "공중 경합·헤더 뒤 첫 후속 이벤트가 공격팀",
  "aerial-defending-first": "공중 경합·헤더 뒤 첫 후속 이벤트가 수비팀",
  "other-attacking-first": "그 밖의 코너 전개 뒤 첫 후속 이벤트가 공격팀",
  "other-defending-first": "그 밖의 코너 전개 뒤 첫 후속 이벤트가 수비팀",
};
const QUESTION = {
  "short-attacking-first": "숏 구역으로 전달된 뒤 포르투갈 이벤트가 먼저 기록된 장면을 볼까요?",
  "aerial-attacking-first": "공중 경합·헤더 뒤 포르투갈 이벤트가 먼저 기록된 장면을 볼까요?",
  "aerial-defending-first": "공중 경합·헤더 뒤 상대 수비팀 이벤트가 먼저 기록된 장면을 볼까요?",
  "other-attacking-first": "그 밖의 코너 전개 뒤 포르투갈 이벤트가 먼저 기록된 장면을 볼까요?",
  "other-defending-first": "그 밖의 코너 전개 뒤 상대 수비팀 이벤트가 먼저 기록된 장면을 볼까요?",
};
const EVENT_LABEL = {
  Pass: "패스",
  Duel: "경합",
  "Others on the ball": "볼 처리",
  "No recorded event": "기록 없음",
  "Simple pass": "일반 패스",
  Cross: "크로스",
  "Air duel": "공중 경합",
  "Head pass": "헤더 패스",
  Clearance: "걷어내기",
  "Ground attacking duel": "지상 공격 경합",
  "Ground defending duel": "지상 수비 경합",
  "Ground loose ball duel": "세컨드볼 경합",
  "Goalkeeper leaving line": "골키퍼 전진",
  Touch: "터치",
};
const PRIORITY_COUNT = 2;
const REFERENCE_MATCH_COUNT = 3;
const MEETING_DECISIONS = {
  keep: "선택한 두 안건을 다음 회의에서도 유지",
  revise: "다음 회의에서 영상 검토 안건 다시 선택",
  defer: "근거가 부족해 결정 보류",
};

const app = document.querySelector("#app");
let report;
let state = freshState();

function freshState() {
  return {
    priorities: [],
    locked: false,
    revealed: false,
    meetingNote: null,
  };
}

function validate(value) {
  const scouting = value?.team_scouting;
  const situation = scouting?.corner_situation_rehearsal;
  const referenceTotal = Object.values(situation?.opponent_attack_reference?.situation_counts ?? {})
    .reduce((sum, count) => sum + count, 0);
  const heldOutTotal = Object.values(situation?.held_out_match?.situation_counts ?? {})
    .reduce((sum, count) => sum + count, 0);
  const exactCounts = (actual, expected) =>
    SITUATIONS.every((key) => actual?.[key] === expected[key]) &&
    Object.keys(actual ?? {}).length === SITUATIONS.length;
  const joins = Object.values(situation?.player_join_coverage ?? {});
  const board = situation?.matchup_question_board;
  const receipts = (board?.questions ?? []).flatMap((question) => [
    ...(question.opponent_attack?.event_receipts ?? []),
    ...(question.manager_defensive_exposure?.event_receipts ?? []),
    ...(question.held_out_evidence?.event_receipts ?? []),
  ]);
  if (value?.transform_version !== "policy-lab-spike-v11-source-time-receipts" ||
      value?.population?.source_corners !== 603 ||
      value?.policy_campaign?.reference_match_ids?.length !== 48 ||
      scouting?.status !== "PASS" ||
      situation?.status !== "PASS" ||
      situation?.opponent_attack_reference?.team_name !== "Portugal" ||
      situation?.manager_defensive_reference?.team_name !== "Uruguay" ||
      situation?.held_out_match?.match_name !== "Uruguay - Portugal" ||
      referenceTotal !== 14 ||
      heldOutTotal !== 10 ||
      !exactCounts(situation?.opponent_attack_reference?.situation_counts, {
        "short-recorded-endpoint": 7,
        "aerial-recorded-follow-up": 5,
        "other-recorded-follow-up": 2,
      }) ||
      !exactCounts(situation?.manager_defensive_reference?.situation_counts, {
        "short-recorded-endpoint": 2,
        "aerial-recorded-follow-up": 2,
        "other-recorded-follow-up": 1,
      }) ||
      !exactCounts(situation?.held_out_match?.situation_counts, {
        "short-recorded-endpoint": 5,
        "aerial-recorded-follow-up": 2,
        "other-recorded-follow-up": 3,
      }) ||
      joins.length !== 12 ||
      joins.some((coverage) => coverage.missing !== 0 ||
        coverage.joined !== coverage.source_events_with_actor) ||
      board?.status !== "PASS" ||
      board?.selection_contract?.priority_count !== PRIORITY_COUNT ||
      board?.questions?.length !== SIGNATURES.length ||
      !SIGNATURES.every((signature) => board.questions.some((question) => question.id === signature)) ||
      receipts.length !== 29 ||
      receipts.some((receipt) => !["1H", "2H", "E1", "E2"].includes(receipt.period) ||
        !Number.isFinite(receipt.corner_second) || receipt.corner_second < 0) ||
      scouting?.status !== "PASS" ||
      scouting?.reference?.matches !== 48 ||
      scouting?.reference?.classified_corners !== 397 ||
      scouting?.teams_evaluated !== 16 ||
      scouting?.teams_improved !== 12 ||
      scouting?.first_fixed_round_of_16_example?.opponent_group_stage_classified_corners !== 14 ||
      scouting?.first_fixed_round_of_16_example?.manager_group_stage_defensive_exposure_classified_corners !== 5 ||
      scouting?.first_fixed_round_of_16_example?.held_out_opponent_classified_corners !== 10 ||
      scouting?.bootstrap?.mean_log_score_gain_per_corner_interval?.lower_95 <= 0 ||
      scouting?.matchup_challenger?.status !== "REJECT" ||
      !value?.provenance?.source_ids?.includes("pappalardo-wyscout-players")) {
    throw new Error("불러온 자료가 팀별 코너 첫 전개 계약과 일치하지 않습니다.");
  }
  return value;
}

function routineAudit() {
  return report.team_scouting.corner_situation_rehearsal;
}

function priorityCount() {
  return state.priorities.length;
}

function priorityMix(audit) {
  if (state.priorities.length === 0) return "사전 기록에서 찾지 못한 장면과 이미 겪은 장면을 함께 비교할 수 있습니다.";
  const selected = state.priorities.map((signature) => questionFor(audit, signature));
  const gaps = selected.filter((question) =>
    question.manager_defensive_exposure.corners === 0).length;
  const seen = selected.length - gaps;
  return `사전 관찰 공백 ${gaps}개 · 우루과이도 겪은 장면 ${seen}개`;
}

function selectedQuestionLabels() {
  if (state.priorities.length === 0) return "아직 선택한 안건이 없습니다.";
  return state.priorities.map((signature) => LABEL[signature]).join(" · ");
}

function togglePriority(routine) {
  if (state.locked) return;
  if (state.priorities.includes(routine)) {
    state.priorities = state.priorities.filter((candidate) => candidate !== routine);
    return;
  }
  if (priorityCount() >= PRIORITY_COUNT) return;
  state.priorities = [...state.priorities, routine];
}

function questionFor(audit, signature) {
  return audit.matchup_question_board.questions.find((question) => question.id === signature);
}

function names(players, limit = 2) {
  if (!players?.length) return "기록 없음";
  return players.slice(0, limit).map((player) => `${player.display_name} ${player.count}회`).join(" · ");
}

function eventName(recordedEvent) {
  if (!recordedEvent) return "기록 없음";
  const labels = [recordedEvent.event_name, recordedEvent.sub_event_name]
    .filter(Boolean)
    .map((value) => EVENT_LABEL[value] ?? value);
  return [...new Set(labels)].join(" · ");
}

function matchTime(receipt) {
  const offsets = { "1H": 0, "2H": 45, E1: 90, E2: 105 };
  const periodLabels = { "1H": "전반", "2H": "후반", E1: "연장 전반", E2: "연장 후반" };
  const period = String(receipt.period);
  const second = Number(receipt.corner_second);
  if (!(period in offsets) || !Number.isFinite(second) || second < 0) return "경기 시각 기록 없음";
  const totalSeconds = Math.floor(offsets[period] * 60 + second);
  const minute = Math.floor(totalSeconds / 60);
  const remainder = String(totalSeconds % 60).padStart(2, "0");
  return `${periodLabels[period]} · ${minute}:${remainder}`;
}

function distinctMatches(card) {
  return new Set(card.event_receipts.map((receipt) => receipt.match_id)).size;
}

function percent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function modelContextMarkup() {
  const scouting = report.team_scouting;
  const dossier = scouting.first_fixed_round_of_16_example;
  const baseline = scouting.reference.tournament_probabilities;
  const portugal = dossier.opponent_posterior_probabilities;
  const improvement = scouting.partition_scores.all_knockout.improvement.log_loss_reduction_rate;
  const challenger = scouting.matchup_challenger;
  const challengerImprovement =
    challenger.partition_scores.all_knockout.improvement_vs_opponent_only.log_loss_reduction_rate;
  const challengerProbability = challenger.bootstrap.probability_gain_above_zero;
  const improvedTeams = scouting.teams_improved;
  const evaluatedTeams = scouting.teams_evaluated;
  return `<section class="model-context" data-testid="team-model">
    <div class="model-copy">
      <p class="eyebrow">작은 표본을 그대로 믿지 않는 팀 분석</p>
      <h2>포르투갈 코너 14개를 월드컵 조별리그 397개로 보정했습니다.</h2>
      <p>포르투갈 기록과 대회 전체 기록을 부분 풀링해, 코너가 어느 전달 구역에 기록될지 추정합니다. 단순 횟수나 “좋은 위치”의 순위가 아닙니다.</p>
    </div>
    <div class="model-metrics">
      <article><span>포르투갈 근거 비중</span><strong>${percent(dossier.opponent_evidence_weight, 0)}</strong><small>조별리그 코너 14개</small></article>
      <article><span>대회 사전정보 비중</span><strong>${percent(dossier.tournament_prior_weight, 0)}</strong><small>조별리그 48경기</small></article>
      <article><span>보지 않은 경기 검증</span><strong>${percent(improvement)}</strong><small>토너먼트 160개 · ${evaluatedTeams}팀 중 ${improvedTeams}팀 개선</small></article>
    </div>
    <div class="model-shift" aria-label="대회 평균과 포르투갈 팀 보정 전달 구역 비교">
      <article>
        <span>대회 평균 상위 구역</span>
        <strong>중앙·파 ${percent(baseline["central-far"])} · 니어 ${percent(baseline.near)}</strong>
      </article>
      <b aria-hidden="true">→</b>
      <article>
        <span>포르투갈 보정 상위 구역</span>
        <strong>중앙·파 ${percent(portugal["central-far"])} · 숏 ${percent(portugal.short)}</strong>
      </article>
    </div>
    <p class="model-boundary"><strong>우루과이 수비 5개는 예측에 섞지 않았습니다.</strong> 두 팀 결합안은 로그손실을 ${percent(challengerImprovement)} 낮췄지만, 개선 확률 ${percent(challengerProbability)}가 사전 기준 97.5%에 못 미쳤습니다. 아래에서는 우루과이 기록을 확률이 아니라 원본 장면 검토 근거로만 연결합니다.</p>
  </section>`;
}

function evidenceCue(signature, question) {
  const attack = question.opponent_attack.corners;
  const defense = question.manager_defensive_exposure.corners;
  const attackMatches = distinctMatches(question.opponent_attack);
  const defenseMatches = distinctMatches(question.manager_defensive_exposure);
  if (signature === "short-attacking-first") {
    return `포르투갈 ${attack}장면이 ${attackMatches}/${REFERENCE_MATCH_COUNT}경기에서 반복됐고, 우루과이는 ${defense}장면을 ${defenseMatches}/${REFERENCE_MATCH_COUNT}경기에서 겪었습니다. 양쪽 모두 숏 구역 전달 뒤 공격팀 이벤트가 먼저 기록됐습니다.`;
  }
  if (signature === "aerial-attacking-first") {
    return `포르투갈 ${attack}장면은 ${attackMatches}/${REFERENCE_MATCH_COUNT}경기, 우루과이의 ${defense}장면은 ${defenseMatches}/${REFERENCE_MATCH_COUNT}경기에서 기록됐습니다. 양쪽 모두 공중 경합·헤더 뒤 공격팀 이벤트가 먼저 기록됐습니다.`;
  }
  if (defense === 0) {
    return `포르투갈 ${attack}장면이 ${attackMatches}/${REFERENCE_MATCH_COUNT}경기에서 반복됐지만, 우루과이의 ${REFERENCE_MATCH_COUNT}경기 수비 기록에서는 같은 두 축 분류를 확인하지 못했습니다. 약점이 아니라 관찰 공백입니다.`;
  }
  return `포르투갈 ${attack}장면은 ${attackMatches}/${REFERENCE_MATCH_COUNT}경기, 우루과이의 ${defense}장면은 ${defenseMatches}/${REFERENCE_MATCH_COUNT}경기에서 기록됐습니다. 작은 표본이라 장면 원장을 함께 봐야 합니다.`;
}

function exposureBadge(corners) {
  if (corners === 0) return "관찰 0회 · 약점 판정 아님";
  if (corners === 1) return "1회 관찰 · 표본 한 장면";
  return `같은 분류 ${corners}회`;
}

function sceneRows(card, perspective) {
  return `<ol class="scene-ledger">
    ${card.event_receipts.map((receipt) => {
      const followUp = receipt.first_recorded_follow_up;
      const defending = receipt.first_recorded_defending_event;
      const recordedEvent = perspective === "attack" ? followUp : defending;
      const nextActor = perspective === "attack"
        ? followUp.actor?.display_name ?? "선수 기록 없음"
        : defending.actor?.display_name ?? "선수 기록 없음";
      const nextLabel = perspective === "attack" ? "첫 후속 기록" : "우루과이 첫 수비 기록";
      return `<li>
        <span>${escapeHtml(receipt.match_name)}</span>
        <strong>${escapeHtml(receipt.corner_taker?.display_name ?? "키커 기록 없음")} → ${escapeHtml(nextActor)}</strong>
        <small>${nextLabel} · ${escapeHtml(eventName(recordedEvent))}</small>
        <em>${receipt.attacking_shot_within_10_seconds ? "10초 안 슈팅 기록" : "10초 안 슈팅 없음"}</em>
        <code>${matchTime(receipt)} · corner ${receipt.corner_event_id} · event ${recordedEvent?.source_event_id ?? "기록 없음"}</code>
      </li>`;
    }).join("")}
  </ol>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function questionCards(audit) {
  return SIGNATURES.map((signature) => {
    const selected = state.priorities.includes(signature);
    const question = questionFor(audit, signature);
    const attack = question.opponent_attack;
    const defense = question.manager_defensive_exposure;
    const attackTaker = attack.leading_corner_takers[0];
    const attackFollow = attack.leading_first_attacking_events[0];
    const defenseActor = defense.leading_first_defending_events[0];
    const firstRole = question.first_recorded_team_role;
    const attackMatches = distinctMatches(attack);
    const defenseMatches = distinctMatches(defense);
    return `<article class="routine ${selected ? "selected-priority" : ""}" data-question-card="${signature}">
      <header>
        <span><strong>${LABEL[signature]}</strong><small>${DESCRIPTION[signature]}</small></span>
        <em>${selected ? "우선순위 선택" : exposureBadge(defense.corners)}</em>
      </header>
      <p class="matchup-question">${QUESTION[signature]}</p>
      <button
        aria-label="${LABEL[signature]}. 포르투갈 ${attack.corners}회, 우루과이 ${defense.corners}회. ${selected ? "영상 검토 안건에서 빼기" : "영상 검토 안건으로 선택"}"
        aria-pressed="${selected}"
        class="priority-toggle"
        data-select="${signature}"
        type="button"
        ${state.locked || (!selected && priorityCount() >= PRIORITY_COUNT) ? "disabled" : ""}
      >${selected ? "영상 검토 안건에서 빼기" : "영상 검토 안건으로 선택"}</button>
      <div class="matchup-chain" aria-label="${LABEL[signature]} 팀별 기록 연결">
        <article class="attack-node">
          <span>포르투갈 공격 · ${attackMatches}/${REFERENCE_MATCH_COUNT}경기 · ${attack.corners}장면</span>
          <strong>키커 ${attackTaker?.display_name ?? "기록 없음"} ${attackTaker?.count ?? 0}회</strong>
          <small>첫 공격 기록 ${attackFollow?.display_name ?? "기록 없음"} ${attackFollow?.count ?? 0}회</small>
          <small>첫 후속 기록 · ${firstRole === "attacking" ? "포르투갈" : "상대 수비팀"}</small>
          <em>10초 안 슈팅 ${attack.attacking_shots_within_10_seconds}/${attack.corners}</em>
        </article>
        <span class="chain-link" aria-hidden="true">↔</span>
        <article class="defense-node">
          <span>우루과이 수비 기록 · ${defenseMatches}/${REFERENCE_MATCH_COUNT}경기 · ${defense.corners}장면</span>
          <strong>${defense.corners === 0 ? "같은 장면 기록 없음" : `첫 수비 기록 ${defenseActor?.display_name ?? "선수 기록 없음"} ${defenseActor?.count ?? 0}회`}</strong>
          <small>${defense.corners === 0 ? "첫 후속 팀 기록 없음" : `첫 후속 기록 · ${firstRole === "attacking" ? "상대 공격팀" : "우루과이"}`}</small>
          <em>${defense.corners === 0 ? "같은 수비 장면 기록 없음" : `10초 안 상대 슈팅 ${defense.opponent_shots_within_10_seconds}/${defense.corners}`}</em>
        </article>
      </div>
      <p class="evidence-cue"><strong>두 팀을 나란히 보면</strong>${evidenceCue(signature, question)}</p>
      <details class="evidence-detail">
        <summary>원본 이벤트 체인 ${attack.corners + defense.corners}장면 보기</summary>
        <div class="scene-columns">
          <section><h3>포르투갈 공격</h3>${sceneRows(attack, "attack")}</section>
          <section><h3>우루과이 수비 기록</h3>${sceneRows(defense, "defense")}</section>
        </div>
      </details>
    </article>`;
  }).join("");
}

function quickQuestionPicker(audit) {
  return `<div class="quick-question-picker" role="group" aria-label="영상 검토 안건 빠른 선택">
    ${SIGNATURES.map((signature) => {
      const selected = state.priorities.includes(signature);
      const question = questionFor(audit, signature);
      const attackMatches = distinctMatches(question.opponent_attack);
      const defenseMatches = distinctMatches(question.manager_defensive_exposure);
      return `<button
        type="button"
        data-quick-select="${signature}"
        aria-pressed="${selected}"
        aria-label="${QUESTION[signature]} ${selected ? "영상 검토 안건에서 빼기" : "영상 검토 안건으로 선택"}"
        ${state.locked || (!selected && priorityCount() >= PRIORITY_COUNT) ? "disabled" : ""}
      >
        <span>${QUESTION[signature]}</span>
        <small>포르투갈 ${attackMatches}/${REFERENCE_MATCH_COUNT}경기 · 우루과이 ${defenseMatches}/${REFERENCE_MATCH_COUNT}경기</small>
      </button>`;
    }).join("")}
  </div>`;
}

function comparisonRow(label, values, className = "") {
  return `<div class="comparison-row ${className}">
    <strong>${label}</strong>
    ${SIGNATURES.map((signature) => `<span>${values[signature]}</span>`).join("")}
  </div>`;
}

function receiptMarkup(question) {
  const receipt = question.held_out_evidence.event_receipts[0];
  if (!receipt) return "";
  const followUp = receipt.first_recorded_follow_up;
  return `<article>
    <span>${LABEL[question.id]} · 실제 ${question.held_out_evidence.corners}회</span>
    <strong>키커: ${receipt.corner_taker?.display_name ?? "선수 미상"}</strong>
    <small>첫 후속 기록의 선수: ${followUp.actor?.display_name ?? "선수 미상"}</small>
    <small>첫 후속 기록의 팀: ${followUp.team_role === "attacking" ? "포르투갈" : "우루과이"}</small>
    <small>첫 후속 기록 ${eventName(followUp)} · ${receipt.attacking_shot_within_10_seconds ? "10초 안 포르투갈 슈팅 기록 있음" : "10초 안 포르투갈 슈팅 기록 없음"}</small>
    <code>${matchTime(receipt)} · match ${receipt.match_id} · corner ${receipt.corner_event_id}</code>
  </article>`;
}

function firstCounterevidence(audit) {
  const questions = audit.matchup_question_board.questions;
  const unselected = questions.filter((question) => !state.priorities.includes(question.id));
  return unselected.find((question) =>
    question.held_out_evidence.attacking_shots_within_10_seconds > 0) ??
    unselected.find((question) => question.held_out_evidence.corners > 0) ??
    questions.find((question) =>
      state.priorities.includes(question.id) &&
      question.held_out_evidence.attacking_shots_within_10_seconds > 0);
}

function counterevidenceMarkup(audit) {
  const question = firstCounterevidence(audit);
  if (!question) return "";
  const receipt = question.held_out_evidence.event_receipts.find((candidate) =>
    candidate.attacking_shot_within_10_seconds) ?? question.held_out_evidence.event_receipts[0];
  const selected = state.priorities.includes(question.id);
  return `<section class="counterevidence" data-testid="counterevidence">
    <p class="eyebrow">${selected ? "선택한 안건의 첫 슈팅 기록" : "선택 밖에서 먼저 확인할 슈팅 기록"}</p>
    <h3>${LABEL[question.id]} · 실제 ${question.held_out_evidence.corners}장면</h3>
    <p>${selected ? "선택한 안건" : "선택하지 않은 안건"}에서 10초 안 포르투갈 슈팅 기록이 ${question.held_out_evidence.attacking_shots_within_10_seconds}장면 남았습니다. 이것은 선택의 정답표가 아니라 다음 회의에서 다시 볼 근거입니다.</p>
    ${receipt ? `<div class="counter-receipt">
      <strong>${escapeHtml(receipt.match_name)} · ${matchTime(receipt)} · corner ${receipt.corner_event_id}</strong>
      <span>${escapeHtml(receipt.corner_taker?.display_name ?? "키커 기록 없음")} → ${escapeHtml(receipt.first_recorded_follow_up.actor?.display_name ?? "선수 기록 없음")} · ${escapeHtml(eventName(receipt.first_recorded_follow_up))}</span>
      <small>10초 안 포르투갈 슈팅 기록 있음 · 출처 이벤트 ${receipt.first_recorded_follow_up.source_event_id}</small>
    </div>` : ""}
  </section>`;
}

function meetingNoteMarkup() {
  if (state.meetingNote) {
    return `<section class="meeting-receipt" data-testid="meeting-note-receipt" role="status" tabindex="-1">
      <span>다음 전술 회의 메모</span>
      <strong>${MEETING_DECISIONS[state.meetingNote.decision]}</strong>
      <p>${escapeHtml(state.meetingNote.reason)}</p>
      <small>이 메모는 이미 잠근 두 안건과 공개된 경기 기록을 바꾸지 않습니다.</small>
    </section>`;
  }
  return `<form class="meeting-note" data-action="save-meeting-note">
    <fieldset>
      <legend>선택 밖 기록을 보고 다음 회의의 결정을 남기세요</legend>
      <div class="meeting-options">
        ${Object.entries(MEETING_DECISIONS).map(([value, label]) =>
          `<label><input required type="radio" name="meeting-decision" value="${value}"><span>${label}</span></label>`).join("")}
      </div>
      <label class="meeting-reason" for="meeting-reason">이유 <span>(120자 이내)</span></label>
      <textarea id="meeting-reason" name="meeting-reason" maxlength="120" rows="3" required placeholder="예: 선택하지 않은 ‘그 밖의 전개 뒤 수비팀 먼저 기록’이 3장면 나와 다음 회의에서 검토"></textarea>
      <button type="submit">다음 회의 메모 저장</button>
    </fieldset>
  </form>`;
}

function resultMarkup(audit) {
  if (!state.revealed) return "";
  const questions = audit.matchup_question_board.questions;
  const selectedValues = Object.fromEntries(SIGNATURES.map((signature) => [
    signature,
    state.priorities.includes(signature) ? "선택" : "선택 밖",
  ]));
  const attackValues = Object.fromEntries(questions.map((question) => [
    question.id,
    question.opponent_attack.corners,
  ]));
  const defenseValues = Object.fromEntries(questions.map((question) => [
    question.id,
    question.manager_defensive_exposure.corners,
  ]));
  const actualValues = Object.fromEntries(questions.map((question) => [
    question.id,
    question.held_out_evidence.corners,
  ]));
  const shotValues = Object.fromEntries(questions.map((question) => [
    question.id,
    question.held_out_evidence.attacking_shots_within_10_seconds,
  ]));
  const dossier = report.team_scouting.first_fixed_round_of_16_example;
  return `<section class="result" data-testid="scouting-result" tabindex="-1">
    <p class="eyebrow">가려 둔 맞대결 기록 공개</p>
    <h2>우루과이–포르투갈 · 포르투갈 코너 10개</h2>
    <p class="result-lead">선택이 맞았는지 채점하지 않습니다. 먼저 보기로 한 두 안건과 선택하지 않은 안건이 실제 맞대결에서 어떻게 나타났는지 확인합니다.</p>
    <p class="not-a-score"><strong>관찰 횟수는 전술의 강점·약점·효과를 뜻하지 않습니다.</strong> 다음 회의에서 어떤 장면을 다시 볼지 정하기 위한 원장입니다.</p>
    <section class="held-out-model" data-testid="held-out-team-model">
      <p class="eyebrow">팀 보정 모델의 가려 둔 한 경기 확인</p>
      <h3>포르투갈 상위 두 전달 구역에 실제 코너 10개 중 ${dossier.team_conditioned_top_two_covered}개가 왔습니다.</h3>
      <div>
        <span>포르투갈 보정 · 중앙·파 + 숏 <strong>${dossier.team_conditioned_top_two_covered}/10</strong></span>
        <span>대회 평균 · 중앙·파 + 니어 <strong>${dossier.tournament_top_two_covered}/10</strong></span>
      </div>
      <small>이 한 경기의 9/10은 모델 우월성의 증명이 아닙니다. 모델 평가는 따로 잠가 둔 토너먼트 160개 전체의 로그손실로 판단했습니다.</small>
    </section>
    <div class="comparison" role="group" aria-label="영상 검토 안건과 두 팀의 사전 기록, 실제 맞대결 기록 비교" tabindex="0">
      <div class="comparison-row headings"><strong></strong>${SIGNATURES.map((signature) => `<span>${LABEL[signature]}</span>`).join("")}</div>
      ${comparisonRow("내 영상 검토 안건", selectedValues, "user-row")}
      ${comparisonRow("포르투갈 사전 기록", attackValues)}
      ${comparisonRow("우루과이 사전 기록", defenseValues)}
      ${comparisonRow("실제 맞대결", actualValues, "actual-row")}
      ${comparisonRow("10초 안 슈팅 기록", shotValues)}
    </div>
    ${counterevidenceMarkup(audit)}
    <div class="receipt-grid">${questions.filter((question) =>
      question.held_out_evidence.corners > 0).map(receiptMarkup).join("")}</div>
    <div class="result-boundary">
      <strong>실제 맞대결에서는 포르투갈 코너 10개 중 4개 뒤에 10초 안 슈팅 기록이 있었습니다.</strong>
      <span>어떤 훈련이 이를 막았을지는 이 데이터로 알 수 없습니다. 선수 위치·마킹·도달 범위가 없기 때문입니다.</span>
    </div>
    ${meetingNoteMarkup()}
    <button class="restart" type="button" data-action="restart">다른 두 안건 검토하기</button>
  </section>`;
}

function render() {
  const scouting = report.team_scouting;
  const audit = routineAudit();
  const attack = audit.opponent_attack_reference;
  const defense = audit.manager_defensive_reference;
  const used = priorityCount();
  const remaining = PRIORITY_COUNT - used;
  app.innerHTML = `
    <header class="hero">
      <p class="eyebrow">CORNER SCOUT LAB · 2018 월드컵 16강</p>
      <h1>포르투갈 코너 14개만<br><span>그대로 믿어도 될까요?</span></h1>
      <p>대회 전체 기록으로 포르투갈의 작은 표본을 보정하고, 포르투갈의 반복 장면과 우루과이의 수비 장면을 원본 이벤트까지 연결합니다. 감독은 정답 대신 먼저 돌려볼 영상 검토 안건 두 개를 고릅니다.</p>
      <aside><strong>좋은 위치나 우루과이의 약점을 찾는 서비스가 아닙니다.</strong> 상대팀의 전달 성향을 보정해 추정하고, 구체적인 장면 검토 목록을 만드는 도구입니다.</aside>
    </header>

    <section class="workspace" data-routine-status="${audit.status}" data-revealed="${state.revealed}">
      <div class="matchup">
        <strong>2018 월드컵 16강 · 우루과이 vs 포르투갈</strong>
        <span>맞대결 10개 코너는 영상 검토 안건 두 개를 잠글 때까지 가려 둡니다.</span>
      </div>
      <div class="quick-evidence" aria-label="두 팀의 사전 기록 수">
        <article>
          <span>포르투갈이 공격한 코너</span>
          <strong>${attack.classifiable_corners}/${attack.source_corners}</strong>
          <small>조별리그 · 14개 모두 전개 분류</small>
        </article>
        <article>
          <span>우루과이가 수비한 코너</span>
          <strong>${defense.classifiable_corners}/${defense.source_corners}</strong>
          <small>조별리그 · 6개 중 1개 분류 제외</small>
        </article>
      </div>
      ${modelContextMarkup()}
      <div class="analysis-path" aria-label="맞대결 분석 순서">
        <span><strong>1</strong> 작은 표본을 대회 기록으로 보정</span>
        <i aria-hidden="true">→</i>
        <span><strong>2</strong> 두 팀의 원본 장면 검토</span>
        <i aria-hidden="true">→</i>
        <span><strong>3</strong> 가려 둔 맞대결로 확인</span>
      </div>
      <p class="allocation-goal"><strong>이번 미팅에서</strong> 먼저 돌려볼 영상 검토 안건 두 개를 고르세요. 포르투갈의 경기 반복 수와 우루과이의 관찰 경기 수를 함께 볼 수 있습니다.</p>
      ${quickQuestionPicker(audit)}
      <details class="scene-review">
        <summary>두 팀의 선수·이벤트·슈팅 원장으로 안건 확인하기</summary>
        <div class="routine-grid" aria-label="팀별 코너 기록을 연결한 영상 검토 안건 다섯 개">${questionCards(audit)}</div>
      </details>

      <div class="commit">
        <div>
          <span>이번 미팅의 영상 검토 안건</span>
          <strong aria-live="polite" data-testid="priority-summary">${used}/${PRIORITY_COUNT}개 선택 · ${remaining}개 남음</strong>
          <em data-testid="selected-question-labels">${selectedQuestionLabels()}</em>
          <small data-testid="priority-mix">${priorityMix(audit)} · ${state.locked ? "맞대결 기록을 보기 전에 잠갔습니다." : "자동 추천은 없습니다."}</small>
        </div>
        ${!state.locked
          ? `<button type="button" data-action="lock" ${remaining === 0 ? "" : "disabled"}>선택한 영상 검토 안건 2개를 맞대결 공개 전에 잠그기</button>`
          : !state.revealed
            ? `<button type="button" data-action="reveal">가려 둔 우루과이–포르투갈 코너 기록 보기</button>`
            : ""}
      </div>
      <p class="always-boundary"><strong>이 선택은 전술 추천이 아닙니다.</strong> 키커·첫 후속·첫 수비는 데이터에 남은 기록이며, 선수의 당시 위치와 마킹 방식은 없습니다. 훈련 효과, 수비 성공, 실점 방지, 최적 전술은 판단하지 않습니다.</p>
      ${resultMarkup(audit)}
      <details class="method-context">
        <summary>분류 규칙과 기획 변경 보기</summary>
        <p class="correction-note"><strong>기획서의 위치·임계값 단위는 데이터 검증 뒤 기각했습니다.</strong> ‘두 우선순위 → 결과 전에 확정 → 가려 둔 경기의 반박’ 구조는 유지하고, 포르투갈 공격과 우루과이 수비 기록을 연결한 다섯 장면 분류로 바꿨습니다.</p>
        <div class="briefing">
          <div class="brief-title">
            <p class="eyebrow">두 팀 사전 브리핑</p>
            <h2>전개 분류와 첫 후속 기록의 팀을 결합해 두 팀의 장면을 대조합니다</h2>
            <p>포르투갈 14개는 상대 공격 기록, 우루과이 5개는 우리 수비가 실제로 겪은 분류 가능 장면입니다. 우루과이 1개는 전달 끝점이 비어 있어 다섯 장면 분류에서 제외했습니다.</p>
          </div>
          <article class="team-ledger attack-ledger">
            <span>포르투갈 공격 기록</span>
            <strong>${attack.classifiable_corners}/${attack.source_corners}</strong>
            <small>주요 키커 · ${names(attack.leading_corner_takers, 3)}</small>
            <small>코너 뒤 첫 공격 기록 · ${names(attack.leading_first_attacking_events, 2)}</small>
          </article>
          <article class="team-ledger defense-ledger">
            <span>우루과이 수비 상황 기록</span>
            <strong>${defense.classifiable_corners}/${defense.source_corners}</strong>
            <small>첫 수비 기록 · ${names(defense.leading_first_defending_events_all_source_corners, 4)}</small>
            <small>상대 슈팅 기록 · 10초 안 ${defense.opponent_shots_within_10_seconds}/${defense.source_corners}</small>
          </article>
        </div>
        <div class="routine-legend">
          <span><i></i>포르투갈 공격 기록</span>
          <span><i class="defense"></i>우루과이가 겪은 수비 상황</span>
          <strong>관찰 0회는 약점 판정이 아닙니다</strong>
        </div>
      </details>
    </section>

    <section class="audit">
      <div>
        <p class="eyebrow">팀 이름을 붙인 빈도표에서 한 단계 더</p>
        <h2>팀 보정 분포에서 출발해 ‘키커 → 첫 후속 기록 → 10초 안 슈팅’을 장면 단위로 확인합니다.</h2>
      </div>
      <div class="audit-metrics">
        <article><strong>8/14</strong><span>포르투갈 조별리그 · 콰레스마 코너</span></article>
        <article><strong>6회</strong><span>코너 뒤 첫 공격 이벤트 · 하파엘 게헤이루</span></article>
        <article><strong>5/6</strong><span>우루과이가 수비한 코너 · 유형 분류</span></article>
      </div>
      <p>팀별 전달 분포는 대회 전체로 작은 표본을 보정하고, 다섯 장면 분류는 전개 유형과 어느 팀의 후속 이벤트가 먼저 기록됐는지를 함께 봅니다. 각 장면의 키커·후속 이벤트·선수·슈팅 기록은 원본 이벤트 ID로 다시 확인합니다. 기록이 없다는 사실은 취약성이 아니라 관찰 공백으로만 남깁니다.</p>
      <details>
        <summary>자료·분류 규칙·판단 한계</summary>
        <ul>
          <li>숏 구역 전달: 프로젝트가 정의한 숏 구역에서 끝난 코너입니다.</li>
          <li>공중 경합·헤더 뒤: 숏 구역 전달로 분류되지 않았으며 첫 후속 기록이 공중 경합 또는 헤더 패스인 코너입니다.</li>
          <li>그 밖의 전개 뒤: 나머지 분류 가능한 코너로, 첫 후속 기록의 실제 유형을 함께 공개합니다.</li>
          <li>각 전개는 첫 후속 기록이 공격팀과 수비팀 중 어느 쪽인지 나눕니다. 이는 첫 접촉, 소유권, 경합 승자를 뜻하지 않습니다.</li>
          <li>이벤트 ID와 선수 ID는 Pappalardo &amp; Massucco의 Wyscout World Cup 2018
            <a href="https://figshare.com/articles/dataset/Events/7770599">Events</a>,
            <a href="https://figshare.com/articles/dataset/Matches/7770422/1">Matches</a>,
            <a href="https://figshare.com/articles/dataset/Players/7765196">Players</a>에서 연결했습니다.
            세 자료 모두 <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>입니다.</li>
          <li>첫 전개 유형 분류와 선수 짧은 이름의 유니코드 정규화는 이 프로젝트의 변형입니다. 원저자·데이터 제공자·선수는 이 서비스를 보증하거나 후원하지 않습니다.</li>
          <li>선수 사진·국기·문장·현재 2026 정보는 사용하지 않습니다. 2018년 역사적 경기 준비 리허설입니다.</li>
          <li>선수 위치, 속도, 키커의 실제 발 궤적, 마킹 임무, 헤딩 도달 범위가 없어 수비 배치를 추천하지 않습니다.</li>
        </ul>
      </details>
    </section>`;
}

app.addEventListener("click", (event) => {
  const selector = event.target.closest("[data-select], [data-quick-select]");
  if (selector) {
    const signature = selector.dataset.select ?? selector.dataset.quickSelect;
    togglePriority(signature);
    render();
    if (priorityCount() === PRIORITY_COUNT) {
      document.querySelector('[data-action="lock"]')?.focus();
    } else {
      document.querySelector(`[data-quick-select="${signature}"]`)?.focus();
    }
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "lock" && priorityCount() === PRIORITY_COUNT) {
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
  if (action === "restart") document.querySelector('[data-quick-select="short-attacking-first"]')?.focus();
});

app.addEventListener("submit", (event) => {
  if (!(event.target instanceof HTMLFormElement) || event.target.dataset.action !== "save-meeting-note") return;
  event.preventDefault();
  const form = new FormData(event.target);
  const decision = String(form.get("meeting-decision") ?? "");
  const reason = String(form.get("meeting-reason") ?? "").trim();
  if (!Object.hasOwn(MEETING_DECISIONS, decision) || !reason || reason.length > 120) return;
  state.meetingNote = { decision, reason };
  render();
  document.querySelector("[data-testid=meeting-note-receipt]")?.focus();
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
  app.innerHTML = `<section class="error" role="alert"><h1>팀별 코너 첫 전개 기록을 열 수 없습니다.</h1><p>${error instanceof Error ? error.message : "알 수 없는 오류"}</p></section>`;
}
