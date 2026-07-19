import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parsePairedFlags } from "./lib/cli.mjs";
import { loadAndValidateFinalEvidenceContext } from "./lib/final-evidence-context.mjs";
import {
  parseYouTubeVideoUrl,
  renderDemoInspectionPngs,
  validateFinalArtifactReview,
} from "./lib/final-submission.mjs";

const args = parsePairedFlags(process.argv.slice(2));
for (const flag of args.keys()) {
  if (!["--review", "--inspection-manifest", "--browser-report", "--demo-video", "--demo-manifest", "--youtube-url"].includes(flag)) {
    throw new Error(`unsupported final artifact review finalize flag: ${flag}`);
  }
}
const reviewPath = args.get("--review");
const inspectionManifestPath = args.get("--inspection-manifest");
const browserReportPath = args.get("--browser-report");
const demoVideoPath = args.get("--demo-video");
const demoManifestPath = args.get("--demo-manifest");
const youtubeUrl = parseYouTubeVideoUrl(args.get("--youtube-url")).url;
if (!reviewPath || !inspectionManifestPath || !browserReportPath || !demoVideoPath || !demoManifestPath) {
  throw new Error("--review, --inspection-manifest, and all evidence paths are required");
}

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const context = await loadAndValidateFinalEvidenceContext({ browserReportPath, demoVideoPath, demoManifestPath });
const [reviewBytes, inspectionManifestBytes] = await Promise.all([
  readFile(reviewPath), readFile(inspectionManifestPath),
]);
const review = JSON.parse(reviewBytes.toString("utf8"));
const inspectionManifest = JSON.parse(inspectionManifestBytes.toString("utf8"));
const tupleSha256 = digest(Buffer.from(JSON.stringify([
  context.hashes.browserReportSha256, context.hashes.demoVideoSha256,
  context.hashes.demoManifestSha256, youtubeUrl,
])));
if (inspectionManifest.schema_version !== 1 || inspectionManifest.status !== "PENDING-INDEPENDENT-REVIEW" ||
    inspectionManifest.input_tuple_sha256 !== tupleSha256 || inspectionManifest.files?.length !== 19) {
  throw new Error("inspection manifest must bind the exact 19-file input tuple");
}

const packetRoot = resolve(dirname(inspectionManifestPath));
const demoInspectionPngs = renderDemoInspectionPngs(demoVideoPath);
const seen = new Set();
for (const file of inspectionManifest.files) {
  const filePath = resolve(packetRoot, file.path);
  if (relative(packetRoot, filePath).startsWith("..")) throw new Error(`inspection file escapes packet directory: ${file.path}`);
  const bytes = await readFile(filePath);
  if (file.sha256 !== digest(bytes) || file.bytes !== bytes.length) throw new Error(`inspection file byte binding mismatch: ${file.path}`);
  if (file.kind === "browser") {
    const key = `browser:${file.project}:${file.state}`;
    if (seen.has(key)) throw new Error(`duplicate inspection evidence: ${key}`);
    seen.add(key);
    const expected = context.browserScreenshots.find(({ project, name }) => project === file.project && name === file.state);
    if (!expected || JSON.stringify({
      project: file.project, name: file.name, sha256: file.sha256, bytes: file.bytes, width: file.width, height: file.height,
    }) !== JSON.stringify(expected)) throw new Error(`browser inspection evidence mismatch: ${file.path}`);
  } else if (file.kind === "demo") {
    const key = `demo:${file.time_seconds}`;
    if (seen.has(key)) throw new Error(`duplicate inspection evidence: ${key}`);
    seen.add(key);
    const rendered = demoInspectionPngs.find(({ evidence }) => evidence.time_seconds === file.time_seconds);
    const raw = context.demoFrames.find(({ time_seconds: timeSeconds }) => timeSeconds === file.time_seconds);
    if (!rendered || !raw || JSON.stringify(rendered.evidence) !== JSON.stringify({
      time_seconds: file.time_seconds, sha256: file.sha256, bytes: file.bytes, width: file.width, height: file.height,
    }) || file.pixel_sha256 !== raw.pixel_sha256) throw new Error(`demo inspection evidence mismatch: ${file.path}`);
  } else throw new Error(`unknown inspection evidence kind: ${file.kind}`);
}
if (seen.size !== 19) throw new Error("inspection evidence keys are incomplete");

const errors = validateFinalArtifactReview(review, {
  deployedUrl: context.deployedUrl, youtubeUrl, commit: context.metadata.releaseCommit,
  buildSha256: context.metadata.buildSha256, browserReportSha256: context.hashes.browserReportSha256,
  testSourceSha256: context.testSourceSha256, demoVideoSha256: context.hashes.demoVideoSha256,
  demoManifestSha256: context.hashes.demoManifestSha256, browserCompletedAt: context.browserCompletedAt,
  demoCompletedAt: context.demoCompletedAt, browserScreenshots: context.browserScreenshots,
  demoFrames: context.demoFrames, captionsSha256: context.demoManifest.captions_sha256,
  narrationAuditSha256: context.narrationAuditSha256,
  inspectionManifestSha256: digest(inspectionManifestBytes),
});
if (errors.length) throw new Error(errors.join("; "));
const canonicalBytes = Buffer.from(`${JSON.stringify(review, null, 2)}\n`);
const sha256 = digest(canonicalBytes);
const target = `docs/reviews/final-artifact-review-${sha256.slice(0, 16)}.json`;
await mkdir("docs/reviews", { recursive: true });
try { await writeFile(target, canonicalBytes, { flag: "wx" }); }
catch (error) {
  if (error.code !== "EEXIST" || !(await readFile(target)).equals(canonicalBytes)) throw error;
}
console.log(`[PASS] content-addressed final artifact review: ${target} sha256=${sha256}`);
