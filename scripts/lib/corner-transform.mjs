import { createHash } from "node:crypto";

export const BRAZIL_TEAM_ID = 6380;
export const WINDOW_US = 10_000_000;
export const TRANSFORM_VERSION = "corner-window-v1";

export const INPUT_HASHES = Object.freeze({
  eventsZip: "877e015b716ffdeea18f04418e3f24fed307ed03c37ff305cabe1f47c4822a45",
  events: "d789b7cd80671a0dd1263150e997d1450e1ed22cddc8beb7bb2a6266b374a869",
  matchesZip: "c8f92bb7533e5c127e043cee764c991b5c25b4f5e70a65be931baae0b1765ce9",
  matches: "1ddab20c8605c063a62341eb846466c8d040885a5f0f9a3e26d023123786abb6",
});

export const NOMINAL_REGIONS = Object.freeze({
  "check-short": { xMin: 85, xMax: 100, yMin: 0, yMax: 25, xMaxInclusive: true, yMaxInclusive: false },
  "near-post-side": { xMin: 85, xMax: 100, yMin: 25, yMax: 45, xMaxInclusive: true, yMaxInclusive: false },
  "central-to-far": { xMin: 85, xMax: 100, yMin: 45, yMax: 70, xMaxInclusive: true, yMaxInclusive: true },
  "second-ball": { xMin: 70, xMax: 85, yMin: 20, yMax: 80, xMaxInclusive: false, yMaxInclusive: true },
  "outlet-band": { xMin: 45, xMax: 70, yMin: 20, yMax: 80, xMaxInclusive: false, yMaxInclusive: true },
});

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function eventMicroseconds(event) {
  return Math.round(Number(event.eventSec) * 1_000_000);
}

export function stableEventOrder(a, b) {
  return eventMicroseconds(a) - eventMicroseconds(b) || Number(a.id) - Number(b.id);
}

export function isFinitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100;
}

export function isPlaceholder(point) {
  return (point.x === 0 && point.y === 0) || (point.x === 100 && point.y === 100);
}

export function normalizePoint(point, teamId, mirrorLaterally) {
  const teamPoint = Number(teamId) === BRAZIL_TEAM_ID
    ? { x: point.x, y: point.y }
    : { x: 100 - point.x, y: 100 - point.y };
  return mirrorLaterally ? { x: teamPoint.x, y: 100 - teamPoint.y } : teamPoint;
}

export function reverseNormalizedPoint(point, teamId, mirrorLaterally) {
  const lateral = mirrorLaterally ? { x: point.x, y: 100 - point.y } : point;
  return Number(teamId) === BRAZIL_TEAM_ID
    ? { x: lateral.x, y: lateral.y }
    : { x: 100 - lateral.x, y: 100 - lateral.y };
}

function upper(value, inclusive) {
  return inclusive ? value : value - 1e-9;
}

export function pointInRegion(point, region) {
  return point.x >= region.xMin && point.x <= upper(region.xMax, region.xMaxInclusive) &&
    point.y >= region.yMin && point.y <= upper(region.yMax, region.yMaxInclusive);
}

export function segmentTouchesRegion(start, end, region) {
  const minX = region.xMin;
  const maxX = upper(region.xMax, region.xMaxInclusive);
  const minY = region.yMin;
  const maxY = upper(region.yMax, region.yMaxInclusive);
  let low = 0;
  let high = 1;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  for (const [p, q] of [[-dx, start.x - minX], [dx, maxX - start.x], [-dy, start.y - minY], [dy, maxY - start.y]]) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return false;
      continue;
    }
    const ratio = q / p;
    if (p < 0) low = Math.max(low, ratio);
    else high = Math.min(high, ratio);
    if (low > high) return false;
  }
  return high >= 0 && low <= 1;
}

export function recordedWindow(sortedEvents, corner) {
  const startIndex = sortedEvents.findIndex((event) => Number(event.id) === Number(corner.id));
  if (startIndex < 0) throw new Error(`corner ${corner.id} is absent from its sorted period`);
  const startUs = eventMicroseconds(corner);
  const result = [];
  for (let index = startIndex; index < sortedEvents.length; index += 1) {
    const event = sortedEvents[index];
    const deltaUs = eventMicroseconds(event) - startUs;
    if (deltaUs > WINDOW_US) break;
    if (deltaUs >= 0) result.push(event);
  }
  return result;
}

function clock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

