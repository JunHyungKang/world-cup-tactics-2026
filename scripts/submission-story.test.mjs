import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  validateEditorialTreatment,
  validateGalleryFirstImageManifest,
  validateLocalPolicyDemoEvidence,
  validateNarrationContract,
  validateStoryboardManifest,
  validateSubmissionStory,
} from "./lib/submission-story.mjs";

const [
  storyText,
  narrationText,
  captions,
  editorialText,
  app,
  productThesis,
  planning,
  judgingMap,
  officialState,
  demoScript,
] = await Promise.all([
  readFile("docs/submission-story.json", "utf8"),
  readFile("docs/policy-lab-demo-narration.json", "utf8"),
  readFile("docs/policy-lab-demo-captions.ko.srt", "utf8"),
  readFile("docs/demo-editorial-treatment.json", "utf8"),
  readFile("prototypes/opponent-scouting/app.js", "utf8"),
  readFile("docs/product-thesis.md", "utf8"),
  readFile("docs/planning-outline.md", "utf8"),
  readFile("docs/judging-map.md", "utf8"),
  readFile("docs/official-state.md", "utf8"),
  readFile("docs/policy-lab-demo-60s.md", "utf8"),
]);
const story = JSON.parse(storyText);
const narration = JSON.parse(narrationText);
const editorialTreatment = JSON.parse(editorialText);
const sources = { app, productThesis, planning, judgingMap, officialState, demoScript };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function galleryFixture() {
  const bytes = new Map(
    story.gallery.source_images.map((path, index) => [path, Buffer.from(`gallery source ${index + 1}`)]),
  );
  const outputBytes = Buffer.from("gallery output");
  bytes.set(story.gallery.first_image, outputBytes);
  return {
    bytes,
    manifest: {
      schema_version: 2,
      status: "current-build-composite-not-human-evidence",
      viewport: "1440x900",
      submission_story_sha256: sha256(Buffer.from(storyText)),
      sources: story.gallery.source_images.map((path) => ({
        path,
        sha256: sha256(bytes.get(path)),
        bytes: bytes.get(path).length,
      })),
      output: {
        path: story.gallery.first_image,
        sha256: sha256(outputBytes),
        bytes: outputBytes.length,
      },
    },
  };
}

function storyboardFixture() {
  const bytes = new Map();
  const artifacts = story.video.beats.map((beat, index) => {
    const path = `docs/assets/demo-storyboard/${String(index + 1).padStart(2, "0")}-${beat.id}.png`;
    const artifactBytes = Buffer.from(`distinct storyboard frame ${index + 1}`);
    bytes.set(path, artifactBytes);
    return {
      order: index + 1,
      id: beat.id,
      timecode: `${beat.start}–${beat.end}s`,
      proof: beat.proof,
      path,
      sha256: sha256(artifactBytes),
      bytes: artifactBytes.length,
    };
  });
  return {
    bytes,
    manifest: {
      schema_version: 2,
      status: "local-rehearsal-not-youtube-evidence",
      viewport: "1440x900",
      submission_story_sha256: sha256(Buffer.from(storyText)),
      artifacts,
    },
  };
}

function localEvidenceFixture() {
  const storyBytes = Buffer.from(storyText);
  const storyHash = sha256(storyBytes);
  const releaseBytes = Buffer.from("fixture release manifest");
  const visualVideoBytes = Buffer.from("fixture visual video");
  const narratedVideoBytes = Buffer.from("fixture narrated video");
  const visualManifest = {
    schema_version: 2,
    status: "local-timed-rehearsal-not-youtube-evidence",
    submission_story_sha256: storyHash,
    release_manifest: {
      path: story.evidence.release_manifest.path,
      sha256: sha256(releaseBytes),
    },
    actions: story.video.interaction.timed_events
      ? Array.from({ length: story.video.interaction.timed_events }, (_, index) => ({ id: `fixture-${index}` }))
      : [],
    interaction_contract: {
      activations: 16,
      allocation_activations: 10,
      policy_locks: 1,
      explicit_scrolls: 4,
    },
    final_frame: {
      allocation: "내 훈련 배분 5 · 4 · 1",
      held_out: "실제 맞대결 5 · 2 · 3",
      differences: "횟수 차이 0 · 훈련 배분이 2회 많음 · 실제가 2회 많음",
      meeting_note: "다음 회의에서 훈련 비중 재배분 · 기록과 훈련 배분을 바꾸지 않습니다",
    },
    video: {
      path: story.evidence.visual_video.path,
      sha256: sha256(visualVideoBytes),
      bytes: visualVideoBytes.length,
      duration_seconds: 60.12,
    },
  };
  const visualManifestBytes = Buffer.from(JSON.stringify(visualManifest));
  const narrationManifest = {
    schema_version: 2,
    status: "local-narrated-rehearsal-not-youtube-or-human-evidence",
    submission_story_sha256: storyHash,
    visual_source: {
      manifest_sha256: sha256(visualManifestBytes),
      video_sha256: sha256(visualVideoBytes),
    },
    captions: { presentation: "burned-in" },
    narrated_video: {
      path: story.evidence.narrated_video.path,
      sha256: sha256(narratedVideoBytes),
      bytes: narratedVideoBytes.length,
      duration_seconds: 59.52,
    },
  };
  const narrationManifestBytes = Buffer.from(JSON.stringify(narrationManifest));
  const bytes = new Map([
    [story.evidence.release_manifest.path, releaseBytes],
    [story.evidence.visual_manifest.path, visualManifestBytes],
    [story.evidence.narration_manifest.path, narrationManifestBytes],
    [story.evidence.visual_video.path, visualVideoBytes],
    [story.evidence.narrated_video.path, narratedVideoBytes],
  ]);
  return { storyBytes, bytes, visualManifest, narrationManifest };
}

