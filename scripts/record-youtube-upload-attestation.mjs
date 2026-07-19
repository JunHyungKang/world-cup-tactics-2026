import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parsePairedFlags } from "./lib/cli.mjs";
import {
  buildYouTubeUploadAttestation,
  parseYouTubeVideoUrl,
  validateYouTubeUploadAttestation,
} from "./lib/final-submission.mjs";

const args = parsePairedFlags(process.argv.slice(2));
for (const flag of args.keys()) {
  if (!["--owner", "--youtube-url", "--demo-video", "--demo-manifest", "--uploaded-at", "--confirmed"].includes(flag)) {
    throw new Error(`unsupported YouTube upload attestation flag: ${flag}`);
  }
}
if (args.get("--confirmed") !== "owner-observed") {
  throw new Error("--confirmed owner-observed is required after the owner sees the exact upload in YouTube Studio");
}
const owner = args.get("--owner");
const youtubeUrl = parseYouTubeVideoUrl(args.get("--youtube-url")).url;
const demoVideoPath = args.get("--demo-video");
const demoManifestPath = args.get("--demo-manifest");
const uploadedAt = args.get("--uploaded-at");
if (!owner || !demoVideoPath || !demoManifestPath || !uploadedAt) {
  throw new Error("--owner, --demo-video, --demo-manifest, and --uploaded-at are required");
}
const [videoBytes, manifestBytes] = await Promise.all([readFile(demoVideoPath), readFile(demoManifestPath)]);
const demoVideoSha256 = createHash("sha256").update(videoBytes).digest("hex");
const manifest = JSON.parse(manifestBytes.toString("utf8"));
if (manifest.status !== "final-upload-candidate-not-youtube-or-human-reviewed" ||
    manifest.narrated_video?.path !== demoVideoPath || manifest.narrated_video?.sha256 !== demoVideoSha256 ||
    manifest.narrated_video?.bytes !== videoBytes.length) {
  throw new Error("YouTube owner attestation requires the exact final upload-candidate manifest and video bytes");
}
const demoCompletedAt = Date.parse(manifest.source?.capture_completed_at);
const attestation = buildYouTubeUploadAttestation({ owner, youtubeUrl, demoVideoSha256, uploadedAt });
const errors = validateYouTubeUploadAttestation(attestation, { youtubeUrl, demoVideoSha256, demoCompletedAt });
if (errors.length) throw new Error(errors.join("; "));
const bytes = Buffer.from(`${JSON.stringify(attestation, null, 2)}\n`);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const target = `docs/reviews/youtube-upload-attestation-${sha256.slice(0, 16)}.json`;
await mkdir("docs/reviews", { recursive: true });
try { await writeFile(target, bytes, { flag: "wx" }); }
catch (error) {
  if (error.code !== "EEXIST" || !(await readFile(target)).equals(bytes)) throw error;
}
console.log(`[PASS] content-addressed owner upload attestation: ${target} sha256=${sha256}`);