function absoluteOffset(period) {
  return ({ "1H": 0, "2H": 45 * 60, E1: 90 * 60, E2: 105 * 60, P: 120 * 60 })[period] ?? 0;
}

export function regionVariants(duty) {
  const shifts = [-2, 0, 2];
  const variants = [];
  if (duty === "second-ball") {
    for (const xMinShift of shifts) for (const xMaxShift of shifts) for (const yMinShift of shifts) for (const yMaxShift of shifts) {
      variants.push({ ...NOMINAL_REGIONS[duty], xMin: 70 + xMinShift, xMax: 85 + xMaxShift, yMin: 20 + yMinShift, yMax: 80 + yMaxShift });
    }
    return variants;
  }
  for (const xShift of shifts) for (const y25Shift of shifts) for (const y45Shift of shifts) for (const y70Shift of shifts) {
    const y25 = 25 + y25Shift;
    const y45 = 45 + y45Shift;
    const y70 = 70 + y70Shift;
    if (!(y25 < y45 && y45 < y70)) continue;
    const shared = { xMin: 85 + xShift, xMax: 100, xMaxInclusive: true };
    variants.push(duty === "check-short"
      ? { ...shared, yMin: 0, yMax: y25, yMaxInclusive: false }
      : duty === "near-post-side"
        ? { ...shared, yMin: y25, yMax: y45, yMaxInclusive: false }
        : { ...shared, yMin: y45, yMax: y70, yMaxInclusive: true });
  }
  return variants;
}

function classifyDelivery(point) {
  for (const duty of ["check-short", "near-post-side", "central-to-far"]) {
    if (pointInRegion(point, NOMINAL_REGIONS[duty])) return duty;
  }
  return "other";
}

function primitiveFor(event, corner, mirrorLaterally) {
  const source = Array.isArray(event.positions) ? event.positions.filter(isFinitePoint).map((point) => ({ x: point.x, y: point.y })) : [];
  if (source.length === 0) return null;
  const normalized = source.map((point) => normalizePoint(point, event.teamId, mirrorLaterally));
  const isShot = event.eventName === "Shot";
  const passOrClearance = event.eventName === "Pass" || event.subEventName === "Clearance";
  const canSegment = source.length === 2 && (Number(event.id) === Number(corner.id) ||
    (!isShot && passOrClearance && !isPlaceholder(source[1])));
  return {
    event_id: Number(event.id),
    team_role: Number(event.teamId) === BRAZIL_TEAM_ID ? "brazil" : "defending",
    event_name: event.eventName,
    sub_event_name: event.subEventName,
    offset_us: eventMicroseconds(event) - eventMicroseconds(corner),
    tags: (event.tags ?? []).map((tag) => Number(tag.id)),
    source_positions: source,
    normalized_positions: normalized,
    visual: isShot ? "shot-marker" : canSegment ? "segment" : "marker",
  };
}

export function primitiveTouches(primitive, region) {
  const [start, end] = primitive.normalized_positions;
  return pointInRegion(start, region) || (primitive.visual === "segment" && end && segmentTouchesRegion(start, end, region));
}