describe("canonical Corner Prep Lab submission story", () => {
  it("accepts the source story, exact narration, captions, and editorial treatment", () => {
    expect(validateSubmissionStory(story, sources)).toEqual([]);
    expect(validateNarrationContract(story, narration, captions, demoScript)).toEqual([]);
    expect(validateEditorialTreatment(editorialTreatment)).toEqual([]);
  });

  it("requires 5/4/1 to be a simple, non-optimal conversion", () => {
    const changedStory = structuredClone(story);
    changedStory.manager_decision.conversion.is_optimal = true;
    expect(validateSubmissionStory(changedStory, sources)).toContain(
      "5/4/1 must remain a simple conversion that is neither recommended nor optimal",
    );

    const changedNarration = structuredClone(narration);
    changedNarration.cues.find(({ id }) => id === "allocate").text =
      "조별리그 기록을 열 번으로 바꿔 다섯·넷·하나로 잠급니다.";
    expect(validateNarrationContract(story, changedNarration, captions, demoScript)).toContain(
      "5/4/1 narration must say it is a simple conversion and not an optimal allocation",
    );
  });

  it("permits only the two explicit uncertainty negations around optimality and prevention", () => {
    const unsafe = structuredClone(narration);
    unsafe.cues.find(({ id }) => id === "allocate").text = "다섯·넷·하나는 최적 배분입니다.";
    expect(validateNarrationContract(story, unsafe, captions, demoScript)).toContain(
      "narration cue allocate contains forbidden claim: 최적 배분입니다",
    );
  });

  it("rejects a timecode gap and interaction drift", () => {
    const gap = structuredClone(story);
    gap.video.beats[3].start = 26;
    expect(validateSubmissionStory(gap, sources)).toContain("video beat lock breaks contiguous timecodes");

    const interaction = structuredClone(story);
    interaction.video.interaction.allocation_activations = 9;
    expect(validateSubmissionStory(interaction, sources)).toContain(
      "video interaction contract must preserve 20 events, 16 activations, ten allocation clicks, one lock, four scrolls, a 31s reveal, and a 55s memo",
    );
  });

  it("accepts hash-bound gallery and eight distinct storyboard fixtures", () => {
    const gallery = galleryFixture();
    expect(validateGalleryFirstImageManifest(
      Buffer.from(storyText),
      story,
      gallery.manifest,
      gallery.bytes,
    )).toEqual([]);

    const storyboard = storyboardFixture();
    expect(validateStoryboardManifest(
      Buffer.from(storyText),
      story,
      storyboard.manifest,
      storyboard.bytes,
    )).toEqual([]);
  });

  it("rejects a duplicated storyboard frame", () => {
    const storyboard = storyboardFixture();
    const first = storyboard.manifest.artifacts[0];
    const second = storyboard.manifest.artifacts[1];
    second.path = first.path;
    second.sha256 = first.sha256;
    second.bytes = first.bytes;
    expect(validateStoryboardManifest(
      Buffer.from(storyText),
      story,
      storyboard.manifest,
      storyboard.bytes,
    )).toContain("every storyboard beat must have a visually distinct captured frame");
  });

  it("accepts the canonical local evidence shape and rejects drifted narrated bytes", () => {
    const fixture = localEvidenceFixture();
    expect(validateLocalPolicyDemoEvidence(fixture.storyBytes, story, fixture)).toEqual([]);
    fixture.bytes.set(story.evidence.narrated_video.path, Buffer.from("tampered"));
    expect(validateLocalPolicyDemoEvidence(fixture.storyBytes, story, fixture)).toContain(
      "narrated rehearsal chain or local boundary drifted",
    );
  });
});
