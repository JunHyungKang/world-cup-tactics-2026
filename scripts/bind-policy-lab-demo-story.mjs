import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const storyPath = "docs/submission-story.json";
const visualManifestPath = "output/demo/rehearsal-manifest.json";
const narrationManifestPath = "output/demo/narration-manifest.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const storyBytes = await readFile(storyPath);
const story = JSON.parse(storyBytes);
const visual = JSON.parse(await readFile(visualManifestPath, "utf8"));
const narrated = JSON.parse(await readFile(narrationManifestPath, "utf8"));
const [visualVideoBytes, narratedVideoBytes] = await Promise.all([
  readFile(story.evidence.visual_video.path),
  readFile(story.evidence.narrated_video.path),
]);
if (sha256(visualVideoBytes) !== visual.video.sha256 ||
    sha256(narratedVideoBytes) !== narrated.narrated_video.sha256) {
  throw new Error("canonical demo manifest media SHA-256 mismatch");
}

const storySha256 = sha256(storyBytes);
visual.submission_story_sha256 = storySha256;
await writeFile(visualManifestPath, `${JSON.stringify(visual, null, 2)}\n`);
const reboundVisualBytes = await readFile(visualManifestPath);
narrated.submission_story_sha256 = storySha256;
narrated.visual_source.manifest_sha256 = sha256(reboundVisualBytes);
await writeFile(narrationManifestPath, `${JSON.stringify(narrated, null, 2)}\n`);
console.log(`[PASS] local Corner Prep Lab demo bound to story ${storySha256}`);
