import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePairedFlags } from "./lib/cli.mjs";
import { loadAndValidateFinalEvidenceContext } from "./lib/final-evidence-context.mjs";
import {
  buildFinalArtifactReviewTemplate,
  parseYouTubeVideoUrl,
  renderDemoInspectionPngs,
} from "./lib/final-submission.mjs";

const args = parsePairedFlags(process.argv.slice(2));
for (const flag of args.keys()) {
  if (!["--browser-report", "--demo-video", "--demo-manifest", "--youtube-url", "--output-dir"].includes(flag)) {
    throw new Error(`unsupported final artifact review packet flag: ${flag}`);
  }
}
const browserReportPath = args.get("--browser-report");
const demoVideoPath = args.get("--demo-video");
const demoManifestPath = args.get("--demo-manifest");
const youtubeUrl = parseYouTubeVideoUrl(args.get("--youtube-url")).url;
const outputRoot = args.get("--output-dir") ?? "output";
if (!browserReportPath || !demoVideoPath || !demoManifestPath) {
  throw new Error("--browser-report, --demo-video, and --demo-manifest are required");
}

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const context = await loadAndValidateFinalEvidenceContext({ browserReportPath, demoVideoPath, demoManifestPath });
const tupleSha256 = digest(Buffer.from(JSON.stringify([
  context.hashes.browserReportSha256, context.hashes.demoVideoSha256,
  context.hashes.demoManifestSha256, youtubeUrl,
])));
const packetDir = join(outputRoot, `final-artifact-review-packet-${tupleSha256.slice(0, 16)}`);
const browserDir = join(packetDir, "browser");
const demoDir = join(packetDir, "demo");
await Promise.all([mkdir(browserDir, { recursive: true }), mkdir(demoDir, { recursive: true })]);

const writeIdempotent = async (path, bytes) => {
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existing = await readFile(path);
    if (!existing.equals(bytes)) throw new Error(`existing packet file drifted: ${path}`);
  }
};

const inspectionFiles = [];
const reportTests = [];
const collectReportTests = (suites) => {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) reportTests.push({ title: spec.title, ...test });
    collectReportTests(suite.suites);
  }
};
collectReportTests(context.browserReport.suites);
for (const test of reportTests) {
  if (!test.title?.startsWith("BG-14 ")) continue;
  for (const result of test.results ?? []) for (const attachment of result.attachments ?? []) {
    if (!/^artifact-(?:initial|selected|counterexample)$/u.test(attachment.name ?? "") || !attachment.path) continue;
    const relativePath = `browser/${test.projectName}-${attachment.name}.png`;
    const target = join(packetDir, relativePath);
    const bytes = await readFile(attachment.path);
    const evidence = context.browserScreenshots.find(({ project, name }) => project === test.projectName && name === attachment.name);
    if (!evidence || evidence.sha256 !== digest(bytes)) throw new Error(`browser inspection evidence drifted: ${test.projectName}/${attachment.name}`);
    await writeIdempotent(target, bytes);
    inspectionFiles.push({ kind: "browser", project: test.projectName, state: attachment.name, path: relativePath, ...evidence });
  }
}
for (const rendered of renderDemoInspectionPngs(demoVideoPath)) {
  const relativePath = `demo/${String(rendered.evidence.time_seconds).padStart(2, "0")}s.png`;
  const target = join(packetDir, relativePath);
  await writeIdempotent(target, rendered.bytes);
  const rawFrame = context.demoFrames.find(({ time_seconds: timeSeconds }) => timeSeconds === rendered.evidence.time_seconds);
  inspectionFiles.push({ kind: "demo", path: relativePath, ...rendered.evidence, pixel_sha256: rawFrame.pixel_sha256 });
}
if (inspectionFiles.length !== 19) throw new Error(`inspection packet must contain exactly 19 PNGs, got ${inspectionFiles.length}`);

const inspectionManifest = {
  schema_version: 1,
  status: "PENDING-INDEPENDENT-REVIEW",
  input_tuple_sha256: tupleSha256,
  instructions: [
    "A distinct non-creator subagent must inspect every listed PNG.",
    "Edit review-template.json only after inspection: status=PASS, reviewed_at, reviewer.task, findings=[], summary zeros.",
    "Do not describe this as human accessibility, usability, preference, or memorability evidence.",
  ],
  files: inspectionFiles,
};
const inspectionManifestBytes = Buffer.from(`${JSON.stringify(inspectionManifest, null, 2)}\n`);
const template = buildFinalArtifactReviewTemplate({
  deployedUrl: context.deployedUrl, youtubeUrl, commit: context.metadata.releaseCommit,
  buildSha256: context.metadata.buildSha256, browserReportSha256: context.hashes.browserReportSha256,
  testSourceSha256: context.testSourceSha256, browserCompletedAt: context.browserCompletedAt,
  browserScreenshots: context.browserScreenshots, demoVideoSha256: context.hashes.demoVideoSha256,
  demoManifestSha256: context.hashes.demoManifestSha256, demoCompletedAt: context.demoCompletedAt,
  demoFrames: context.demoFrames, captionsSha256: context.demoManifest.captions_sha256,
  narrationAuditSha256: context.narrationAuditSha256, inspectionManifestSha256: digest(inspectionManifestBytes),
});
await Promise.all([
  writeIdempotent(join(packetDir, "review-template.json"), Buffer.from(`${JSON.stringify(template, null, 2)}\n`)),
  writeIdempotent(join(packetDir, "inspection-manifest.json"), inspectionManifestBytes),
]);

const [rootEntries, browserEntries, demoEntries] = await Promise.all([
  readdir(packetDir), readdir(browserDir), readdir(demoDir),
]);
if (JSON.stringify(rootEntries.sort()) !== JSON.stringify(["browser", "demo", "inspection-manifest.json", "review-template.json"]) ||
    browserEntries.length !== 12 || demoEntries.length !== 7) {
  throw new Error("content-addressed packet directory contains stale or unexpected files");
}
console.log(`[PASS] immutable final artifact review packet: ${packetDir}`);
console.log(`Review template: ${join(packetDir, "review-template.json")}`);
console.log(`Inspection manifest: ${join(packetDir, "inspection-manifest.json")}`);
