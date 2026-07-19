import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  FINAL_EVIDENCE_SOURCE_PATHS,
  collectBrowserArtifactEvidence,
  computeDemoAuditDigest,
  computeDemoFrameEvidence,
  computeEvidenceSourceDigest,
  parseDeploymentUrl,
  validateFinalEvidenceContext,
} from "./final-submission.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function loadAndValidateFinalEvidenceContext({
  browserReportPath, demoVideoPath, demoManifestPath, now = Date.now(), execFile = execFileSync,
}) {
  const [browserReportBytes, demoVideoBytes, demoManifestBytes, markerBytes, storyBytes] = await Promise.all([
    readFile(browserReportPath), readFile(demoVideoPath), readFile(demoManifestPath),
    readFile("dist/submission-build.json"), readFile("docs/submission-story.json"),
  ]);
  const browserReport = JSON.parse(browserReportBytes.toString("utf8"));
  const demoManifest = JSON.parse(demoManifestBytes.toString("utf8"));
  const marker = JSON.parse(markerBytes.toString("utf8"));
  const metadata = browserReport.config?.metadata ?? {};
  const deployedUrl = parseDeploymentUrl(metadata.deployedUrl);
  const testSourceSha256 = await computeEvidenceSourceDigest(FINAL_EVIDENCE_SOURCE_PATHS);
  const releaseEpochSeconds = Number(execFile("git", ["show", "-s", "--format=%ct", metadata.releaseCommit], { encoding: "utf8" }).trim());
  const markerBuiltAt = Date.parse(marker.builtAt);
  const demoVideoSha256 = digest(demoVideoBytes);
  const errors = await validateFinalEvidenceContext({
    browserReport, demoManifest, deployedUrl, releaseCommit: metadata.releaseCommit,
    buildSha256: metadata.buildSha256, testSourceSha256, demoVideoPath, demoVideoSha256,
    storySha256: digest(storyBytes), markerSha256: digest(markerBytes), markerBuiltAt,
    releaseEpochSeconds, now,
  });
  if (errors.length) throw new Error(`final evidence context rejected: ${errors.join("; ")}`);
  const browserCompletedAt = Date.parse(browserReport.stats.startTime) + browserReport.stats.duration;
  const demoCompletedAt = Date.parse(demoManifest.source.capture_completed_at);
  return {
    browserReportPath, demoVideoPath, demoManifestPath,
    browserReportBytes, demoVideoBytes, demoManifestBytes, browserReport, demoManifest,
    metadata, deployedUrl, testSourceSha256, browserCompletedAt, demoCompletedAt,
    browserScreenshots: await collectBrowserArtifactEvidence(browserReport),
    demoFrames: computeDemoFrameEvidence(demoVideoPath),
    narrationAuditSha256: computeDemoAuditDigest({
      demoManifestPath, visualManifestPath: demoManifest.visual_source.manifest_path,
    }),
    hashes: {
      browserReportSha256: digest(browserReportBytes), demoVideoSha256,
      demoManifestSha256: digest(demoManifestBytes), markerSha256: digest(markerBytes),
    },
  };
}
