import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  auditCsv, deriveCornerData, eventMicroseconds, NOMINAL_REGIONS, normalizePoint, pointInRegion,
  recordedWindow, reverseNormalizedPoint, segmentTouchesRegion, stableEventOrder,
} from "./lib/corner-transform.mjs";

const [events, matches] = await Promise.all([
  readFile("data/raw/pappalardo/events_World_Cup.json", "utf8").then(JSON.parse),
  readFile("data/raw/pappalardo/matches_World_Cup.json", "utf8").then(JSON.parse),
]);
const derived = deriveCornerData(events, matches);
const [committedPublicData, committedAuditCsv] = await Promise.all([
  readFile("public/data/corner-scenarios.json", "utf8").then(JSON.parse),
  readFile("data/audit/brazil-corner-window-review.csv", "utf8"),
]);
const semanticReview = await readFile("data/audit/brazil-corner-semantic-review.json", "utf8").then(JSON.parse);

describe("corner scenario transform", () => {
  it("reproduces the full population and reviewed nominal counts", () => {
    expect(derived.summary.windows).toBe(42);
    expect(derived.summary.delivery_endpoint_windows).toEqual({
      "check-short": 14, "near-post-side": 17, "central-to-far": 10, other: 1,
    });
    expect(derived.summary.brazil_follow_up_contact_windows).toEqual({
      "check-short": 14, "near-post-side": 18, "central-to-far": 15, "second-ball": 13,
    });
    expect(derived.summary.brazil_shot_contact_windows).toEqual({
      "check-short": 0, "near-post-side": 3, "central-to-far": 5, "second-ball": 3,
    });
    expect(derived.summary.shot_windows).toBe(11);
    expect(derived.summary.goal_tagged_shot_windows).toBe(1);
    expect(derived.summary.defending_outlet_contact_windows).toBe(10);
    expect(derived.summary.skeptic_corner_event_ids).toEqual({
      "check-short": 258973935, "near-post-side": 258974380,
      "central-to-far": 258974380, "second-ball": 258973935,
    });
    expect(derived.summary.sensitivity).toEqual({
      delivery: {
        "check-short": { min: 14, nominal: 14, max: 14, fixed_order_wins: 27 },
        "near-post-side": { min: 13, nominal: 17, max: 17, fixed_order_wins: 54 },
        "central-to-far": { min: 9, nominal: 10, max: 14, fixed_order_wins: 0 },
        other: { min: 1, nominal: 1, max: 2, fixed_order_wins: 0 },
      },
      second_ball_follow_up: { min: 13, max: 14 },
      second_ball_shots: { min: 3, max: 3 },
      outlet_band: { min: 9, max: 11 },
    });
  });

  it("owns stable ordering, corner suffix isolation, and the inclusive ten-second boundary", () => {
    const corner = { id: 10, eventSec: 5, matchPeriod: "1H" };
    const sequence = [
      { id: 9, eventSec: 5, matchPeriod: "1H" }, corner,
      { id: 11, eventSec: 14.999999, matchPeriod: "1H" },
      { id: 12, eventSec: 15, matchPeriod: "1H" },
      { id: 13, eventSec: 15.000001, matchPeriod: "1H" },
    ].sort(stableEventOrder);
    expect(eventMicroseconds(sequence[0])).toBe(5_000_000);
    expect(recordedWindow(sequence, corner).map((event) => event.id)).toEqual([10, 11, 12]);
  });

  it("normalizes and reverses both opponent and lateral mirroring", () => {
    for (const teamId of [6380, 6697]) for (const mirror of [false, true]) {
      const source = { x: 17, y: 83 };
      expect(reverseNormalizedPoint(normalizePoint(source, teamId, mirror), teamId, mirror)).toEqual(source);
    }
    for (const [firstId, secondId] of [[258974211, 258974225], [259862940, 259863064], [260715386, 260716054], [261386180, 261386387], [262120303, 262120286]]) {
      const first = events.find((event) => event.id === firstId);
      const second = events.find((event) => event.id === secondId);
      const window = derived.windows.find((candidate) => candidate.event_ids.includes(firstId) && candidate.event_ids.includes(secondId));
      expect(window, `pair ${firstId}/${secondId} must belong to one audited corner window`).toBeDefined();
      const mirror = window.normalization_side === "source-bottom-mirrored-to-top";
      for (let index = 0; index < 2; index += 1) {
        const firstNormalized = normalizePoint(first.positions[index], first.teamId, mirror);
        const secondNormalized = normalizePoint(second.positions[index], second.teamId, mirror);
        expect(firstNormalized).toEqual(secondNormalized);
        expect(reverseNormalizedPoint(firstNormalized, first.teamId, mirror)).toEqual(first.positions[index]);
        expect(reverseNormalizedPoint(secondNormalized, second.teamId, mirror)).toEqual(second.positions[index]);
      }
    }
  });

  it("owns the raw equal-time ID tie-break and placeholder downgrade", () => {
    const equalTime = [259863064, 259862940].map((id) => events.find((event) => event.id === id)).sort(stableEventOrder);
    expect(equalTime.map((event) => event.id)).toEqual([259862940, 259863064]);
    const placeholder = derived.windows.flatMap((window) => window.primitives).find((primitive) => primitive.event_id === 260716217);
    expect(placeholder).toMatchObject({ event_name: "Pass", visual: "marker" });
    expect(placeholder.source_positions[1]).toEqual({ x: 100, y: 100 });
  });

  it("honours half-open region edges and segment contact", () => {
    expect(pointInRegion({ x: 90, y: 24.999 }, NOMINAL_REGIONS["check-short"])).toBe(true);
    expect(pointInRegion({ x: 90, y: 25 }, NOMINAL_REGIONS["check-short"])).toBe(false);
    expect(pointInRegion({ x: 85, y: 40 }, NOMINAL_REGIONS["second-ball"])).toBe(false);
    expect(segmentTouchesRegion({ x: 60, y: 50 }, { x: 90, y: 50 }, NOMINAL_REGIONS["second-ball"])).toBe(true);
    expect(segmentTouchesRegion({ x: 10, y: 10 }, { x: 20, y: 20 }, NOMINAL_REGIONS["second-ball"])).toBe(false);
  });

  it("preserves source IDs and never draws a shot terminal segment", () => {
    expect(new Set(derived.windows.map((window) => window.corner_event_id)).size).toBe(42);
    for (const window of derived.windows) {
      expect(window.event_ids[0]).toBe(window.corner_event_id);
      expect(window.primitives.filter((primitive) => primitive.event_name === "Shot").every((primitive) => primitive.visual === "shot-marker")).toBe(true);
      expect(window.primitives.every((primitive) => primitive.normalized_positions.every((point) => point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100))).toBe(true);
    }
  });

  it("binds the committed public JSON and 42-row structural audit to this transform", () => {
    expect(committedPublicData.provenance.source_ids).toEqual([
      "pappalardo-wyscout-events-wc-2018", "pappalardo-wyscout-matches-wc-2018",
    ]);
    expect(committedPublicData.provenance.input_sha256).toMatchObject({
      eventsZip: "877e015b716ffdeea18f04418e3f24fed307ed03c37ff305cabe1f47c4822a45",
      matchesZip: "c8f92bb7533e5c127e043cee764c991b5c25b4f5e70a65be931baae0b1765ce9",
    });
    expect(committedPublicData.limitations).toContain(
      "eligible Pass/Clearance segments are straight-line rendering assumptions between two recorded endpoints",
    );
    expect(committedPublicData.summary).toEqual(derived.summary);
    expect(committedPublicData.windows).toEqual(derived.windows);
    expect(committedAuditCsv).toBe(auditCsv(derived.windows, semanticReview));
    expect(committedAuditCsv.trim().split("\n")).toHaveLength(43);
    expect(committedAuditCsv.match(/,pass,pass,/gu)).toHaveLength(42);
  });
});
