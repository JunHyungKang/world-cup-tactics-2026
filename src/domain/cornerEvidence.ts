export const duties = ["outlet", "check-short", "near-post-side", "central-to-far", "second-ball"] as const;
export type Duty = (typeof duties)[number];
export type DefensiveDuty = Exclude<Duty, "outlet">;
export type WindowKind = "none" | "contact" | "counterexample";
export type Playback = "idle" | "playing" | "paused" | "complete";

export type Position = { x: number; y: number };
export type Primitive = {
  event_id: number;
  team_role: "brazil" | "defending";
  event_name: string;
  sub_event_name: string;
  offset_us: number;
  normalized_positions: Position[];
  visual: "segment" | "marker";
};
export type CornerWindow = {
  corner_event_id: number;
  match_id: number;
  match_label: string;
  period_clock: string;
  event_ids: number[];
  shot_in_window: boolean;
  contact: Record<DefensiveDuty, boolean>;
  shot_contact: Record<DefensiveDuty, boolean>;
  defending_outlet_contact: boolean;
  primitives: Primitive[];
};
export type CornerArtifact = {
  schema_version: 1;
  product_id: "corner-war-room";
  data_scope: "official-open-historical-tactics";
  provenance: {
    source_ids: string[];
    license: string;
    attribution: string;
    input_sha256: Record<string, string>;
  };
  limitations: string[];
  summary: {
    windows: number;
    delivery_endpoint_windows: Record<"check-short" | "near-post-side" | "central-to-far" | "other", number>;
    brazil_follow_up_contact_windows: Record<DefensiveDuty, number>;
    shot_windows: number;
    defending_outlet_contact_windows: number;
    skeptic_corner_event_ids: Record<DefensiveDuty, number>;
    sensitivity: {
      delivery: Record<"check-short" | "near-post-side" | "central-to-far" | "other", { min: number; nominal: number; max: number; fixed_order_wins: number }>;
      second_ball_follow_up: { min: number; max: number };
      second_ball_shots: { min: number; max: number };
      outlet_band: { min: number; max: number };
    };
  };
  windows: CornerWindow[];
};

export class ArtifactValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactValidationError";
  }
}

const labels: Record<Duty, string> = {
  outlet: "역습 역할 1명 유지",
  "check-short": "숏 코너 견제",
  "near-post-side": "니어포스트 수비",
  "central-to-far": "중앙·파포스트 수비",
  "second-ball": "세컨드볼 대비",
};

export function dutyLabel(duty: Duty) {
  return labels[duty];
}

const eventLabels: Record<string, string> = {
  "Air duel": "공중볼 경합",
  "Ground attacking duel": "공격 경합",
  "Ground defending duel": "수비 경합",
  "Ground loose ball duel": "루즈볼 경합",
  Foul: "파울",
  Corner: "코너킥",
  Offside: "오프사이드",
  Acceleration: "가속 드리블",
  Clearance: "걷어내기",
  Touch: "볼 터치",
  Cross: "크로스",
  "Hand pass": "손으로 전달",
  "Head pass": "헤더 패스",
  "High pass": "로빙 패스",
  Launch: "롱킥",
  "Simple pass": "일반 패스",
  "Smart pass": "침투 패스",
  Reflexes: "반사 신경 선방",
  "Save attempt": "선방 시도",
  Shot: "슈팅",
  Duel: "경합",
  "Free Kick": "세트피스",
  "Others on the ball": "볼 소유",
  Pass: "패스",
};

export function eventLabel(primitive: Pick<Primitive, "event_name" | "sub_event_name">) {
  return eventLabels[primitive.sub_event_name] ?? eventLabels[primitive.event_name] ?? "기타 기록";
}

