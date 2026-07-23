import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const outputDirectory = "docs/assets/demo-storyboard";
const videoPath = "output/policy-lab-demo/corner-policy-lab-60s-narrated.webm";
const frameSeconds = [2, 8, 14, 20, 32, 38, 49, 56];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

await mkdir(outputDirectory, { recursive: true });
const storyBytes = await readFile("docs/submission-story.json");
const story = JSON.parse(storyBytes);
const videoBytes = await readFile(videoPath);
const artifacts = [];
for (const [index, beat] of story.video.beats.entries()) {
  const path = `${outputDirectory}/${String(index + 1).padStart(2, "0")}-${beat.id}.png`;
  const result = spawnSync("ffmpeg", ["-y", "-v", "error", "-ss", String(frameSeconds[index]), "-i", videoPath, "-frames:v", "1", path], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`storyboard frame extraction failed: ${beat.id}: ${result.stderr}`);
  const bytes = await readFile(path);
  artifacts.push({
    order: index + 1,
    id: beat.id,
    timecode: `${beat.start}–${beat.end}s`,
    proof: beat.proof,
    path,
    sha256: sha256(bytes),
    bytes: bytes.length,
  });
}
const manifest = {
  schema_version: 1,
  status: "local-rehearsal-not-youtube-evidence",
  source: { path: videoPath, sha256: sha256(videoBytes) },
  viewport: "1440x900",
  submission_story_sha256: sha256(storyBytes),
  artifacts,
};
await writeFile(`${outputDirectory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[PASS] Policy Lab demo storyboard: ${artifacts.length} beat(s)`);
