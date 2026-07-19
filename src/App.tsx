import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import rawArtifact from "virtual:corner-scenarios";
import {
  ArtifactValidationError,
  commitDuty,
  createEvidenceModel,
  duties,
  dutyLabel,
  eventLabel,
  initialWarRoomState,
  openCounterexample,
  promiseCopy,
  selectedContactCount,
  stepFrame,
  type DefensiveDuty,
  type Duty,
  type Primitive,
  type WarRoomState,
} from "./domain/cornerEvidence";

class EvidenceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Corner evidence rejected", error, info.componentStack); }
  render() {
    if (this.state.failed) return <main className="failure"><div role="alert"><h1>검증된 기록을 불러오지 못했습니다.</h1>{" "}<p>합성 결과를 대신 표시하지 않습니다.</p></div></main>;
    return this.props.children;
  }
}

const shortLabels: Record<Duty, string> = {
  outlet: "역습 유지", "check-short": "숏 코너", "near-post-side": "니어포스트", "central-to-far": "중앙·파포스트", "second-ball": "세컨드볼",
};

const regions: Record<DefensiveDuty, { x: number; y: number; width: number; height: number }> = {
  "check-short": { x: 85, y: 0, width: 15, height: 25 },
  "near-post-side": { x: 85, y: 25, width: 15, height: 20 },
  "central-to-far": { x: 85, y: 45, width: 15, height: 25 },
  "second-ball": { x: 70, y: 20, width: 15, height: 60 },
};

const pitchX = (value: number) => value * 1.45;

function PrimitiveMark({ primitive, current }: { primitive: Primitive; current: boolean }) {
  const position = primitive.normalized_positions[0];
  if (!position) return null;
  const className = `event-mark ${primitive.team_role} ${current ? "current" : ""}`;
  if (primitive.visual === "segment" && primitive.normalized_positions[1]) {
    const end = primitive.normalized_positions[1];
    return <line className={className} data-event-kind={primitive.event_name} data-render-kind="segment" x1={pitchX(position.x)} y1={position.y} x2={pitchX(end.x)} y2={end.y} />;
  }
  return <circle className={className} cx={pitchX(position.x)} cy={position.y} data-event-kind={primitive.event_name} data-render-kind="marker" r={current ? 2.4 : 1.5} />;
}

