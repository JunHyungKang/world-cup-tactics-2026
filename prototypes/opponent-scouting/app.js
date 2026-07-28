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
  "short-attacking-first": "숏 코너 · 첫 기록은 공격팀",
  "aerial-attacking-first": "공중볼 경합 · 첫 기록은 공격팀",
  "aerial-defending-first": "공중볼 경합 · 첫 기록은 수비팀",
  "other-attacking-first": "기타 전개 · 첫 기록은 공격팀",
  "other-defending-first": "기타 전개 · 첫 기록은 수비팀",
};
const DESCRIPTION = {
  "short-attacking-first": "숏 코너 뒤 첫 기록에 공격팀 선수가 등장",
  "aerial-attacking-first": "공중볼 경합 뒤 첫 기록에 공격팀 선수가 등장",
  "aerial-defending-first": "공중볼 경합 뒤 첫 기록에 수비팀 선수가 등장",
  "other-attacking-first": "기타 전개 뒤 첫 기록에 공격팀 선수가 등장",
  "other-defending-first": "기타 전개 뒤 첫 기록에 수비팀 선수가 등장",
};
const QUESTION = {
  "short-attacking-first": "숏 코너 뒤 첫 기록에 포르투갈 선수가 등장한 장면",
  "aerial-attacking-first": "공중볼 경합 뒤 첫 기록에 포르투갈 선수가 등장한 장면",
  "aerial-defending-first": "공중볼 경합 뒤 첫 기록에 상대 수비 선수가 등장한 장면",
  "other-attacking-first": "기타 전개 뒤 첫 기록에 포르투갈 선수가 등장한 장면",
  "other-defending-first": "기타 전개 뒤 첫 기록에 상대 수비 선수가 등장한 장면",
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
const KOREAN_PLAYER_NAME = {
  "Ricardo Quaresma": "콰레스마",
  "Raphaël Guerreiro": "게헤이루",
  "C. Sánchez": "C. 산체스",
};

function localizedPlayerName(displayName) {
  return KOREAN_PLAYER_NAME[displayName] ?? displayName;
}

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
  const expectedSupport = {
    "short-attacking-first": [2, 0],
    "aerial-attacking-first": [0, 2],
    "aerial-defending-first": [0, 2],
    "other-attacking-first": [0, 1],
    "other-defending-first": [1, 0],
  };
  const receipts = (board?.questions ?? []).flatMap((question) => [
    ...(question.opponent_attack?.event_receipts ?? []),
    ...(question.manager_defensive_exposure?.event_receipts ?? []),
    ...(question.held_out_evidence?.event_receipts ?? []),
  ]);
  if (value?.transform_version !== "policy-lab-spike-v12-team-comparison-support" ||
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
      board?.repeated_player_connections?.length !== 1 ||
      board.repeated_player_connections[0]?.corner_taker?.display_name !== "Ricardo Quaresma" ||
      board.repeated_player_connections[0]?.first_recorded_follow_up_actor?.display_name !== "Raphaël Guerreiro" ||
      board.repeated_player_connections[0]?.corners !== 3 ||
      board.repeated_player_connections[0]?.matches !== 2 ||
      !SIGNATURES.every((signature) => {
        const support = board.questions.find((question) => question.id === signature)
          ?.comparison_support;
        return support?.direct === expectedSupport[signature][0] &&
          support?.adjacent === expectedSupport[signature][1];
      }) ||
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
  if (state.priorities.length === 0) {
    return "우루과이 기록은 세 조건이 같은 직접 비교와, 전개만 비슷한 참고 장면으로 나눕니다.";
  }
  const selected = state.priorities.map((signature) => questionFor(audit, signature));
  const withoutDirect = selected.filter((question) =>
    question.comparison_support.direct === 0).length;
  const withDirect = selected.length - withoutDirect;
  return `우루과이 직접 비교 없음 ${withoutDirect}개 · 직접 비교 있음 ${withDirect}개`;
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
  return `<details class="model-context" data-testid="team-model">
    <summary>표본 보정과 검증 근거 보기</summary>
    <div class="model-context-body">
      <div class="model-copy">
        <p class="eyebrow">작은 표본을 그대로 믿지 않는 안전장치</p>
        <h2>포르투갈 코너 14개를 월드컵 조별리그 397개로 보정했습니다.</h2>
        <p>이 계산은 어느 장면부터 볼지 좁히는 참고 자료입니다. 좋은 위치나 수비 전술의 정답을 고르지 않습니다.</p>
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
      <p class="model-boundary"><strong>우루과이 수비 5개는 예측에 섞지 않았습니다.</strong> 두 팀 결합안은 로그손실을 ${percent(challengerImprovement)} 낮췄지만, 개선 확률 ${percent(challengerProbability)}가 사전 기준 97.5%에 못 미쳤습니다. 우루과이 기록은 원본 장면을 찾는 데만 씁니다.</p>
    </div>
  </details>`;
}

function situationCard(audit, situationId) {
  return audit.opponent_attack_reference.situation_cards.find((card) =>
    card.situation === situationId);
}

function teamRoutineBriefingMarkup(audit) {
  const attack = audit.opponent_attack_reference;
  const defense = audit.manager_defensive_reference;
  const short = situationCard(audit, "short-recorded-endpoint");
  const aerial = situationCard(audit, "aerial-recorded-follow-up");
  const shortMatches = distinctMatches(short);
  const aerialMatches = distinctMatches(aerial);
  const guerreiro = short.leading_players.first_attacking_events.find((player) =>
    player.display_name === "Raphaël Guerreiro");
  const aerialDefendingFirst = aerial.first_event_team_role_counts.defending;
  const sanchez = defense.leading_first_defending_events_all_source_corners.find((player) =>
    player.display_name === "C. Sánchez");
  const exactPair = audit.matchup_question_board.repeated_player_connections[0];
  const sanchezReceipts = defense.situation_cards.flatMap((card) => card.event_receipts)
    .filter((receipt) => receipt.first_recorded_defending_event?.actor?.display_name === "C. Sánchez");
  const sanchezMatches = new Set(sanchezReceipts.map((receipt) => receipt.match_id)).size;
  return `<section class="team-routine-brief" data-testid="team-routine-brief">
    <div class="brief-head">
      <p class="eyebrow">포르투갈의 반복 기록부터 확인합니다</p>
      <h2>코너를 찬 선수와, 이후 첫 기록에 등장한 선수를 확인합니다.</h2>
      <p>포르투갈의 코너마다 키커와 이후 10초 기록을 연결해, 우루과이의 사전 수비 장면과 나란히 봅니다.</p>
    </div>
    <div class="routine-trace" aria-label="포르투갈 코너 선수 연결과 우루과이 수비 기록 요약">
      <article>
        <span>반복된 선수·이벤트 연결</span>
        <strong>키커 ${localizedPlayerName(exactPair.corner_taker.display_name)} · 첫 기록에 등장한 선수 ${localizedPlayerName(exactPair.first_recorded_follow_up_actor.display_name)}</strong>
        <em>${exactPair.corners}장면 · ${exactPair.matches}경기</em>
        <small>원문 이름: 키커 ${exactPair.corner_taker.display_name} · 첫 기록에 등장한 선수 ${exactPair.first_recorded_follow_up_actor.display_name}<br>숏 코너 뒤 포르투갈의 첫 기록 · 패스 대상이나 첫 접촉을 뜻하지 않음</small>
      </article>
      <article>
        <span>숏 구역 전달 전체</span>
        <strong>${localizedPlayerName("Raphaël Guerreiro")}</strong>
        <em>${guerreiro?.count ?? 0}/${short.corners}장면</em>
        <small>Raphaël Guerreiro · ${shortMatches}/3경기에서 코너 뒤 첫 기록</small>
      </article>
      <article>
        <span>공중볼 뒤 첫 기록</span>
        <strong>상대 수비</strong>
        <em>${aerialDefendingFirst}/${aerial.corners}장면</em>
        <small>${aerialMatches}/3경기에서 공중볼 전개 확인</small>
      </article>
      <article class="uruguay-response">
        <span>우루과이의 첫 수비 기록</span>
        <strong>${localizedPlayerName("C. Sánchez")}</strong>
        <em>${sanchez?.count ?? 0}장면 · ${sanchezMatches}경기</em>
        <small>C. Sánchez · 조별리그 ${defense.classifiable_corners}장면 중 · 표본이 한 경기에 치우침</small>
      </article>
    </div>
    <p class="brief-boundary"><strong>전개 방식, 첫 기록의 팀, 이벤트 유형이 모두 같을 때만 직접 비교합니다.</strong> 이 기록으로 마킹이나 배치를 추천할 수는 없지만, 전술 미팅에서 원본 영상을 어떤 순서로 돌려볼지는 정할 수 있습니다.</p>
  </section>`;
}

function comparisonSupport(_audit, question) {
  return question.comparison_support;
}

function evidenceCue(signature, question) {
  const audit = routineAudit();
  const attack = question.opponent_attack.corners;
  const defense = question.manager_defensive_exposure.corners;
  const attackMatches = distinctMatches(question.opponent_attack);
  const defenseMatches = distinctMatches(question.manager_defensive_exposure);
  const support = comparisonSupport(audit, question);
  const supportSentence = `세 조건이 모두 같아 직접 비교할 수 있는 우루과이 장면은 ${support.direct}개입니다. 같은 전개 방식의 참고 장면은 ${support.adjacent}개입니다.`;
  if (signature === "short-attacking-first") {
    return `포르투갈 ${attack}장면이 ${attackMatches}/${REFERENCE_MATCH_COUNT}경기에서 관찰됐고, 우루과이 쪽 기록은 ${defense}장면·${defenseMatches}/${REFERENCE_MATCH_COUNT}경기입니다. ${supportSentence}`;
  }
  if (signature === "aerial-attacking-first") {
    return `포르투갈 ${attack}장면은 ${attackMatches}/${REFERENCE_MATCH_COUNT}경기, 우루과이 쪽 기록은 ${defense}장면·${defenseMatches}/${REFERENCE_MATCH_COUNT}경기입니다. ${supportSentence}`;
  }
  if (defense === 0) {
    return `포르투갈 ${attack}장면이 ${attackMatches}/${REFERENCE_MATCH_COUNT}경기에서 관찰됐지만, 우루과이 기록에는 세 조건이 모두 같은 장면이 없습니다. 같은 전개 방식의 참고 장면은 ${support.adjacent}개이며, 직접 비교할 기록이 없다고 약점인 것은 아닙니다.`;
  }
  return `포르투갈 ${attack}장면은 ${attackMatches}/${REFERENCE_MATCH_COUNT}경기, 우루과이 쪽 기록은 ${defense}장면·${defenseMatches}/${REFERENCE_MATCH_COUNT}경기입니다. ${supportSentence}`;
}

function exposureBadge(corners, direct) {
  if (corners === 0) return "관찰 0회 · 약점 판정 아님";
  if (corners === 1) return "1회 관찰 · 표본 한 장면";
  return `같은 전개 기록 ${corners}회 · 직접 비교 ${direct}회`;
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
      const nextLabel = perspective === "attack"
        ? "첫 기록에 등장한 선수"
        : "우루과이 첫 수비 이벤트 기록 선수";
      return `<li>
        <span>${escapeHtml(receipt.match_name)}</span>
        <strong>키커 ${escapeHtml(receipt.corner_taker?.display_name ?? "기록 없음")}</strong>
        <small>${nextLabel} ${escapeHtml(nextActor)} · ${escapeHtml(eventName(recordedEvent))}</small>
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
    const support = comparisonSupport(audit, question);
    return `<article class="routine ${selected ? "selected-priority" : ""}" data-question-card="${signature}">
      <header>
        <span><strong>${LABEL[signature]}</strong><small>${DESCRIPTION[signature]}</small></span>
        <em>${selected ? "우선순위 선택" : exposureBadge(defense.corners, support.direct)}</em>
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
          <small>코너 뒤 첫 기록 · ${firstRole === "attacking" ? "포르투갈" : "상대 수비팀"}</small>
          <em>10초 안 슈팅 ${attack.attacking_shots_within_10_seconds}/${attack.corners}</em>
        </article>
        <span class="chain-link" aria-hidden="true">↔</span>
        <article class="defense-node">
          <span>우루과이 수비 기록 · ${defenseMatches}/${REFERENCE_MATCH_COUNT}경기 · ${defense.corners}장면</span>
          <strong>${defense.corners === 0 ? "직접 비교 장면 없음" : `첫 수비 기록 ${defenseActor?.display_name ?? "선수 기록 없음"} ${defenseActor?.count ?? 0}회`}</strong>
          <small>직접 비교 ${support.direct} · 참고 장면 ${support.adjacent}</small>
          <em>${defense.corners === 0 ? "공백은 약점 판정이 아님" : `10초 안 상대 슈팅 ${defense.opponent_shots_within_10_seconds}/${defense.corners}`}</em>
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
      const support = comparisonSupport(audit, question);
      return `<button
        type="button"
        data-quick-select="${signature}"
        aria-pressed="${selected}"
        aria-label="${QUESTION[signature]} ${selected ? "영상 검토 안건에서 빼기" : "영상 검토 안건으로 선택"}"
        ${state.locked || (!selected && priorityCount() >= PRIORITY_COUNT) ? "disabled" : ""}
      >
        <span>${QUESTION[signature]}</span>
        <small>포르투갈 ${attackMatches}/${REFERENCE_MATCH_COUNT}경기 · 우루과이 직접 비교 ${support.direct} · 참고 ${support.adjacent}</small>
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
    <small>첫 기록에 등장한 선수: ${followUp.actor?.display_name ?? "선수 미상"}</small>
    <small>코너 뒤 첫 기록의 팀: ${followUp.team_role === "attacking" ? "포르투갈" : "우루과이"}</small>
    <small>코너 뒤 첫 기록 유형 ${eventName(followUp)} · ${receipt.attacking_shot_within_10_seconds ? "10초 안 포르투갈 슈팅 기록 있음" : "10초 안 포르투갈 슈팅 기록 없음"}</small>
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
      <span>키커 ${escapeHtml(receipt.corner_taker?.display_name ?? "기록 없음")} · 첫 기록에 등장한 선수 ${escapeHtml(receipt.first_recorded_follow_up.actor?.display_name ?? "선수 기록 없음")} · ${escapeHtml(eventName(receipt.first_recorded_follow_up))}</span>
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
      <textarea id="meeting-reason" name="meeting-reason" maxlength="120" rows="3" required placeholder="예: 선택하지 않은 ‘기타 전개 · 첫 기록은 수비팀’이 3장면 나와 다음 회의에서 검토"></textarea>
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
    <p class="not-a-score"><strong>관찰 횟수는 전술의 강점·약점·효과를 뜻하지 않습니다.</strong> 다음 회의에서 어떤 장면을 다시 볼지 정하기 위한 검토 기록입니다.</p>
    ${counterevidenceMarkup(audit)}
    <details class="result-statistics">
      <summary>전달 구역 모델과 전체 다섯 분류 표 보기</summary>
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
    </details>
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
      <h1>16강 전날,<br><span>포르투갈 코너 영상은 무엇부터 볼까요?</span></h1>
      <p>포르투갈 코너마다 키커와 이후 10초 기록을 연결했습니다. 우루과이 세트피스 코치가 먼저 볼 영상 묶음 두 개를 직접 고릅니다.</p>
      <aside><strong>전술의 정답을 만들어 주는 서비스가 아닙니다.</strong> 작은 표본에서 반복된 선수·이벤트 연결과 경기 시각을 찾아 주는 영상 미팅 준비 도구입니다.</aside>
    </header>

    <section class="workspace" data-routine-status="${audit.status}" data-revealed="${state.revealed}">
      <div class="matchup">
        <strong>2018 월드컵 16강 · 우루과이 vs 포르투갈</strong>
        <span>맞대결 10개 코너는 영상 검토 안건 두 개를 잠글 때까지 가려 둡니다.</span>
      </div>
      ${teamRoutineBriefingMarkup(audit)}
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
      <div class="analysis-path" aria-label="맞대결 분석 순서">
        <span><strong>1</strong> 선수·이벤트 연결과 반복 경기 확인</span>
        <i aria-hidden="true">→</i>
        <span><strong>2</strong> 영상 미팅 안건 두 개 선택</span>
        <i aria-hidden="true">→</i>
        <span><strong>3</strong> 맞대결과 선택 밖 반례 확인</span>
      </div>
      <p class="allocation-goal"><strong>이번 영상 미팅에서</strong> 먼저 볼 영상 묶음 두 개를 고르세요. 포르투갈의 반복 기록과 관련 선수, 우루과이의 직접 비교·참고 장면을 함께 보여 줍니다.</p>
      ${quickQuestionPicker(audit)}
      ${modelContextMarkup()}
      <details class="scene-review">
        <summary>선수와 원본 이벤트까지 장면별로 확인하기</summary>
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
      <p class="always-boundary"><strong>이 선택은 전술 추천이 아닙니다.</strong> 키커·코너 뒤 첫 기록·첫 수비 기록은 데이터에 남은 정보이며, 선수의 당시 위치와 마킹 방식은 없습니다. 훈련 효과, 수비 성공, 실점 방지, 최적 전술은 판단하지 않습니다.</p>
      ${resultMarkup(audit)}
      <details class="method-context">
        <summary>분류 규칙과 기획 변경 보기</summary>
        <p class="correction-note"><strong>기획서의 위치·임계값 단위는 데이터 검증 뒤 기각했습니다.</strong> ‘두 우선순위 → 결과 전에 확정 → 가려 둔 경기의 반박’ 구조는 유지하고, 포르투갈 공격과 우루과이 수비 기록을 연결한 다섯 장면 분류로 바꿨습니다.</p>
        <div class="briefing">
          <div class="brief-title">
            <p class="eyebrow">두 팀 사전 브리핑</p>
            <h2>전개 방식과 코너 뒤 첫 기록의 팀을 기준으로 두 팀 장면을 비교합니다</h2>
            <p>포르투갈 14개는 상대 공격 기록, 우루과이 5개는 우리 팀의 수비 상황으로 남은 분류 가능 기록입니다. 우루과이 1개는 전달 끝점이 비어 있어 다섯 장면 분류에서 제외했습니다.</p>
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
          <span><i class="defense"></i>우루과이 수비 상황 기록</span>
          <strong>관찰 0회는 약점 판정이 아닙니다</strong>
        </div>
      </details>
    </section>

    <section class="audit">
      <div>
        <p class="eyebrow">독립 집계를 하나의 플레이처럼 붙이지 않습니다</p>
        <h2>같은 영수증의 선수·이벤트 연결과 세 가지 기록 축만 씁니다.</h2>
      </div>
      <div class="audit-metrics">
        <article><strong>3장면</strong><span>키커 콰레스마 · 첫 기록에 등장한 선수 게헤이루 · 2경기</span></article>
        <article><strong>${comparisonSupport(audit, questionFor(audit, "short-attacking-first")).direct}개</strong><span>숏 코너 · 우루과이 직접 비교</span></article>
        <article><strong>${comparisonSupport(audit, questionFor(audit, "aerial-defending-first")).adjacent}개</strong><span>공중볼·수비 기록 · 우루과이 참고 장면</span></article>
      </div>
      <p>선수·이벤트 연결은 같은 코너 기록 안의 키커와 첫 기록만 잇습니다. 패스 대상, 첫 접촉, 소유 지속, 약속된 루틴을 뜻하지 않습니다. 전개 방식, 첫 기록의 팀, 이벤트 유형이 모두 같을 때만 <strong>직접 비교</strong>로 표시합니다. 전개 방식만 같고 나머지 조건이 다르면 <strong>참고 장면</strong>, 기록이 없으면 <strong>관찰 공백</strong>입니다. 어느 쪽도 취약성이나 대응 전술을 뜻하지 않습니다.</p>
      <details>
        <summary>자료·분류 규칙·판단 한계</summary>
        <ul>
          <li>숏 구역 전달: 프로젝트가 정의한 숏 구역에서 끝난 코너입니다.</li>
          <li>공중볼 경합: 숏 코너로 분류되지 않았으며 코너 뒤 첫 기록이 공중 경합 또는 헤더 패스인 장면입니다.</li>
          <li>기타 전개: 나머지 분류 가능한 코너로, 코너 뒤 첫 기록의 실제 유형을 함께 공개합니다.</li>
          <li>각 전개는 코너 뒤 첫 기록이 공격팀과 수비팀 중 어느 쪽인지 나눕니다. 이는 첫 접촉, 소유권, 경합 승자를 뜻하지 않습니다.</li>
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
