import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const storyPath = "docs/submission-story.json";
const visualManifestPath = "output/policy-lab-demo/visual-manifest.json";
const narrationManifestPath = "output/policy-lab-demo/narration-manifest.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const storyBytes = await readFile(storyPath);
const story = JSON.parse(storyBytes);
const visualBytes = await readFile(story.evidence.visual_video.path);
const narratedBytes = await readFile(story.evidence.narrated_video.path);
if (sha256(visualBytes) !== story.evidence.visual_video.sha256 || sha256(narratedBytes) !== story.evidence.narrated_video.sha256) {
  throw new Error("story-declared demo video SHA-256 mismatch");
}
const visual = JSON.parse(await readFile(visualManifestPath, "utf8"));
visual.submission_story = { path: storyPath, sha256: sha256(storyBytes) };
await writeFile(visualManifestPath, `${JSON.stringify(visual, null, 2)}\n`);
const reboundVisualBytes = await readFile(visualManifestPath);
const narration = JSON.parse(await readFile(narrationManifestPath, "utf8"));
narration.submission_story = { path: storyPath, sha256: sha256(storyBytes) };
narration.visual_source.sha256 = sha256(reboundVisualBytes);
await writeFile(narrationManifestPath, `${JSON.stringify(narration, null, 2)}\n`);
console.log(`[PASS] local Policy Lab demo bound to story ${sha256(storyBytes)}`);
