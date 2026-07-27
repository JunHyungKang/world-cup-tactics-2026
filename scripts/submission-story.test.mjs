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
const sources = {
  app,
  productThesis,
  planning,
  judgingMap,
  officialState,
  demoScript,
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function galleryFixture() {
  const bytes = new Map(
    story.gallery.source_images.map((path, index) => [
      path,
      Buffer.from(`gallery source ${index + 1}`),
    ]),
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
    const path =
      `docs/assets/demo-storyboard/${String(index + 1).padStart(2, "0")}-` +
      `${beat.id}.png`;
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
    actions: Array.from(
      { length: story.video.interaction.timed_events },
      (_, index) => ({ id: `fixture-${index}` }),
    ),
    interaction_contract: {
      activations: 8,
      question_selection_activations: 2,
      question_locks: 1,
      explicit_scrolls: 4,
    },
    final_frame: {
      questions: "내 훈련 질문 선택 · 선택 밖 · 선택 · 선택 밖 · 선택 밖",
      held_out: "실제 맞대결 5 · 2 · 0 · 0 · 3",
      shots: "10초 안 슈팅 기록 2 · 0 · 0 · 0 · 2",
      counterevidence:
        "그 밖의 전개 뒤 · 수비팀 먼저 기록 · 실제 3장면 · 10초 안 포르투갈 슈팅 기록이 2장면 · corner 261095314",
      boundary:
        "실제 맞대결에서는 포르투갈 코너 10개 중 4개 뒤에 슈팅 기록이 있었습니다. 어떤 선택이 이를 바꿨을지는 알 수 없습니다.",
      meeting_note:
        "다음 회의에서 훈련 질문 다시 선택 · 잠근 두 질문과 공개된 경기 기록을 바꾸지 않습니다",
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

describe("canonical five-signature Corner Prep Lab submission story", () => {
  it("accepts the source story, exact narration, captions, and editorial treatment", () => {
    expect(validateSubmissionStory(story, sources)).toEqual([]);
    expect(
      validateNarrationContract(story, narration, captions, demoScript),
    ).toEqual([]);
    expect(validateEditorialTreatment(editorialTreatment)).toEqual([]);
  });

  it("requires the exact official two-question path and held-out evidence", () => {
    const changed = structuredClone(story);
    changed.manager_decision.demo_selected_questions.reverse();
    expect(validateSubmissionStory(changed, sources)).toContain(
      "submission story must preserve the exact five signatures, two selected questions, and held-out count/shot ledgers",
    );

    const changedCounterevidence = structuredClone(story);
    changedCounterevidence.manager_decision.counterevidence.corner_event_id =
      261095513;
    expect(validateSubmissionStory(changedCounterevidence, sources)).toContain(
      "submission story must bind other-defending-first 3-scene/2-shot counterevidence and corner 261095314",
    );
  });

  it("keeps the selection manual, unranked, and non-recommended", () => {
    const changed = structuredClone(story);
    changed.manager_decision.selection.is_ranked = true;
    expect(validateSubmissionStory(changed, sources)).toContain(
      "the two-question demo choice must remain manual, unranked, and non-recommended",
    );

    const changedNarration = structuredClone(narration);
    changedNarration.cues.find(({ id }) => id === "select").text =
      "가장 좋은 두 질문을 추천합니다.";
    expect(
      validateNarrationContract(
        story,
        changedNarration,
        captions,
        demoScript,
      ),
    ).toContain("narration cue select contains an unbounded claim token: 추천");
  });

  it("rejects team-trait, causal, and superseded allocation copy", () => {
    const traitClaim = structuredClone(narration);
    traitClaim.cues.find(({ id }) => id === "evidence").text =
      "우루과이의 약점을 찾습니다.";
    expect(
      validateNarrationContract(story, traitClaim, captions, demoScript),
    ).toContain("narration cue evidence contains forbidden claim: 약점");

    const oldStory = structuredClone(story);
    oldStory.gallery.one_line += " 훈련 10회는 5·4·1로 배분합니다.";
    expect(validateSubmissionStory(oldStory, sources)).toContain(
      "submission story still contains superseded allocation copy: 훈련 10회",
    );
  });

  it("rejects a timecode gap and interaction drift", () => {
    const gap = structuredClone(story);
    gap.video.beats[3].start = 26;
    expect(validateSubmissionStory(gap, sources)).toContain(
      "video beat lock breaks contiguous timecodes",
    );

    const interaction = structuredClone(story);
    interaction.video.interaction.question_selection_activations = 3;
    expect(validateSubmissionStory(interaction, sources)).toContain(
      "video interaction contract must preserve 13 events, eight activations, two selections, one lock, four scrolls, reveal, counterevidence, and memo timings",
    );
  });

  it("accepts hash-bound gallery and eight distinct storyboard fixtures", () => {
    const gallery = galleryFixture();
    expect(
      validateGalleryFirstImageManifest(
        Buffer.from(storyText),
        story,
        gallery.manifest,
        gallery.bytes,
      ),
    ).toEqual([]);

    const storyboard = storyboardFixture();
    expect(
      validateStoryboardManifest(
        Buffer.from(storyText),
        story,
        storyboard.manifest,
        storyboard.bytes,
      ),
    ).toEqual([]);
  });

  it("rejects a duplicated storyboard frame", () => {
    const storyboard = storyboardFixture();
    const first = storyboard.manifest.artifacts[0];
    const second = storyboard.manifest.artifacts[1];
    second.path = first.path;
    second.sha256 = first.sha256;
    second.bytes = first.bytes;
    expect(
      validateStoryboardManifest(
        Buffer.from(storyText),
        story,
        storyboard.manifest,
        storyboard.bytes,
      ),
    ).toContain("every storyboard beat must have a visually distinct captured frame");
  });

  it("accepts the canonical local evidence shape and rejects drifted counterevidence", () => {
    const fixture = localEvidenceFixture();
    expect(
      validateLocalPolicyDemoEvidence(fixture.storyBytes, story, fixture),
    ).toEqual([]);
    fixture.visualManifest.final_frame.counterevidence =
      "다른 영수증 corner 261095513";
    expect(
      validateLocalPolicyDemoEvidence(fixture.storyBytes, story, fixture),
    ).toContain(
      "visual rehearsal question, held-out, counterevidence, or immutable-memo proof drifted",
    );
  });
});
