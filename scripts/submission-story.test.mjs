import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  validateGalleryFirstImageManifest,
  validateLocalPolicyDemoEvidence,
  validateNarrationContract,
  validateEditorialTreatment,
  validateStoryboardManifest,
  validateSubmissionStory,
} from "./lib/submission-story.mjs";

const [storyText, storyboardText, galleryText, narrationText, captions, editorialText, app, productThesis, planning, judgingMap, officialState, demoScript] = await Promise.all([
  readFile("docs/submission-story.json", "utf8"),
  readFile("docs/assets/demo-storyboard/manifest.json", "utf8"),
  readFile("docs/assets/gallery/manifest.json", "utf8"),
  readFile("docs/policy-lab-demo-narration.json", "utf8"),
  readFile("docs/policy-lab-demo-captions.ko.srt", "utf8"),
  readFile("docs/demo-editorial-treatment.json", "utf8"),
  readFile("prototypes/policy-dojo/app.js", "utf8"),
  readFile("docs/product-thesis.md", "utf8"),
  readFile("docs/planning-outline.md", "utf8"),
  readFile("docs/judging-map.md", "utf8"),
  readFile("docs/official-state.md", "utf8"),
  readFile("docs/policy-lab-demo-60s.md", "utf8"),
]);
const story = JSON.parse(storyText);
const storyboard = JSON.parse(storyboardText);
const gallery = JSON.parse(galleryText);
const narration = JSON.parse(narrationText);
const editorialTreatment = JSON.parse(editorialText);
const sources = { app, productThesis, planning, judgingMap, officialState, demoScript };
const artifactBytes = new Map(await Promise.all(storyboard.artifacts.map(async ({ path }) => [path, await readFile(path)])));
const galleryBytes = new Map(await Promise.all([...gallery.sources, gallery.output].map(async ({ path }) => [path, await readFile(path)])));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function localEvidenceFixture() {
  const changedStory = structuredClone(story);
  const releaseBytes = Buffer.from("fixture release manifest");
  const visualVideoBytes = Buffer.from("fixture visual video");
  const narratedVideoBytes = Buffer.from("fixture narrated video");
  changedStory.evidence.release_manifest.sha256 = sha256(releaseBytes);
  changedStory.evidence.visual_video.sha256 = sha256(visualVideoBytes);
  changedStory.evidence.narrated_video.sha256 = sha256(narratedVideoBytes);
  const changedStoryBytes = Buffer.from(JSON.stringify(changedStory));
  const storyHash = sha256(changedStoryBytes);
  const visualManifest = {
    status: "local-static-release-rehearsal-not-youtube-or-human-evidence",
    release_manifest: { sha256: sha256(releaseBytes) },
    actions: Array.from({ length: changedStory.video.interaction.timed_events }, (_, index) => ({ id: `fixture-${index}` })),
    interaction_contract: { activations: 8, policy_locks: 1, explicit_scrolls: 2 },
    final_receipt: "사전 기준 충족 · 사전 위치 겹침 기준 50% · 정책 변경 0회",
    meeting_note: "검증 결과는 그대로",
    video: { sha256: sha256(visualVideoBytes), duration_seconds: changedStory.video.visual_duration_seconds },
    submission_story: { sha256: storyHash },
  };
  const visualManifestBytes = Buffer.from(JSON.stringify(visualManifest));
  const narrationManifest = {
    status: "local-narrated-static-release-rehearsal-not-youtube-or-human-evidence",
    visual_source: {
      sha256: sha256(visualManifestBytes),
      video_sha256: sha256(visualVideoBytes),
    },
    captions: { mode: "burned-in-and-byte-bound-sidecar" },
    narrated_video: {
      sha256: sha256(narratedVideoBytes),
      duration_seconds: changedStory.video.narrated_duration_seconds,
    },
    submission_story: { sha256: storyHash },
  };
  const narrationManifestBytes = Buffer.from(JSON.stringify(narrationManifest));
  const bytes = new Map([
    [changedStory.evidence.release_manifest.path, releaseBytes],
    [changedStory.evidence.visual_manifest.path, visualManifestBytes],
    [changedStory.evidence.narration_manifest.path, narrationManifestBytes],
    [changedStory.evidence.visual_video.path, visualVideoBytes],
    [changedStory.evidence.narrated_video.path, narratedVideoBytes],
  ]);
  return { changedStory, changedStoryBytes, bytes, visualManifest, narrationManifest };
}

