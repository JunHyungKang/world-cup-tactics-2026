import { readFile } from "node:fs/promises";
import {
  validateEditorialTreatment,
  validateGalleryFirstImageManifest,
  validateLocalPolicyDemoEvidence,
  validateNarrationContract,
  validateStoryboardManifest,
  validateSubmissionStory,
} from "./lib/submission-story.mjs";

const argv = process.argv.slice(2);
const contractOnly = argv.includes("--contract-only");
for (const argument of argv) {
  if (argument !== "--contract-only") throw new Error(`unsupported submission-story flag: ${argument}`);
}

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
const storyBytes = Buffer.from(storyText);
const errors = [
  ...validateSubmissionStory(story, { app, productThesis, planning, judgingMap, officialState, demoScript }),
  ...validateNarrationContract(story, narration, captions, demoScript),
  ...validateEditorialTreatment(editorialTreatment),
];

if (!contractOnly) {
  try {
    const gallery = JSON.parse(await readFile("docs/assets/gallery/manifest.json", "utf8"));
    const galleryBytes = new Map(await Promise.all(
      [...gallery.sources, gallery.output].map(async ({ path }) => [path, await readFile(path)]),
    ));
    errors.push(...validateGalleryFirstImageManifest(storyBytes, story, gallery, galleryBytes));
  } catch (error) {
    errors.push(`gallery regeneration required: ${error.message}`);
  }

  try {
    const storyboard = JSON.parse(await readFile("docs/assets/demo-storyboard/manifest.json", "utf8"));
    const storyboardBytes = new Map(await Promise.all(
      storyboard.artifacts.map(async ({ path }) => [path, await readFile(path)]),
    ));
    errors.push(...validateStoryboardManifest(storyBytes, story, storyboard, storyboardBytes));
  } catch (error) {
    errors.push(`storyboard regeneration required: ${error.message}`);
  }

  try {
    const evidenceBytes = new Map(await Promise.all(
      ["release_manifest", "visual_manifest", "narration_manifest", "visual_video", "narrated_video"]
        .map(async (key) => [story.evidence[key].path, await readFile(story.evidence[key].path)]),
    ));
    const visualManifest = JSON.parse(evidenceBytes.get(story.evidence.visual_manifest.path).toString("utf8"));
    const narrationManifest = JSON.parse(evidenceBytes.get(story.evidence.narration_manifest.path).toString("utf8"));
    errors.push(...validateLocalPolicyDemoEvidence(storyBytes, story, {
      bytes: evidenceBytes,
      visualManifest,
      narrationManifest,
    }));
  } catch (error) {
    errors.push(`local rehearsal regeneration required: ${error.message}`);
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}
console.log(
  contractOnly
    ? "[PASS] Corner Scout Lab source contract: corrected Portugal profile → two manual scene questions → lock → hidden matchup → unselected 261095314 → memo"
    : "[PASS] canonical Corner Scout Lab team-model and source-scene story, gallery, storyboard, narration, and local rehearsal chain",
);