function buildWindow(corner, periodEvents, match) {
  if (!Array.isArray(corner.positions) || corner.positions.length !== 2 || !corner.positions.every(isFinitePoint)) {
    throw new Error(`corner ${corner.id} does not have two valid positions`);
  }
  const events = recordedWindow(periodEvents, corner);
  const mirrorLaterally = corner.positions[0].y > 50;
  const primitives = events.map((event) => primitiveFor(event, corner, mirrorLaterally)).filter(Boolean);
  const cornerPrimitive = primitives.find((primitive) => primitive.event_id === Number(corner.id));
  const deliveryEndpoint = cornerPrimitive.normalized_positions[1];
  const followUps = primitives.filter((primitive) => primitive.event_id !== Number(corner.id) && primitive.team_role === "brazil");
  const defendingOutlet = primitives.filter((primitive) => primitive.team_role === "defending" &&
    (primitive.event_name === "Pass" || primitive.sub_event_name === "Clearance"));
  const shots = followUps.filter((primitive) => primitive.event_name === "Shot");
  const contact = {};
  for (const duty of ["check-short", "near-post-side", "central-to-far", "second-ball"]) {
    contact[duty] = followUps.some((primitive) => primitiveTouches(primitive, NOMINAL_REGIONS[duty]));
  }
  const periodSec = Number(corner.eventSec);
  return {
    corner_event_id: Number(corner.id),
    match_id: Number(corner.matchId),
    match_label: match.label,
    period: corner.matchPeriod,
    period_clock: `${corner.matchPeriod} ${clock(periodSec)}`,
    absolute_clock: clock(periodSec + absoluteOffset(corner.matchPeriod)),
    corner_sec: periodSec,
    corner_tags: (corner.tags ?? []).map((tag) => Number(tag.id)),
    normalization_side: mirrorLaterally ? "source-bottom-mirrored-to-top" : "source-top",
    delivery: {
      source_start: cornerPrimitive.source_positions[0],
      source_end: cornerPrimitive.source_positions[1],
      normalized_start: cornerPrimitive.normalized_positions[0],
      normalized_end: deliveryEndpoint,
      class: classifyDelivery(deliveryEndpoint),
    },
    event_ids: events.map((event) => Number(event.id)),
    shot_in_window: shots.length > 0,
    goal_tagged_shot_in_window: shots.some((shot) => shot.tags.includes(101)),
    contact,
    shot_contact: Object.fromEntries(["check-short", "near-post-side", "central-to-far", "second-ball"].map((duty) => [
      duty, shots.some((shot) => primitiveTouches(shot, NOMINAL_REGIONS[duty])),
    ])),
    defending_outlet_contact: defendingOutlet.some((primitive) => primitiveTouches(primitive, NOMINAL_REGIONS["outlet-band"])),
    primitives,
  };
}

function robustSkeptic(windows, duty) {
  const variants = regionVariants(duty);
  return windows.find((window) => {
    const shots = window.primitives.filter((primitive) => primitive.team_role === "brazil" && primitive.event_name === "Shot");
    return shots.length > 0 && shots.every((shot) => variants.every((region) => !primitiveTouches(shot, region)));
  })?.corner_event_id ?? null;
}

function range(values) {
  return { min: Math.min(...values), nominal: values[Math.floor(values.length / 2)], max: Math.max(...values) };
}

export function sensitivitySummary(windows) {
  const shifts = [-2, 0, 2];
  const deliveryCounts = { "check-short": [], "near-post-side": [], "central-to-far": [], other: [] };
  const deliveryWins = { "check-short": 0, "near-post-side": 0, "central-to-far": 0, other: 0 };
  for (const xShift of shifts) for (const y25Shift of shifts) for (const y45Shift of shifts) for (const y70Shift of shifts) {
    const y25 = 25 + y25Shift;
    const y45 = 45 + y45Shift;
    const y70 = 70 + y70Shift;
    const regions = {
      "check-short": { xMin: 85 + xShift, xMax: 100, yMin: 0, yMax: y25, xMaxInclusive: true, yMaxInclusive: false },
      "near-post-side": { xMin: 85 + xShift, xMax: 100, yMin: y25, yMax: y45, xMaxInclusive: true, yMaxInclusive: false },
      "central-to-far": { xMin: 85 + xShift, xMax: 100, yMin: y45, yMax: y70, xMaxInclusive: true, yMaxInclusive: true },
    };
    const counts = { "check-short": 0, "near-post-side": 0, "central-to-far": 0, other: 0 };
    for (const window of windows) {
      const point = window.delivery.normalized_end;
      const duty = ["check-short", "near-post-side", "central-to-far"].find((name) => pointInRegion(point, regions[name])) ?? "other";
      counts[duty] += 1;
    }
    for (const name of Object.keys(counts)) deliveryCounts[name].push(counts[name]);
    const winner = ["check-short", "near-post-side", "central-to-far", "other"].reduce((best, name) => counts[name] > counts[best] ? name : best, "check-short");
    deliveryWins[winner] += 1;
  }
  const bandSensitivity = (duty, selector) => {
    const values = regionVariants(duty).map((region) => windows.filter((window) => selector(window).some((primitive) => primitiveTouches(primitive, region))).length);
    return { min: Math.min(...values), max: Math.max(...values) };
  };
  return {
    delivery: Object.fromEntries(Object.entries(deliveryCounts).map(([name, values]) => [name, { ...range(values), fixed_order_wins: deliveryWins[name] }])),
    second_ball_follow_up: bandSensitivity("second-ball", (window) => window.primitives.filter((primitive) => primitive.team_role === "brazil" && primitive.event_id !== window.corner_event_id)),
    second_ball_shots: bandSensitivity("second-ball", (window) => window.primitives.filter((primitive) => primitive.team_role === "brazil" && primitive.event_name === "Shot")),
    outlet_band: (() => {
      const values = regionVariants("second-ball").map((variant) => {
        const region = { ...variant, xMin: variant.xMin - 25, xMax: variant.xMax - 15 };
        return windows.filter((window) => window.primitives
          .filter((primitive) => primitive.team_role === "defending" && (primitive.event_name === "Pass" || primitive.sub_event_name === "Clearance"))
          .some((primitive) => primitiveTouches(primitive, region))).length;
      });
      return { min: Math.min(...values), max: Math.max(...values) };
    })(),
  };
}

