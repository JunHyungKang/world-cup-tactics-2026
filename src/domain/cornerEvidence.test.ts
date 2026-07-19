import rawArtifact from "virtual:corner-scenarios";
import { describe, expect, it } from "vitest";
import { ArtifactValidationError, commitDuty, createEvidenceModel, eventLabel, initialWarRoomState, openCounterexample, stepFrame, validateArtifact, type CornerArtifact } from "./cornerEvidence";

describe("Corner War Room evidence model", () => {
  const artifact = rawArtifact as CornerArtifact;
  const model = createEvidenceModel(artifact);

  it("validates the audited artifact and derives one honest preset per duty", () => {
    expect(validateArtifact(artifact).windows).toHaveLength(42);
    expect(model.contactWindowIds).toEqual({
      "check-short": 258973601,
      "near-post-side": 258973935,
      "central-to-far": 258973601,
      "second-ball": 258974215,
    });
    for (const id of Object.values(model.counterexampleWindowIds)) expect(id).not.toBeNull();
  });

  it("fails closed instead of substituting synthetic evidence", () => {
    expect(() => validateArtifact({ ...artifact, windows: artifact.windows.slice(1) })).toThrow(ArtifactValidationError);
  });

  it("commits a duty without autoplay and opens a distinct non-contact shot record", () => {
    const promise = commitDuty(model, "second-ball");
    expect(promise).toMatchObject({ duty: "second-ball", windowKind: "contact", frameIndex: 0, playback: "paused", view: "promise" });
    const skeptic = openCounterexample(model, promise);
    expect(skeptic).toMatchObject({ windowId: 258973935, windowKind: "counterexample", frameIndex: 0, playback: "paused" });
    expect(model.windowsById.get(skeptic.windowId!)?.shot_contact["second-ball"]).toBe(false);
    expect(model.windowsById.get(skeptic.windowId!)?.shot_in_window).toBe(true);
  });

  it("keeps replay inside the active window and reset is canonical", () => {
    let state = commitDuty(model, "check-short");
    const total = model.windowsById.get(state.windowId!)!.primitives.length;
    for (let index = 0; index < total + 2; index += 1) state = stepFrame(model, state, 1);
    expect(state.frameIndex).toBe(total - 1);
    expect(state.playback).toBe("complete");
    expect(commitDuty(model, "outlet")).toEqual(initialWarRoomState);
  });

  it("renders every source event with a Korean label and fails closed for unknown labels", () => {
    const labels = artifact.windows.flatMap(({ primitives }) => primitives.map(eventLabel));
    expect(labels).not.toContain("기타 기록");
    expect(labels.every((label) => /[가-힣]/u.test(label))).toBe(true);
    expect(eventLabel({ event_name: "Unknown", sub_event_name: "Unknown detail" })).toBe("기타 기록");
  });
});
