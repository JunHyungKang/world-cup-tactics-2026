import { readFile } from "node:fs/promises";
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
const storyboardBytes = new Map(await Promise.all(storyboard.artifacts.map(async ({ path }) => [path, await readFile(path)])));
const galleryBytes = new Map(await Promise.all([...gallery.sources, gallery.output].map(async ({ path }) => [path, await readFile(path)])));
const evidenceBytes = new Map(await Promise.all(Object.values(story.evidence).map(async ({ path }) => [path, await readFile(path)])));
const errors = [
  ...validateSubmissionStory(story, { app, productThesis, planning, judgingMap, officialState, demoScript }),
  ...validateGalleryFirstImageManifest(Buffer.from(storyText), story, gallery, galleryBytes),
  ...validateStoryboardManifest(Buffer.from(storyText), story, storyboard, storyboardBytes),
  ...validateNarrationContract(story, narration, captions, demoScript),
  ...validateLocalPolicyDemoEvidence(Buffer.from(storyText), story, { bytes: evidenceBytes, visualManifest, narrationManifest }),
];
if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}
console.log("[PASS] Policy Lab submission story: 48-8-8, one lock, seven beats, exact local video chain, safe claims");