describe("submission story", () => {
  it("accepts the tracked Policy Lab story, gallery, and narration contract", () => {
    expect(validateSubmissionStory(story, sources)).toEqual([]);
    expect(validateGalleryFirstImageManifest(Buffer.from(storyText), story, gallery, galleryBytes)).toEqual([]);
    expect(validateNarrationContract(story, narration, captions, demoScript)).toEqual([]);
    expect(validateEditorialTreatment(editorialTreatment)).toEqual([]);
  });

  it("rejects an editorial overlay that masquerades as product UI", () => {
    const changed = structuredClone(editorialTreatment);
    changed.claim_boundary.product_ui = true;
    expect(validateEditorialTreatment(changed)).toContain(
      "demo editorial treatment must reject product-UI, human, causal, predictive, and optimality claims",
    );
  });

  it("rejects a timecode gap", () => {
    const changed = structuredClone(story);
    changed.video.beats[3].start = 26;
    expect(validateSubmissionStory(changed, sources)).toContain("video beat r16 breaks contiguous timecodes");
  });

  it("rejects campaign, interaction, and claim-boundary drift", () => {
    const campaign = structuredClone(story);
    campaign.campaign.reference_matches = 47;
    expect(validateSubmissionStory(campaign, sources)).toContain("submission story must preserve the fixed 48-8-8 campaign and zero policy changes");
    const interaction = structuredClone(story);
    interaction.video.interaction.policy_locks = 2;
    expect(validateSubmissionStory(interaction, sources)).toContain("video interaction contract must preserve 12 events, 8 activations, one lock, two scrolls, and the scheduled 34s receipt and 48s next-meeting note");
    const claim = structuredClone(story);
    claim.claim_boundary.causal_recommendation_status = "PASS";
    expect(validateSubmissionStory(claim, sources)).toContain("submission story must preserve unavailable human evidence, causal REJECT, empirical REVISE, and no-result-prediction boundaries");
    const evidenceScope = structuredClone(story);
    evidenceScope.evidence.scope = "final-video";
    expect(validateSubmissionStory(evidenceScope, sources))
      .toContain("submission story must label tracked media hashes as local rehearsal evidence and name the post-release final manifest");
  });

  it("accepts eight distinct narrated-video storyboard frames", () => {
    expect(validateStoryboardManifest(Buffer.from(storyText), story, storyboard, artifactBytes)).toEqual([]);
  });

  it("rejects a duplicated storyboard frame", () => {
    const changed = structuredClone(storyboard);
    changed.artifacts[1].path = changed.artifacts[0].path;
    changed.artifacts[1].sha256 = changed.artifacts[0].sha256;
    changed.artifacts[1].bytes = changed.artifacts[0].bytes;
    expect(validateStoryboardManifest(Buffer.from(storyText), story, changed, artifactBytes)).toContain("every storyboard beat must have a visually distinct captured frame");
  });

  it("accepts a complete local evidence chain and rejects drifted video bytes", () => {
    const fixture = localEvidenceFixture();
    expect(validateLocalPolicyDemoEvidence(fixture.changedStoryBytes, fixture.changedStory, fixture)).toEqual([]);
    fixture.bytes.set(fixture.changedStory.evidence.narrated_video.path, Buffer.from("tampered"));
    expect(validateLocalPolicyDemoEvidence(fixture.changedStoryBytes, fixture.changedStory, fixture))
      .toContain("submission story evidence hash mismatch: narrated_video");
  });
});
