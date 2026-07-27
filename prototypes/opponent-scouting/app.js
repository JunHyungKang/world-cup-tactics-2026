const ROUTINES = [
  "short-recorded-endpoint",
  "aerial-recorded-follow-up",
  "other-recorded-follow-up",
];
const LABEL = {
  "short-recorded-endpoint": "숏 구역 전달",
  "aerial-recorded-follow-up": "비숏 · 공중 후속 기록",
  "other-recorded-follow-up": "비숏 · 기타 후속 기록",
};
const DESCRIPTION = {
  "short-recorded-endpoint": "끝점이 프로젝트 정의 숏 구역",
  "aerial-recorded-follow-up": "첫 후속 기록이 공중 경합 또는 헤더 패스",
  "other-recorded-follow-up": "그 밖의 비숏 전달 · 후속 기록 유형 그대로 공개",
};
const EVENT_LABEL = {
  Pass: "패스",
  Duel: "경합",
  "Others on the ball": "볼 처리",
  "Simple pass": "일반 패스",
  Cross: "크로스",
  "Air duel": "공중 경합",
  "Head pass": "헤더 패스",
  Clearance: "걷어내기",
  "Ground loose ball duel": "세컨드볼 경합",
  Touch: "터치",
};
const TRAINING_REPS = 10;
const MEETING_DECISIONS = {
  keep: "이 배분을 다음 회의에서도 유지",
  revise: "다음 회의에서 훈련 비중 재배분",
  defer: "근거가 부족해 결정 보류",
};

const app = document.querySelector("#app");
let report;
let state = freshState();