export function validateArtifact(value: unknown): CornerArtifact {
  if (!value || typeof value !== "object") throw new ArtifactValidationError("기록 객체가 없습니다.");
  const artifact = value as Partial<CornerArtifact>;
  if (artifact.schema_version !== 1 || artifact.product_id !== "corner-war-room" || artifact.data_scope !== "official-open-historical-tactics") {
    throw new ArtifactValidationError("제품 ID나 기록 형식이 일치하지 않습니다.");
  }
  if (!artifact.provenance || artifact.provenance.license !== "CC BY 4.0" || artifact.provenance.source_ids?.length !== 2) {
    throw new ArtifactValidationError("출처 정보 또는 라이선스 연결이 누락되었습니다.");
  }
  if (!artifact.summary || artifact.summary.windows !== 42 || artifact.summary.shot_windows !== 11 ||
      artifact.summary.defending_outlet_contact_windows !== 10 || !Array.isArray(artifact.windows) || artifact.windows.length !== 42) {
    throw new ArtifactValidationError("검수를 마친 42개 기록의 집계가 일치하지 않습니다.");
  }
  const delivery = artifact.summary.delivery_endpoint_windows;
  const sensitivity = artifact.summary.sensitivity?.delivery;
  if (!delivery || Object.values(delivery).reduce((sum, count) => sum + count, 0) !== 42 ||
      !sensitivity || Object.values(sensitivity).reduce((sum, item) => sum + item.fixed_order_wins, 0) !== 81) {
    throw new ArtifactValidationError("전달 지점 또는 경계 민감도 집계가 일치하지 않습니다.");
  }
  const ids = new Set<number>();
  for (const window of artifact.windows) {
    if (!Number.isInteger(window.corner_event_id) || ids.has(window.corner_event_id) || !Array.isArray(window.primitives) || window.primitives.length === 0) {
      throw new ArtifactValidationError("기록 ID 또는 이벤트 순서가 유효하지 않습니다.");
    }
    ids.add(window.corner_event_id);
    if (window.event_ids.length !== window.primitives.length || window.event_ids.some((id, index) => id !== window.primitives[index]?.event_id)) {
      throw new ArtifactValidationError("기록된 이벤트 순서와 상세 이벤트 순서가 일치하지 않습니다.");
    }
  }
  for (const duty of duties.slice(1) as DefensiveDuty[]) {
    if (!ids.has(artifact.summary.skeptic_corner_event_ids[duty])) throw new ArtifactValidationError(`반례 기록이 없습니다: ${duty}`);
  }
  return artifact as CornerArtifact;
}

export type EvidenceModel = {
  artifact: CornerArtifact;
  fingerprint: string;
  contactWindowIds: Record<DefensiveDuty, number | null>;
  counterexampleWindowIds: Record<DefensiveDuty, number | null>;
  windowsById: Map<number, CornerWindow>;
};

export function createEvidenceModel(raw: unknown): EvidenceModel {
  const artifact = validateArtifact(raw);
  const windowsById = new Map(artifact.windows.map((window) => [window.corner_event_id, window]));
  const contactWindowIds = {} as Record<DefensiveDuty, number | null>;
  const counterexampleWindowIds = {} as Record<DefensiveDuty, number | null>;
  for (const duty of duties.slice(1) as DefensiveDuty[]) {
    contactWindowIds[duty] = artifact.windows.find((window) => window.contact[duty])?.corner_event_id ?? null;
    const skepticId = artifact.summary.skeptic_corner_event_ids[duty];
    const skeptic = windowsById.get(skepticId);
    counterexampleWindowIds[duty] = skeptic?.shot_in_window && !skeptic.shot_contact[duty] ? skepticId : null;
  }
  const fingerprint = Object.values(artifact.provenance.input_sha256).join("").slice(0, 16);
  return { artifact, fingerprint, contactWindowIds, counterexampleWindowIds, windowsById };
}

export type WarRoomState = {
  duty: Duty;
  windowId: number | null;
  windowKind: WindowKind;
  frameIndex: number;
  playback: Playback;
  view: "observation" | "promise" | "counterexample";
};

export const initialWarRoomState: WarRoomState = {
  duty: "outlet", windowId: null, windowKind: "none", frameIndex: 0, playback: "idle", view: "observation",
};

export function commitDuty(model: EvidenceModel, duty: Duty): WarRoomState {
  if (duty === "outlet") return { ...initialWarRoomState };
  const windowId = model.contactWindowIds[duty];
  return { duty, windowId, windowKind: windowId === null ? "none" : "contact", frameIndex: 0,
    playback: windowId === null ? "idle" : "paused", view: "promise" };
}

export function openCounterexample(model: EvidenceModel, state: WarRoomState): WarRoomState {
  if (state.duty === "outlet") return state;
  const windowId = model.counterexampleWindowIds[state.duty];
  return windowId === null ? state : { ...state, windowId, windowKind: "counterexample", frameIndex: 0, playback: "paused", view: "counterexample" };
}

export function stepFrame(model: EvidenceModel, state: WarRoomState, delta: -1 | 1): WarRoomState {
  if (state.windowId === null) return state;
  const window = model.windowsById.get(state.windowId);
  if (!window) return state;
  const next = Math.min(window.primitives.length - 1, Math.max(0, state.frameIndex + delta));
  return { ...state, frameIndex: next, playback: next === window.primitives.length - 1 && delta === 1 ? "complete" : "paused" };
}

export function selectedContactCount(model: EvidenceModel, duty: Duty) {
  return duty === "outlet" ? 0 : model.artifact.summary.brazil_follow_up_contact_windows[duty];
}

export function promiseCopy(duty: Duty) {
  return duty === "outlet" ? "역습 역할 1명을 유지합니다." : `${dutyLabel(duty)} 우선 · 역습 1명 수비 전환`;
}