export function deriveCornerData(events, matches) {
  const matchById = new Map(matches.map((match) => [Number(match.wyId), match]));
  const byPeriod = new Map();
  for (const event of events) {
    const key = `${event.matchId}:${event.matchPeriod}`;
    if (!byPeriod.has(key)) byPeriod.set(key, []);
    byPeriod.get(key).push(event);
  }
  for (const periodEvents of byPeriod.values()) periodEvents.sort(stableEventOrder);
  const corners = events.filter((event) => event.subEventName === "Corner" && Number(event.teamId) === BRAZIL_TEAM_ID).sort((a, b) =>
    Number(a.matchId) - Number(b.matchId) || String(a.matchPeriod).localeCompare(String(b.matchPeriod)) || stableEventOrder(a, b));
  if (corners.length !== 42) throw new Error(`expected 42 Brazil corners, found ${corners.length}`);
  const windows = corners.map((corner) => {
    const match = matchById.get(Number(corner.matchId));
    if (!match) throw new Error(`missing match ${corner.matchId}`);
    return buildWindow(corner, byPeriod.get(`${corner.matchId}:${corner.matchPeriod}`), match);
  });
  const duties = ["check-short", "near-post-side", "central-to-far", "second-ball"];
  const summary = {
    windows: windows.length,
    delivery_endpoint_windows: Object.fromEntries(["check-short", "near-post-side", "central-to-far", "other"].map((duty) => [duty, windows.filter((window) => window.delivery.class === duty).length])),
    brazil_follow_up_contact_windows: Object.fromEntries(duties.map((duty) => [duty, windows.filter((window) => window.contact[duty]).length])),
    brazil_shot_contact_windows: Object.fromEntries(duties.map((duty) => [duty, windows.filter((window) => window.shot_contact[duty]).length])),
    shot_windows: windows.filter((window) => window.shot_in_window).length,
    goal_tagged_shot_windows: windows.filter((window) => window.goal_tagged_shot_in_window).length,
    defending_outlet_contact_windows: windows.filter((window) => window.defending_outlet_contact).length,
    skeptic_corner_event_ids: Object.fromEntries(duties.map((duty) => [duty, robustSkeptic(windows, duty)])),
  };
  summary.sensitivity = sensitivitySummary(windows);
  return { windows, summary };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function auditCsv(windows, semanticReview = null) {
  const columns = [
    "corner_event_id", "match_id", "match_label", "period", "corner_sec", "corner_tags",
    "source_start", "source_end", "window_event_ids", "window_event_count", "shot_in_window",
    "goal_tagged_shot_in_window", "normalization_side", "structural_check", "semantic_check", "reviewer_note",
  ];
  const structuralPass = new Set(semanticReview?.structural_pass_ids ?? []);
  const semanticPass = new Set(semanticReview?.semantic_pass_ids ?? []);
  const segmentOnly = new Set(semanticReview?.segment_only_disclosure_ids ?? []);
  const rows = windows.map((window) => [
    window.corner_event_id, window.match_id, window.match_label, window.period, window.corner_sec,
    window.corner_tags.join("|"), `${window.delivery.source_start.x}:${window.delivery.source_start.y}`,
    `${window.delivery.source_end.x}:${window.delivery.source_end.y}`, window.event_ids.join("|"),
    window.event_ids.length, window.shot_in_window, window.goal_tagged_shot_in_window,
    window.normalization_side,
    structuralPass.has(window.corner_event_id) ? "pass" : "pending",
    semanticPass.has(window.corner_event_id) ? "pass" : "pending",
    segmentOnly.has(window.corner_event_id)
      ? "segment-only contact; straight-line endpoint rendering assumption disclosed"
      : semanticPass.has(window.corner_event_id) ? "independent wording and source-window review passed" : "independent semantic review required",
  ]);
  return `${[columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}