function freshState() {
  return {
    allocation: Object.fromEntries(ROUTINES.map((routine) => [routine, 0])),
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
    ROUTINES.every((key) => actual?.[key] === expected[key]) &&
    Object.keys(actual ?? {}).length === ROUTINES.length;
  const joins = Object.values(situation?.player_join_coverage ?? {});
  if (value?.population?.source_corners !== 603 ||
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
      !value?.provenance?.source_ids?.includes("pappalardo-wyscout-players")) {
    throw new Error("불러온 자료가 팀별 코너 첫 전개 계약과 일치하지 않습니다.");
  }
  return value;
}

function routineAudit() {
  return report.team_scouting.corner_situation_rehearsal;
}

function allocated() {
  return ROUTINES.reduce((sum, routine) => sum + state.allocation[routine], 0);
}

function adjustAllocation(routine, delta) {
  if (state.locked) return;
  const next = state.allocation[routine] + delta;
  if (next < 0 || next > TRAINING_REPS || allocated() + delta > TRAINING_REPS) return;
  state.allocation = { ...state.allocation, [routine]: next };
}

function cardFor(ledger, routine) {
  return ledger.situation_cards.find((card) => card.situation === routine);
}

function names(players, limit = 2) {
  if (!players?.length) return "기록 없음";
  return players.slice(0, limit).map((player) => `${player.display_name} ${player.count}회`).join(" · ");
}

function roleCounts(card, attackingName, defendingName) {
  const counts = card.first_event_team_role_counts;
  return `${attackingName} ${counts.attacking}회 · ${defendingName} ${counts.defending}회`;
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

function routineCards(audit) {
  const attack = audit.opponent_attack_reference;
  const defense = audit.manager_defensive_reference;
  return ROUTINES.map((routine) => {
    const attackCard = cardFor(attack, routine);
    const defenseCard = cardFor(defense, routine);
    const count = state.allocation[routine];
    return `<article class="routine" data-routine-card="${routine}">
      <header>
        <span><strong>${LABEL[routine]}</strong><small>${DESCRIPTION[routine]}</small></span>
        <em>${attackCard.corners}/${attack.classifiable_corners}</em>
      </header>
      <div class="team-bars" aria-label="${LABEL[routine]} 관측 수 비교">
        <span><b>포르투갈 공격</b><i style="--value:${attackCard.corners / attack.classifiable_corners}"></i><strong>${attackCard.corners}회</strong></span>
        <span><b>우루과이 수비 상황</b><i class="defense" style="--value:${defenseCard.corners / defense.classifiable_corners}"></i><strong>${defenseCard.corners}회</strong></span>
      </div>
      <details class="evidence-detail">
        <summary>선수·첫 후속 기록 근거</summary>
        <dl>
          <div><dt>주요 키커</dt><dd>${names(attackCard.leading_players.corner_takers)}</dd></div>
          <div><dt>코너 뒤 첫 공격 기록</dt><dd>${names(attackCard.leading_players.first_attacking_events)}</dd></div>
          <div><dt>첫 후속 기록의 팀</dt><dd>${roleCounts(attackCard, "포르투갈", "상대팀")}</dd></div>
          <div><dt>10초 안 포르투갈 슈팅 기록</dt><dd>${attackCard.attacking_shots_within_10_seconds}/${attackCard.corners}회</dd></div>
          <div><dt>우루과이의 첫 수비 기록</dt><dd>${names(defenseCard.leading_players.first_defending_events)}</dd></div>
          <div><dt>우루과이가 겪은 첫 후속 기록의 팀</dt><dd>${roleCounts(defenseCard, "상대팀", "우루과이")}</dd></div>
          <div><dt>10초 안 상대 슈팅 기록</dt><dd>${defenseCard.attacking_shots_within_10_seconds}/${defenseCard.corners}회</dd></div>
        </dl>
      </details>
      <div class="allocator">
        <button type="button" data-adjust="-1" data-routine="${routine}" aria-label="${LABEL[routine]} 훈련 1회 빼기" ${state.locked || count === 0 ? "disabled" : ""}>−</button>
        <span aria-live="polite"><strong>${count}</strong><small>회 훈련</small></span>
        <button type="button" data-adjust="1" data-routine="${routine}" aria-label="${LABEL[routine]} 훈련 1회 추가" ${state.locked || allocated() === TRAINING_REPS ? "disabled" : ""}>+</button>
      </div>
      <div class="tokens" aria-hidden="true">${Array.from({ length: count }, () => "<i></i>").join("")}</div>
    </article>`;
  }).join("");
}

function comparisonRow(label, values, className = "") {
  return `<div class="comparison-row ${className}">
    <strong>${label}</strong>
    ${ROUTINES.map((routine) => `<span>${values[routine]}</span>`).join("")}
  </div>`;
}

function receiptMarkup(card) {
  const receipt = card.event_receipts[0];
  if (!receipt) return "";
  const followUp = receipt.first_recorded_follow_up;
  const event = [EVENT_LABEL[followUp.event_name] ?? followUp.event_name,
    EVENT_LABEL[followUp.sub_event_name] ?? followUp.sub_event_name].join(" · ");
  return `<article>
    <span>${LABEL[card.situation]} · 실제 ${card.corners}회</span>
    <strong>키커: ${receipt.corner_taker?.display_name ?? "선수 미상"}</strong>
    <small>첫 후속 기록의 선수: ${followUp.actor?.display_name ?? "선수 미상"}</small>
    <small>첫 후속 기록의 팀: ${followUp.team_role === "attacking" ? "포르투갈" : "우루과이"}</small>
    <small>첫 후속 기록 ${event} · ${receipt.attacking_shot_within_10_seconds ? "10초 안 포르투갈 슈팅 기록 있음" : "10초 안 포르투갈 슈팅 기록 없음"}</small>
    <code>match ${receipt.match_id} · corner ${receipt.corner_event_id}</code>
  </article>`;
}

function differenceMarkup(audit) {
  const actual = audit.held_out_match.situation_counts;
  return `<div class="difference-grid" aria-label="훈련 배분과 실제 첫 전개 횟수의 차이">
    ${ROUTINES.map((routine) => {
      const difference = actual[routine] - state.allocation[routine];
      const label = difference === 0
        ? "횟수 차이 0"
        : difference > 0
          ? `실제가 ${difference}회 많음`
          : `훈련 배분이 ${Math.abs(difference)}회 많음`;
      return `<article><span>${LABEL[routine]}</span><strong>${label}</strong></article>`;
    }).join("")}
  </div>`;
}

function meetingNoteMarkup() {
  if (state.meetingNote) {
    return `<section class="meeting-receipt" data-testid="meeting-note-receipt" role="status" tabindex="-1">
      <span>다음 전술 회의 메모</span>
      <strong>${MEETING_DECISIONS[state.meetingNote.decision]}</strong>
      <p>${escapeHtml(state.meetingNote.reason)}</p>
      <small>이 메모는 이미 공개된 경기 기록과 훈련 배분을 바꾸지 않습니다.</small>
    </section>`;
  }
  return `<form class="meeting-note" data-action="save-meeting-note">
    <fieldset>
      <legend>이 차이를 보고 다음 회의의 결정을 남기세요</legend>
      <div class="meeting-options">
        ${Object.entries(MEETING_DECISIONS).map(([value, label]) =>
          `<label><input required type="radio" name="meeting-decision" value="${value}"><span>${label}</span></label>`).join("")}
      </div>
      <label class="meeting-reason" for="meeting-reason">이유 <span>(120자 이내)</span></label>
      <textarea id="meeting-reason" name="meeting-reason" maxlength="120" rows="3" required placeholder="예: 비숏 전달 뒤 기타 후속 기록이 예상보다 2회 많아 재배분을 검토"></textarea>
      <button type="submit">다음 회의 메모 저장</button>
    </fieldset>
  </form>`;
}

function resultMarkup(audit) {
  if (!state.revealed) return "";
  const reference = audit.opponent_attack_reference.situation_counts;
  const heldOut = audit.held_out_match;
  return `<section class="result" data-testid="scouting-result" tabindex="-1">
    <p class="eyebrow">가려 둔 맞대결 기록 공개</p>
    <h2>우루과이–포르투갈 · 포르투갈 코너 10개</h2>
    <p class="result-lead">훈련 효과를 채점하지 않습니다. 경기 전에 나눈 훈련 횟수와 실제 첫 전개 기록을 나란히 놓고, 다음 회의에서 무엇을 더 볼지 정합니다.</p>
    <p class="not-a-score"><strong>횟수가 같거나 비슷해도 훈련이 옳았다는 뜻은 아닙니다.</strong> 아래 비교는 다음 회의의 질문을 찾기 위한 기록입니다.</p>
    <div class="comparison" role="group" aria-label="훈련 배분, 조별리그 관측, 실제 맞대결 코너 상황 비교" tabindex="0">
      <div class="comparison-row headings"><strong></strong>${ROUTINES.map((routine) => `<span>${LABEL[routine]}</span>`).join("")}</div>
      ${comparisonRow("내 훈련 배분", state.allocation, "user-row")}
      ${comparisonRow("포르투갈 조별리그", reference)}
      ${comparisonRow("실제 맞대결", heldOut.situation_counts, "actual-row")}
    </div>
    ${differenceMarkup(audit)}
    <div class="receipt-grid">${heldOut.situation_cards.map(receiptMarkup).join("")}</div>
    <div class="result-boundary">
      <strong>실제 맞대결에서는 포르투갈 코너 10개 중 4개 뒤에 10초 안 슈팅 기록이 있었습니다.</strong>
      <span>어떤 훈련 배분이 이를 막았을지는 이 데이터로 알 수 없습니다. 선수 위치·마킹·도달 범위가 없기 때문입니다.</span>
    </div>
    ${meetingNoteMarkup()}
    <button class="restart" type="button" data-action="restart">다른 훈련 배분 검토하기</button>
  </section>`;
}

function render() {
  const scouting = report.team_scouting;
  const audit = routineAudit();
  const attack = audit.opponent_attack_reference;
  const defense = audit.manager_defensive_reference;
  const used = allocated();
  const remaining = TRAINING_REPS - used;
  app.innerHTML = `
    <header class="hero">
      <p class="eyebrow">CORNER PREP LAB · 2018 WORLD CUP</p>
      <h1>포르투갈 코너 상황 3유형.<br><span>훈련 10회를 어떻게 나눌까요?</span></h1>
      <p>포르투갈의 키커와 첫 전개, 우루과이가 실제로 겪은 수비 상황을 따로 보고 경기 전 훈련을 배분하세요.</p>
      <aside><strong>두 팀의 기록을 하나의 성공률로 합치지 않습니다.</strong> 작은 표본과 빠진 정보를 함께 보여 주며, 최종 판단은 감독이 합니다.</aside>
    </header>

    <section class="workspace" data-routine-status="${audit.status}" data-revealed="${state.revealed}">
      <div class="matchup">
        <strong>2018 월드컵 16강 · 우루과이 vs 포르투갈</strong>
        <span>맞대결 10개 코너의 첫 전개는 훈련 배분을 잠글 때까지 가려 둡니다.</span>
      </div>
      <div class="quick-evidence" aria-label="두 팀의 사전 기록 수">
        <article>
          <span>포르투갈 공격 기록</span>
          <strong>${attack.classifiable_corners}/${attack.source_corners}</strong>
          <small>조별리그 코너 · 전부 유형 분류</small>
        </article>
        <article>
          <span>우루과이 수비 상황</span>
          <strong>${defense.classifiable_corners}/${defense.source_corners}</strong>
          <small>조별리그 상대 코너 · 1개 분류 제외</small>
        </article>
      </div>
      <p class="allocation-goal"><strong>목표</strong> 상대의 관측된 코너 상황에 대비할 훈련 10회의 비중을 정합니다.</p>
      <div class="routine-grid" aria-label="상대 코너 첫 전개 훈련 10회 배분">${routineCards(audit)}</div>

      <div class="commit">
        <div>
          <span>경기 전 훈련 계획</span>
          <strong data-testid="allocation-summary">${used}회 배분 · ${remaining}회 남음</strong>
          <small>${state.locked ? "맞대결 기록을 보기 전에 잠갔습니다." : "자동 추천 없이 직접 10회를 모두 나누세요."}</small>
        </div>
        ${!state.locked
          ? `<button type="button" data-action="lock" ${remaining === 0 ? "" : "disabled"}>훈련 10회를 결과 전에 잠그기</button>`
          : !state.revealed
            ? `<button type="button" data-action="reveal">가려 둔 맞대결 첫 전개 보기</button>`
            : ""}
      </div>
      <p class="always-boundary"><strong>이 배분은 전술 추천이 아닙니다.</strong> 키커·첫 후속·첫 수비는 데이터에 남은 기록이며, 선수의 당시 위치와 마킹 방식은 없습니다. 훈련 효과, 수비 성공, 실점 방지, 최적 전술은 판단하지 않습니다.</p>
      ${resultMarkup(audit)}
      <details class="method-context">
        <summary>왜 이렇게 나누나요? 팀 기록과 기획 변경 보기</summary>
        <p class="correction-note"><strong>기획서의 가설을 데이터로 다시 검증했습니다.</strong> 두 역할·두 구역 선택은 팀별 정보 이득이 사라져 기각했습니다. ‘제한된 자원 → 결과 전에 확정 → 가려 둔 경기 공개’ 구조는 유지하고, 기록에서 직접 확인할 수 있는 훈련 배분으로 바꿨습니다.</p>
        <div class="briefing">
          <div class="brief-title">
            <p class="eyebrow">두 팀 사전 브리핑</p>
            <h2>상대의 코너 뒤 첫 전개와 우리 팀이 겪은 수비 상황을 따로 비교합니다</h2>
            <p>포르투갈 14개는 상대 공격 기록, 우루과이 5개는 우리 수비가 실제로 겪은 상황입니다. 우루과이 표본 1개는 전달 끝점을 분류할 수 없어 유형별 횟수에서 제외했습니다.</p>
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
          <strong>숫자가 작을수록 모르는 것이 많습니다</strong>
        </div>
      </details>
    </section>

    <section class="audit">
      <div>
        <p class="eyebrow">왜 단순 위치 통계와 다른가</p>
        <h2>구역 수만 보지 않고 ‘누가 차고 → 누가 첫 후속 기록에 남았고 → 10초 안 무엇이 기록됐는지’를 팀별로 확인합니다.</h2>
      </div>
      <div class="audit-metrics">
        <article><strong>8/14</strong><span>포르투갈 조별리그 · 콰레스마 코너</span></article>
        <article><strong>6회</strong><span>첫 공격 기록 · 하파엘 게헤이루</span></article>
        <article><strong>5/6</strong><span>우루과이 수비 상황 · 유형 분류</span></article>
      </div>
      <p>팀별 전달 위치 확률은 대회 평균보다 토너먼트 160개에서 로그손실을 4.59% 줄였지만, 두 구역으로 압축하면 이점이 사라졌습니다. 그래서 선수 배치와 ‘최적 두 곳’은 버리고, 두 팀의 실제 코너 기록을 따로 보며 훈련 자원만 직접 배분합니다.</p>
      <details>
        <summary>자료·분류 규칙·판단 한계</summary>
        <ul>
          <li>숏 구역 전달: 프로젝트가 정의한 숏 구역에서 끝난 코너입니다.</li>
          <li>비숏·공중 후속 기록: 숏이 아니며 첫 후속 기록이 공중 경합 또는 헤더 패스인 코너입니다.</li>
          <li>비숏·기타 후속 기록: 나머지 분류 가능한 비숏 전달로, 첫 후속 기록의 실제 유형을 함께 공개합니다.</li>
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
  const adjuster = event.target.closest("[data-adjust]");
  if (adjuster) {
    adjustAllocation(adjuster.dataset.routine, Number(adjuster.dataset.adjust));
    render();
    if (allocated() === TRAINING_REPS) {
      document.querySelector('[data-action="lock"]')?.focus();
    } else {
      document.querySelector(
        `[data-routine="${adjuster.dataset.routine}"][data-adjust="${adjuster.dataset.adjust}"]`,
      )?.focus();
    }
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
  if (action === "restart") document.querySelector('[data-routine="short-recorded-endpoint"][data-adjust="1"]')?.focus();
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