function EvidencePitch({ state, primitives, roleRef, dragging, onRoleClick, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: {
  state: WarRoomState;
  primitives: Primitive[];
  roleRef: RefObject<HTMLButtonElement | null>;
  dragging: boolean;
  onRoleClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const selected = state.duty === "outlet" ? null : regions[state.duty];
  return (
    <div className="pitch-stage" data-layout-critical>
      <svg aria-hidden="true" className="evidence-pitch" data-motion data-testid="evidence-pitch" preserveAspectRatio="xMidYMid meet" viewBox="0 0 145 100">
        <rect className="pitch-boundary" x="2" y="2" width="141" height="96" />
        <path className="box-line" d="M145 18H118.9V82H145M145 36H134.85V64H145" />
        <path className="box-line" d="M118.9 50H113.1" />
        {selected && <rect className="selected-region" height={selected.height} width={pitchX(selected.width)} x={pitchX(selected.x)} y={selected.y} />}
        {primitives.map((primitive, index) => <PrimitiveMark current={index === primitives.length - 1} key={primitive.event_id} primitive={primitive} />)}
      </svg>
      <span className="corner-flag" aria-hidden="true">⚑</span>
      <button
        aria-controls="mission-tray"
        aria-label="역습 역할 1명을 수비 임무로 옮기기"
        className={`role-token ${dragging ? "dragging" : ""}`}
        data-duty-position={state.duty}
        id="role-token"
        onClick={onRoleClick}
        onLostPointerCapture={onPointerCancel}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={roleRef}
        type="button"
      >역습 1명<span>옮기기</span></button>
      <div className="pitch-legend" aria-hidden="true"><span className="legend-bra">BRA</span><span className="legend-def">DEF</span></div>
    </div>
  );
}

function WarRoom() {
  const model = useMemo(() => createEvidenceModel(rawArtifact as unknown), []);
  const [state, setState] = useState(initialWarRoomState);
  const [announcement, setAnnouncement] = useState("");
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const missionRefs = useRef(new Map<DefensiveDuty, HTMLButtonElement>());
  const roleRef = useRef<HTMLButtonElement>(null);
  const receiptRef = useRef<HTMLElement>(null);
  const counterHeadingRef = useRef<HTMLHeadingElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const activeWindow = state.windowId === null ? null : model.windowsById.get(state.windowId) ?? null;
  const primitives = activeWindow ? activeWindow.primitives.slice(0, state.frameIndex + 1) : [];
  const current = primitives.at(-1) ?? null;
  const currentContact = state.duty === "outlet" || !activeWindow ? false : activeWindow.contact[state.duty];
  const semanticSnapshot = {
    duty: state.duty,
    windowId: state.windowId,
    windowKind: state.windowKind,
    frameIndex: state.frameIndex,
    selectedContacts: selectedContactCount(model, state.duty),
    promiseCopyKey: state.duty,
    counterexampleWindowId: state.duty === "outlet" ? null : model.counterexampleWindowIds[state.duty],
    evidenceFingerprint: model.fingerprint,
    orderedEventIds: activeWindow?.event_ids ?? [],
    renderedEventIds: primitives.map((primitive) => primitive.event_id),
    currentEvent: current ? {
      kind: current.event_name,
      sourceId: String(current.event_id),
      team: current.team_role,
      clock: activeWindow?.period_clock ?? "",
      contact: currentContact,
    } : null,
    announcementCount,
  };

  useEffect(() => {
    if (state.playback !== "playing" || !activeWindow) return;
    const timer = globalThis.setTimeout(() => {
      setState((active) => {
        if (active.windowId !== activeWindow.corner_event_id) return active;
        if (active.frameIndex >= activeWindow.primitives.length - 1) return { ...active, playback: "complete" };
        const next = active.frameIndex + 1;
        return { ...active, frameIndex: next, playback: next === activeWindow.primitives.length - 1 ? "complete" : "playing" };
      });
    }, 720);
    return () => globalThis.clearTimeout(timer);
  }, [state.playback, state.frameIndex, activeWindow]);

  useEffect(() => {
    if (state.view === "counterexample") counterHeadingRef.current?.focus();
  }, [state.view]);

  useEffect(() => {
    if (state.duty !== "outlet") receiptRef.current?.scrollIntoView({ block: "start" });
  }, [state.duty]);

  const chooseDuty = (duty: Duty) => {
    const next = commitDuty(model, duty);
    setState(next);
    setAnnouncement(duty === "outlet"
      ? "처음 상태로 돌아왔습니다. 과거 기록과 고정 집계는 그대로입니다."
      : `역습 역할 1명을 ${dutyLabel(duty)}로 전환했습니다. 과거 기록과 고정 패널 수치는 그대로이고, 선택 구역과의 겹침 표시만 바뀌었습니다.`);
    setAnnouncementCount(duty === "outlet" ? 0 : 1);
    roleRef.current?.focus();
  };

  const reset = () => {
    setState(initialWarRoomState);
    setAnnouncement("처음 상태로 돌아왔습니다. 과거 기록과 고정 집계는 그대로입니다.");
    setAnnouncementCount(0);
    roleRef.current?.focus();
  };

  const onRoleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      if (event.detail > 0) return;
    }
    missionRefs.current.get("check-short")?.focus();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >= 6) {
      gesture.moved = true;
      setDragging(true);
      setDragPoint({ x: event.clientX, y: event.clientY });
    }
  };

  const clearPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
    setDragPoint(null);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = dragRef.current;
    if (gesture?.moved) {
      const duty = (duties.slice(1) as DefensiveDuty[]).find((candidate) => {
        const rect = missionRefs.current.get(candidate)?.getBoundingClientRect();
        return rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
      suppressClick.current = true;
      globalThis.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (duty && duties.includes(duty)) chooseDuty(duty);
    }
    clearPointer(event);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) clearPointer(event);
  };

  return (
    <main data-evidence-fingerprint={model.fingerprint}>
      <header className="hero">
        <p className="eyebrow">CORNER WAR ROOM · 2018 HISTORICAL EVIDENCE</p>
        <h1>코너 수비에 한 명 더. <br /><span>역습에는 한 명 덜.</span></h1>
        <p className="instruction">역습에 한 명을 남길지, 코너 수비에 투입할지 선택하세요.</p>
      </header>

      <section className="manager-stage" aria-label="코너 수비 임무 선택">
        <EvidencePitch
          dragging={dragging}
          onPointerCancel={onPointerCancel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onRoleClick={onRoleClick}
          primitives={primitives}
          roleRef={roleRef}
          state={state}
        />
        <div className="mission-tray" data-layout-critical id="mission-tray">
          {(duties.slice(1) as DefensiveDuty[]).map((duty) => (
            <button
              aria-label={dutyLabel(duty)}
              aria-pressed={state.duty === duty}
              className={state.duty === duty ? "selected" : ""}
              data-duty={duty}
              key={duty}
              onClick={() => chooseDuty(duty)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  roleRef.current?.focus();
                }
              }}
              ref={(node) => { if (node) missionRefs.current.set(duty, node); }}
              type="button"
            ><span aria-hidden="true" data-testid={state.duty === duty ? "selected-indicator" : undefined}>{state.duty === duty ? "✓ 선택 " : ""}</span>{shortLabels[duty]}</button>
          ))}
        </div>
        <p className="limitation-badge">2018 브라질 경기 기록 · 결과 예측 아님 · 프로젝트에서 정의한 구역</p>
        <p className="token-legend">노란 표시는 정확한 선수 위치나 도달 범위가 아니라 추가 수비 임무입니다.</p>
        {state.duty === "outlet" && announcement && <p className="reset-status" role="status">{announcement}</p>}
      </section>
      {dragging && dragPoint && <div
        aria-hidden="true"
        className="role-token role-drag-ghost"
        data-testid="role-drag-ghost"
        style={{ left: dragPoint.x, top: dragPoint.y }}
      >역습 1명<span>옮기기</span></div>}

      <p aria-atomic="true" className="sr-only" role="status">{announcement}</p>
      <pre className="sr-only" data-testid="semantic-snapshot">{JSON.stringify(semanticSnapshot)}</pre>
      <span className="sr-only" data-testid="evidence-fingerprint">{model.fingerprint}</span>
      <span className="sr-only" data-testid="fixed-aggregates">{JSON.stringify({
        windows: model.artifact.summary.windows,
        shots: model.artifact.summary.shot_windows,
        delivery: model.artifact.summary.delivery_endpoint_windows,
        outlet: model.artifact.summary.defending_outlet_contact_windows,
      })}</span>

      {state.duty !== "outlet" && (
        <section className="receipt" aria-label="선택과 기록의 대조" data-testid="evidence-receipt" id="evidence-receipt" ref={receiptRef}>
          <div className="promise-card">
            <p className="section-kicker">내 약속 <span>COACH</span></p>
            <h2>{promiseCopy(state.duty)}</h2>
            <p className="claim-boundary"><strong>전술 효과를 나타내는 점수가 아닙니다.</strong> 선택한 우선 구역과 과거 기록이 겹친 횟수입니다.</p>
            <p>기록된 코너 {model.artifact.summary.windows}개 중 <strong>{selectedContactCount(model, state.duty)}개</strong>가 선택한 구역과 겹쳤습니다.</p>
          </div>

          <div className="evidence-grid">
            <section aria-labelledby="record-title" className="evidence-card reactive" data-evidence-panel>
              <p className="section-kicker">기록 <span>OBSERVATION</span></p>
              <h2 id="record-title" ref={counterHeadingRef} tabIndex={state.windowKind === "counterexample" ? -1 : undefined}>{state.windowKind === "counterexample" ? "이 선택으로 설명되지 않는 슈팅 기록" : "선택 구역과 겹친 기록"}</h2>
              {activeWindow ? <>
                <p className="match-line">{activeWindow.match_label.split(",")[0]?.replace(" - ", " vs ")} · 2018 · {activeWindow.period_clock}</p>
                <p className="record-id">코너 이벤트 #{activeWindow.corner_event_id}</p>
                {state.windowKind === "counterexample" && <p className="counter-verdict">이 슈팅 기록에는 선택한 우선 구역과 겹치는 지점이 없습니다. 이 선택이 슈팅을 막았을지는 알 수 없습니다.</p>}
                <div className="replay-controls">
                  <button disabled={state.frameIndex === 0} onClick={() => setState((value) => stepFrame(model, value, -1))} type="button">이전 장면</button>
                  <button onClick={() => setState((value) => value.playback === "playing" ? { ...value, playback: "paused" } : { ...value, frameIndex: value.playback === "complete" ? 0 : value.frameIndex, playback: "playing" })} type="button">
                    {state.playback === "playing" ? "일시정지" : state.playback === "complete" ? "처음부터 재생" : "재생"}
                  </button>
                  <button disabled={state.frameIndex === activeWindow.primitives.length - 1} onClick={() => setState((value) => stepFrame(model, value, 1))} type="button">다음 장면</button>
                </div>
                <p className="frame-count">현재 {state.frameIndex + 1} / 전체 {activeWindow.primitives.length}</p>
                {current && <div
                  className="transcript"
                  data-clock={activeWindow.period_clock}
                  data-contact={String(currentContact)}
                  data-source-id={String(current.event_id)}
                  data-team={current.team_role}
                  data-testid="current-event-transcript"
                >
                  <strong>{current.team_role === "brazil" ? "브라질 공격" : "당시 수비팀"}</strong>
                  <span>{eventLabel(current)}</span>
                  <span className="source-id">출처 이벤트 #{current.event_id}</span>
                  <span className="contact-state">선택 구역과 {currentContact ? "겹침" : "겹치지 않음"}</span>
                </div>}
                {state.windowKind !== "counterexample" && model.counterexampleWindowIds[state.duty] !== null && (
                  <button className="skeptic-action inline" onClick={() => setState((value) => openCounterexample(model, value))} type="button">
                    <span>반례 보기</span> 이 선택으로 설명되지 않는 슈팅 기록
                  </button>
                )}
              </> : <p>검증된 예시 기록이 없습니다.</p>}
            </section>

            <section aria-labelledby="fixed-title" className="evidence-card fixed" data-evidence-panel>
              <p className="section-kicker">고정 기록 <span>HISTORICAL</span></p>
              <h2 id="fixed-title">당시 수비팀의 걷어내기·패스</h2>
              <p>코너 기록 {model.artifact.summary.windows}개 중 <strong>{model.artifact.summary.defending_outlet_contact_windows}개</strong>에서 수비팀의 걷어내기·패스가 역습 대기 구역과 겹쳤습니다. 이 수치는 선택해도 바뀌지 않습니다.</p>
              <p className="straight-line">화면의 모든 선은 기록된 두 지점을 직선으로 연결한 표시일 뿐, 실제 공의 궤적이 아닙니다.</p>
            </section>
          </div>

          <p className="separation">두 기록은 서로 다른 장면이므로 하나의 점수로 합치지 않습니다.</p>
          <details className="trust-detail">
            <summary>관찰 근거와 출처</summary>
            <p>코너킥 전달 지점 {model.artifact.summary.windows}개: 숏 코너 {model.artifact.summary.delivery_endpoint_windows["check-short"]}, 니어포스트 {model.artifact.summary.delivery_endpoint_windows["near-post-side"]}, 중앙·파포스트 {model.artifact.summary.delivery_endpoint_windows["central-to-far"]}, 기타 {model.artifact.summary.delivery_endpoint_windows.other}. 구역 경계를 ±2씩 조정한 81가지 조건에서 전달 지점이 가장 많았던 구역은 숏 코너 {model.artifact.summary.sensitivity.delivery["check-short"].fixed_order_wins}회, 니어포스트 {model.artifact.summary.sensitivity.delivery["near-post-side"].fixed_order_wins}회였습니다.</p>
            <p>{model.artifact.provenance.attribution} · {model.artifact.provenance.license}</p>
          </details>
          <div className="receipt-actions">
            <button onClick={reset} type="button">초기화</button>
          </div>
        </section>
      )}
    </main>
  );
}

export function App() {
  return <EvidenceBoundary><WarRoom /></EvidenceBoundary>;
}
