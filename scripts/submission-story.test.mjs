import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  validateGalleryFirstImageManifest,
  validateLocalPolicyDemoEvidence,
  validateNarrationContract,
  validateStoryboardManifest,
  validateSubmissionStory,
} from "./lib/submission-story.mjs";

const [storyText, storyboardText, galleryText, narrationText, captions, app, productThesis, planning, judgingMap, officialState, demoScript, visualText, narratedText] = await Promise.all([
  readFile("docs/submission-story.json", "utf8"),
  readFile("docs/assets/demo-storyboard/manifest.json", "utf8"),
  readFile("docs/assets/gallery/manifest.json", "utf8"),
  readFile("docs/policy-lab-demo-narration.json", "utf8"),
  readFile("output/policy-lab-demo/corner-policy-lab.ko.srt", "utf8"),
  readFile("prototypes/policy-dojo/app.js", "utf8"),
  readFile("docs/product-thesis.md", "utf8"),
  readFile("docs/planning-outline.md", "utf8"),
  readFile("docs/judging-map.md", "utf8"),
  readFile("docs/official-state.md", "utf8"),
  readFile("docs/policy-lab-demo-60s.md", "utf8"),
  readFile("output/policy-lab-demo/visual-manifest.json", "utf8"),
  readFile("output/policy-lab-demo/narration-manifest.json", "utf8"),
]);
const story = JSON.parse(storyText);
const storyboard = JSON.parse(storyboardText);
const gallery = JSON.parse(galleryText);
const narration = JSON.parse(narrationText);
const visualManifest = JSON.parse(visualText);
const narrationManifest = JSON.parse(narratedText);
const sources = { app, productThesis, planning, judgingMap, officialState, demoScript };
const artifactBytes = new Map(await Promise.all(storyboard.artifacts.map(async ({ path }) => [path, await readFile(path)])));
const galleryBytes = new Map(await Promise.all([...gallery.sources, gallery.output].map(async ({ path }) => [path, await readFile(path)])));
const evidenceBytes = new Map(await Promise.all(Object.values(story.evidence).map(async ({ path }) => [path, await readFile(path)])));

describe("submission story", () => {
  it("accepts the canonical Policy Lab story, gallery, narration, and local evidence chain", () => {
    expect(validateSubmissionStory(story, sources)).toEqual([]);
    expect(validateGalleryFirstImageManifest(Buffer.from(storyText), story, gallery, galleryBytes)).toEqual([]);
    expect(validateNarrationContract(story, narration, captions, demoScript)).toEqual([]);
    expect(validateLocalPolicyDemoEvidence(Buffer.from(storyText), story, { bytes: evidenceBytes, visualManifest, narrationManifest })).toEqual([]);
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
    expect(validateSubmissionStory(interaction, sources)).toContain("video interaction contract must preserve 7 events, 5 activations, one lock, one scroll, and the 34.005s receipt");
    const claim = structuredClone(story);
    claim.claim_boundary.causal_recommendation_status = "PASS";
    expect(validateSubmissionStory(claim, sources)).toContain("submission story must preserve unavailable human evidence, causal REJECT, empirical REVISE, and no-result-prediction boundaries");
  });

  it("accepts seven distinct narrated-video storyboard frames", () => {
    expect(validateStoryboardManifest(Buffer.from(storyText), story, storyboard, artifactBytes)).toEqual([]);
  });

  it("rejects a duplicated storyboard frame", () => {
    const changed = structuredClone(storyboard);
    changed.artifacts[1].path = changed.artifacts[0].path;
    changed.artifacts[1].sha256 = changed.artifacts[0].sha256;
    changed.artifacts[1].bytes = changed.artifacts[0].bytes;
    expect(validateStoryboardManifest(Buffer.from(storyText), story, changed, artifactBytes)).toContain("every storyboard beat must have a visually distinct captured frame");
  });

  it("rejects video bytes that drift from the story", () => {
    const bytes = new Map(evidenceBytes);
    bytes.set(story.evidence.narrated_video.path, Buffer.from("tampered"));
    expect(validateLocalPolicyDemoEvidence(Buffer.from(storyText), story, { bytes, visualManifest, narrationManifest }))
      .toContain("submission story evidence hash mismatch: narrated_video");
  });
});
