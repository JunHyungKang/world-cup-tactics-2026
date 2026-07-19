import { createHash } from "node:crypto";
import { access, lstat, readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { validatePlanningContract } from "./lib/planning-contract.mjs";
import { inspectPlanningPdf, validateAgentVisualReview, validatePlanningCandidateBindings, validatePlanningScreenshotManifest, validatePlanSubmissionReceipt, validateVisualQaLedger } from "./lib/planning-pdf.mjs";
import { inspectPlanReviewManifest } from "./lib/plan-review.mjs";
import { collectEligibilityArtifactPaths, runEligibilityAcceptanceTests, validateDeployedProductData, validateEligibilityArtifacts, validateEligibilityPromotion, validateOfficialAnswerLive } from "./lib/eligibility.mjs";
import {
  getFinalFreezeTimestamp,
  FINAL_EVIDENCE_SOURCE_PATHS,
  collectBrowserArtifactEvidence,
  computeDemoAuditDigest,
  computeDemoFrameEvidence,
  computeBuildDigest,
  computeEvidenceSourceDigest,
  computeWorktreeEvidenceDigest,
  parseDeploymentUrl,
  parseGitHubRepoUrl,
  parseYouTubeVideoUrl,
  probeDeployment,
  probeGitHubPublic,
  probeYouTubePublic,
  validateBrowserReport,
  validateDeadline,
  validateFinalArtifactReview,
  validateFinalLedger,
  validateFinalDemoManifest,
  validateFinalSubmissionReceipt,
  validateYouTubeUploadAttestation,
  validatePostReleaseHistory,
  validateTrackedEvidenceFile,
} from "./lib/final-submission.mjs";
import { parsePairedFlags } from "./lib/cli.mjs";

let args;
try {
  args = parsePairedFlags(process.argv.slice(2));
} catch (error) {
  console.error(`[FAIL] command line: ${error.message}`);
  process.exit(1);
}
const phase = args.get("--phase");
const requireFinalSubmitted = args.get("--require-final-submitted");
const failures = [];
const passes = [];
let canonicalEligibilityState;
let canonicalProductSelection;

const check = (ok, name, detail) => (ok ? passes : failures).push(`${name}: ${detail}`);
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
let worktreeBefore;
try {
  worktreeBefore = await computeWorktreeEvidenceDigest();
} catch (error) {
  check(false, "preflight no-write baseline", error.message);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "playwright-report", "test-results"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await walk(path) : [path]));
  }
  return files;
}

check(phase === "plan" || phase === "final", "phase", phase ?? "missing --phase");
check(
  requireFinalSubmitted === undefined || (phase === "final" && requireFinalSubmitted === "true"),
  "final receipt mode",
  requireFinalSubmitted === undefined ? "pre-submit receipt optional" : "post-submit final-submitted receipt required",
);

if (phase === "plan" || phase === "final") {
  const forbiddenOverrides = ["--eligibility-state", "--official-state", "--organizer-question", "--product-thesis", "--planning-source", "--source-manifest", "--product-selection"];
  const suppliedOverrides = forbiddenOverrides.filter((flag) => args.has(flag));
  check(suppliedOverrides.length === 0, "canonical eligibility inputs", suppliedOverrides.length ? `forbidden overrides: ${suppliedOverrides.join(", ")}` : "repository canonical files");
  try {
    const [stateText, officialState, organizerQuestion, productThesis, planningSource, manifestText, productSelectionText] = await Promise.all([
      readFile("docs/data-scope-resolution.json", "utf8"),
      readFile("docs/official-state.md", "utf8"),
      readFile("docs/organizer-data-scope-question.md", "utf8"),
      readFile("docs/product-thesis.md", "utf8"),
      readFile("docs/planning-outline.md", "utf8"),
      readFile("data/source-manifest.json", "utf8"),
      readFile("docs/product-selection.json", "utf8"),
    ]);
    const eligibilityInput = {
      state: JSON.parse(stateText),
      officialState,
      organizerQuestion,
      productThesis,
      planningSource,
      manifest: JSON.parse(manifestText),
      productSelection: JSON.parse(productSelectionText),
      raw: { officialState, organizerQuestion, productThesis, planningSource, manifest: manifestText, productSelection: productSelectionText },
    };
    canonicalEligibilityState = eligibilityInput.state;
    canonicalProductSelection = eligibilityInput.productSelection;
    const eligibilityErrors = validateEligibilityPromotion(eligibilityInput);
    if (eligibilityErrors.length === 0) {
      eligibilityErrors.push(...await validateEligibilityArtifacts(eligibilityInput));
      eligibilityErrors.push(...await validateOfficialAnswerLive({ state: eligibilityInput.state }));
      eligibilityErrors.push(...runEligibilityAcceptanceTests(eligibilityInput));
      for (const path of collectEligibilityArtifactPaths(eligibilityInput.state, eligibilityInput.manifest, eligibilityInput.productSelection)) {
        try { execFileSync("git", ["ls-files", "--error-unmatch", "--", path], { stdio: "ignore" }); }
        catch { eligibilityErrors.push(`eligibility artifact is not tracked by Git: ${path}`); }
      }
    }
    check(eligibilityErrors.length === 0, "competition data-scope eligibility", eligibilityErrors.join("; ") || "canonical eligibility contract");
  } catch (error) {
    check(false, "competition data-scope eligibility", error.message);
  }
}

if (phase === "plan") {
  const pdfPath = args.get("--planning-pdf");
  const planningSourcePath = "docs/planning-outline.md";
  const ledgerPath = args.get("--submission-ledger") ?? "docs/submission-ledger.md";
  let pdfInspection;
  let planningSource;
  let screenshotManifest;
  let planReviewPacketSha256;
  let planReviewRenderer;
  let agentReviewSha256;
  try {
    check(extname(pdfPath).toLowerCase() === ".pdf", "planning PDF extension", pdfPath);
    pdfInspection = await inspectPlanningPdf(pdfPath);
    check(
      pdfInspection.errors.length === 0,
      "planning PDF content/render",
      pdfInspection.errors.join("; ") || `${pdfInspection.pageCount} pages sha256=${pdfInspection.pdfSha256}`,
    );
  } catch (error) {
    check(false, "planning PDF content/render", error.message);
  }
  try {
    const [sourceText, officialState, manifestText, productThesis, interactionContract, screenshotManifestText] = await Promise.all([
      readFile(planningSourcePath, "utf8"),
      readFile("docs/official-state.md", "utf8"),
      readFile("data/source-manifest.json", "utf8"),
      readFile("docs/product-thesis.md", "utf8"),
      readFile("docs/interaction-acceptance-contract.md", "utf8"),
      readFile("docs/assets/policy-lab-planning/manifest.json", "utf8"),
    ]);
    planningSource = sourceText;
    screenshotManifest = screenshotManifestText;
    const contractErrors = validatePlanningContract({
      source: sourceText,
      officialState,
      manifest: JSON.parse(manifestText),
      productThesis,
      interactionContract,
    });
    check(contractErrors.length === 0, "planning source structural lint", contractErrors.join("; ") || planningSourcePath);
  } catch (error) {
    check(false, "planning source structural lint", error.message);
  }
  if (pdfInspection && planningSource && screenshotManifest) {
    const parsedScreenshotManifest = JSON.parse(screenshotManifest);
    const bindingErrors = validatePlanningCandidateBindings(pdfInspection.pages, {
      sourceSha256: sha256(Buffer.from(planningSource)),
      screenshotManifestSha256: sha256(Buffer.from(screenshotManifest)),
    });
    check(bindingErrors.length === 0, "planning PDF current-build binding", bindingErrors.join("; ") || "current planning source and screenshots");
    const screenshotErrors = await validatePlanningScreenshotManifest(parsedScreenshotManifest);
    check(screenshotErrors.length === 0, "planning screenshot/build binding", screenshotErrors.join("; ") || parsedScreenshotManifest.build_binding.sha256);
    const planReviewManifestPath = args.get("--plan-review-manifest") ?? join("output", "plan-review", pdfInspection.pdfSha256.slice(0, 16), "review-manifest.json");
    const planReview = await inspectPlanReviewManifest(planReviewManifestPath, {
      artifactPath: pdfPath,
      pdfSha256: pdfInspection.pdfSha256,
      sourceSha256: sha256(Buffer.from(planningSource)),
      screenshotManifestSha256: sha256(Buffer.from(screenshotManifest)),
      pageCount: pdfInspection.pageCount,
    });
    planReviewPacketSha256 = planReview.packetSha256;
    planReviewRenderer = planReview.manifest?.renderer;
    check(planReview.errors.length === 0, "planning review packet binding", planReview.errors.join("; ") || `packet=${planReviewPacketSha256}`);
    const agentReviewPath = join("docs", "reviews", `plan-visual-agent-review-${pdfInspection.pdfSha256.slice(0, 16)}.json`);
    try {
      const agentReviewBytes = await readFile(agentReviewPath);
      const agentReviewErrors = validateAgentVisualReview(JSON.parse(agentReviewBytes.toString("utf8")), {
        artifactPath: pdfPath,
        pdfSha256: pdfInspection.pdfSha256,
        sourceSha256: sha256(Buffer.from(planningSource)),
        packetPath: planReviewManifestPath,
        packetSha256: planReview.packetSha256,
        renderer: planReview.manifest?.renderer,
        artifactCreatedAtMs: pdfInspection.modifiedAtMs,
        packetManifest: planReview.manifest,
      });
      agentReviewSha256 = sha256(agentReviewBytes);
      check(agentReviewErrors.length === 0, "independent-agent planning visual review", agentReviewErrors.join("; ") || `review=${agentReviewSha256}`);
    } catch (error) {
      if (error?.code !== "ENOENT") check(false, "independent-agent planning visual review", error.message);
    }
  }
  if (pdfInspection && planningSource) {
    try {
      const ledger = await readFile(ledgerPath, "utf8");
      const ledgerErrors = validateVisualQaLedger(ledger, {
        pdfSha256: pdfInspection.pdfSha256,
        sourceSha256: sha256(Buffer.from(planningSource)),
        packetSha256: planReviewPacketSha256,
        renderer: planReviewRenderer,
        agentReviewSha256,
        pageCount: pdfInspection.pageCount,
        artifactPath: pdfPath,
        artifactCreatedAtMs: pdfInspection.modifiedAtMs,
      });
      ledgerErrors.push(...validatePlanSubmissionReceipt(ledger, {
        artifactPath: pdfPath,
        pdfSha256: pdfInspection.pdfSha256,
        artifactCreatedAtMs: pdfInspection.modifiedAtMs,
      }));
      check(ledgerErrors.length === 0, "planning visual QA ledger", ledgerErrors.join("; ") || ledgerPath);
    } catch (error) {
      check(false, "planning visual QA ledger", error.message);
    }
  }
}

if (phase === "final") {
  const deployedInput = args.get("--deployed-url");
  let deployedUrl = deployedInput;
  const githubInput = args.get("--github-url");
  const youtubeInput = args.get("--youtube-url");
  const releaseCommit = args.get("--release-commit");
  const browserReportPath = args.get("--browser-report");
  const ledgerPath = args.get("--submission-ledger") ?? "docs/submission-ledger.md";
  let githubUrl = githubInput;
  let youtubeUrl = youtubeInput;
  let buildSha256;
  let buildMarker;
  let buildMarkerSha256;
  let markerBuiltAt;
  let browserReportSha256;
  let demoVideoSha256;
  let demoManifestSha256;
  let demoCompletedAt;
  let demoFrames;
  let captionsSha256;
  let narrationAuditSha256;
  let demoVideoPath;
  let browserCompletedAt;
  let artifactReviewerTask;
  let artifactReviewedAt;
  let artifactReviewPath;
  let youtubeUploadConfirmationPath;
  let youtubeUploadConfirmationSha256;
  let youtubeUploader;
  let youtubeUploadedAt;
  let testSourceSha256;
  let browserScreenshots;
  let ledger;
  let releaseEpoch;
  let commitEpoch;
  let headCommit;

  try {
    await access("dist/index.html");
    const build = await computeBuildDigest("dist");
    buildSha256 = build.buildSha256;
    const markerBytes = await readFile("dist/submission-build.json");
    const marker = JSON.parse(markerBytes.toString("utf8"));
    buildMarker = marker;
    buildMarkerSha256 = sha256(markerBytes);
    const sourceTree = releaseCommit
      ? execFileSync("git", ["rev-parse", `${releaseCommit}^{tree}`], { encoding: "utf8" }).trim()
      : undefined;
    const builtAt = Date.parse(marker.builtAt);
    markerBuiltAt = builtAt;
    const eligibilityBindings = {};
    for (const path of [
      "docs/data-scope-resolution.json",
      "docs/official-state.md",
      "docs/organizer-data-scope-question.md",
      "docs/product-thesis.md",
      "docs/planning-outline.md",
      "data/source-manifest.json",
      "docs/product-selection.json",
    ]) eligibilityBindings[path] = sha256(await readFile(path));
    const markerValid = marker.schemaVersion === 1 && marker.releaseCommit === releaseCommit && marker.sourceTree === sourceTree &&
      marker.buildSha256 === buildSha256 && marker.fileCount === build.fileCount && JSON.stringify(marker.files) === JSON.stringify(build.files) &&
      JSON.stringify(marker.eligibilityBindings) === JSON.stringify(eligibilityBindings) &&
      JSON.stringify(marker.productDataBinding) === JSON.stringify(canonicalEligibilityState?.binding?.derived_binding) &&
      marker.builder === "scripts/build-release.mjs" &&
      Number.isFinite(builtAt) && builtAt <= Date.now() && builtAt <= Date.parse("2026-08-03T10:00:00+09:00");
    check(markerValid, "production build fingerprint", markerValid
      ? `dist tree ${build.fileCount} files sha256=${buildSha256}`
      : "dist/submission-build.json does not bind this build to --release-commit");
    const derivedBinding = canonicalEligibilityState?.binding?.derived_binding;
    if (derivedBinding?.path?.startsWith("public/")) {
      const deployedBindingPath = join("dist", derivedBinding.path.slice("public/".length));
      check(sha256(await readFile(deployedBindingPath)) === derivedBinding.sha256, "deployed product/data binding", deployedBindingPath);
    } else {
      check(false, "deployed product/data binding", "eligibility state lacks a public derived binding");
    }
    const deployedDataErrors = await validateDeployedProductData({ productSelection: canonicalProductSelection });
    check(deployedDataErrors.length === 0, "deployed selected data files", deployedDataErrors.join("; ") || `${canonicalProductSelection.data_files.length} files`);
    if (canonicalProductSelection?.data_scope === "2026-tactical-only") {
      const historicalHits = [];
      for (const path of await walk("dist")) {
        if (!/\.(?:css|html|js|json|map|svg|txt)$/iu.test(path)) continue;
        const text = (await readFile(path, "utf8"));
        if (/Pappalardo|Figshare|pappalardo-wyscout|2018 historical/iu.test(text)) historicalHits.push(path);
      }
      check(historicalHits.length === 0, "2026-only production scope", historicalHits.join(", ") || "no historical-core markers in dist");
    }
  } catch (error) {
    check(false, "production build fingerprint", `${error.message}; run the release build stamp workflow`);
  }

  try {
    deployedUrl = parseDeploymentUrl(deployedInput);
    const result = await probeDeployment(deployedInput, fetch, buildMarker);
    deployedUrl = new URL(result.finalUrl).toString();
    check(result.errors.length === 0, "deployment HTTP readiness", result.errors.join("; ") || `${result.status} ${result.contentType} ${result.bodyBytes} bytes`);
  } catch (error) {
    check(false, "deployment HTTP readiness", error.message);
  }
  try {
    headCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    check(/^[0-9a-f]{40}$/u.test(headCommit), "local evidence HEAD", headCommit);
  } catch (error) {
    check(false, "local evidence HEAD", error.message);
  }
  try {
    githubUrl = parseGitHubRepoUrl(githubInput).url;
    const result = await probeGitHubPublic(githubInput, fetch, releaseCommit, headCommit);
    check(result.errors.length === 0, "GitHub public API", result.errors.join("; ") || result.apiUrl);
  } catch (error) {
    check(false, "GitHub public API", error.message);
  }
  try {
    youtubeUrl = parseYouTubeVideoUrl(youtubeInput).url;
    const result = await probeYouTubePublic(youtubeInput);
    check(result.errors.length === 0, "YouTube oEmbed", result.errors.join("; ") || result.endpoint);
  } catch (error) {
    check(false, "YouTube oEmbed", error.message);
  }
  try {
    demoVideoPath = args.get("--demo-video");
    const demoVideo = await readFile(demoVideoPath);
    demoVideoSha256 = sha256(demoVideo);
    check(demoVideo.length >= 100_000, "final demo video binding", `${demoVideoPath} ${demoVideo.length} bytes sha256=${demoVideoSha256}`);
  } catch (error) {
    check(false, "final demo video binding", `${error.message}; pass --demo-video with the exact uploaded file`);
  }
  try {
    const demoManifestPath = args.get("--demo-manifest");
    if (!demoManifestPath) throw new Error("missing --demo-manifest");
    const [manifestBytes, storyBytes] = await Promise.all([
      readFile(demoManifestPath),
      readFile("docs/submission-story.json"),
    ]);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    demoManifestSha256 = sha256(manifestBytes);
    demoCompletedAt = Date.parse(manifest.source?.capture_completed_at);
    captionsSha256 = manifest.captions_sha256;
    const demoErrors = await validateFinalDemoManifest(manifest, {
      deployedUrl,
      commit: releaseCommit,
      buildSha256,
      demoVideoPath,
      demoVideoSha256,
      storySha256: sha256(storyBytes),
      markerSha256: buildMarkerSha256,
      markerBuiltAt,
    });
    check(demoErrors.length === 0, "final demo release/source manifest", demoErrors.join("; ") || `${demoManifestPath} sha256=${demoManifestSha256}`);
    const visualManifestPath = manifest.visual_source?.manifest_path;
    narrationAuditSha256 = computeDemoAuditDigest({ demoManifestPath, visualManifestPath });
    demoFrames = computeDemoFrameEvidence(demoVideoPath);
    check(true, "decoded demo frame/audio/caption evidence", `7 frames audit=${narrationAuditSha256}`);
  } catch (error) {
    check(false, "final demo release/source manifest", `${error.message}; pass --demo-manifest with the exact upload-candidate manifest`);
  }
  if (browserReportPath && deployedUrl && buildSha256 && releaseCommit) {
    try {
      testSourceSha256 = await computeEvidenceSourceDigest(FINAL_EVIDENCE_SOURCE_PATHS);
      releaseEpoch = Number(execFileSync("git", ["show", "-s", "--format=%ct", releaseCommit], { encoding: "utf8" }).trim());
      const browserReportBuffer = await readFile(browserReportPath);
      browserReportSha256 = sha256(browserReportBuffer);
      const browserReport = JSON.parse(browserReportBuffer.toString("utf8"));
      browserCompletedAt = Date.parse(browserReport.stats?.startTime) + browserReport.stats?.duration;
      const reportErrors = validateBrowserReport(browserReport, {
        deployedUrl, releaseCommit, buildSha256, testSourceSha256,
        earliestEvidenceMs: Math.max(releaseEpoch * 1000, markerBuiltAt ?? 0),
      });
      browserScreenshots = await collectBrowserArtifactEvidence(browserReport);
      if (browserScreenshots.length !== 12) reportErrors.push("Playwright report must carry three BG-14 PNG artifacts for each project");
      check(reportErrors.length === 0, "Playwright browser evidence", reportErrors.join("; ") || `${browserReportPath} sha256=${browserReportSha256}`);
    } catch (error) {
      check(false, "Playwright browser evidence", error.message);
    }
  } else {
    check(false, "Playwright browser evidence", "missing --browser-report or release/build binding");
  }
  let artifactReviewSha256;
  try {
    artifactReviewPath = args.get("--artifact-review");
    if (!artifactReviewPath) throw new Error("missing --artifact-review");
    const artifactReviewBytes = await readFile(artifactReviewPath);
    artifactReviewSha256 = sha256(artifactReviewBytes);
    const expectedReviewPath = `docs/reviews/final-artifact-review-${artifactReviewSha256.slice(0, 16)}.json`;
    if (artifactReviewPath !== expectedReviewPath) throw new Error(`artifact review must use content-addressed path ${expectedReviewPath}`);
    execFileSync("git", ["ls-files", "--error-unmatch", artifactReviewPath], { stdio: "ignore" });
    const artifactFileErrors = validateTrackedEvidenceFile(
      artifactReviewPath, artifactReviewBytes, await lstat(artifactReviewPath),
      execFileSync("git", ["show", `HEAD:${artifactReviewPath}`]),
    );
    if (artifactFileErrors.length) throw new Error(artifactFileErrors.join("; "));
    const artifactReview = JSON.parse(artifactReviewBytes.toString("utf8"));
    artifactReviewerTask = artifactReview.reviewer?.task;
    artifactReviewedAt = Date.parse(artifactReview.reviewed_at);
    const reviewErrors = validateFinalArtifactReview(artifactReview, {
      deployedUrl, youtubeUrl, commit: releaseCommit, buildSha256, browserReportSha256, testSourceSha256,
      demoVideoSha256, demoManifestSha256, browserCompletedAt, demoCompletedAt,
      browserScreenshots, demoFrames, captionsSha256, narrationAuditSha256,
    });
    check(reviewErrors.length === 0, "independent-agent final artifact review",
      reviewErrors.join("; ") || `${artifactReviewPath} sha256=${artifactReviewSha256}`);
  } catch (error) {
    check(false, "independent-agent final artifact review", `${error.message}; pass --artifact-review after public browser/demo evidence exists`);
  }
  try {
    youtubeUploadConfirmationPath = args.get("--youtube-upload-confirmation");
    if (!youtubeUploadConfirmationPath) throw new Error("missing --youtube-upload-confirmation");
    const confirmationBytes = await readFile(youtubeUploadConfirmationPath);
    youtubeUploadConfirmationSha256 = sha256(confirmationBytes);
    const expectedPath = `docs/reviews/youtube-upload-attestation-${youtubeUploadConfirmationSha256.slice(0, 16)}.json`;
    if (youtubeUploadConfirmationPath !== expectedPath) throw new Error(`YouTube upload attestation must use content-addressed path ${expectedPath}`);
    execFileSync("git", ["ls-files", "--error-unmatch", youtubeUploadConfirmationPath], { stdio: "ignore" });
    const attestationFileErrors = validateTrackedEvidenceFile(
      youtubeUploadConfirmationPath, confirmationBytes, await lstat(youtubeUploadConfirmationPath),
      execFileSync("git", ["show", `HEAD:${youtubeUploadConfirmationPath}`]),
    );
    if (attestationFileErrors.length) throw new Error(attestationFileErrors.join("; "));
    const attestation = JSON.parse(confirmationBytes.toString("utf8"));
    youtubeUploader = attestation.owner;
    youtubeUploadedAt = Date.parse(attestation.uploaded_at);
    const attestationErrors = validateYouTubeUploadAttestation(attestation, {
      youtubeUrl, demoVideoSha256, demoCompletedAt,
    });
    check(attestationErrors.length === 0, "owner YouTube upload attestation",
      attestationErrors.join("; ") || `${youtubeUploadConfirmationPath} sha256=${youtubeUploadConfirmationSha256}`);
  } catch (error) {
    check(false, "owner YouTube upload attestation", `${error.message}; pass the content-addressed owner attestation after upload`);
  }
  try {
    ledger = await readFile(ledgerPath, "utf8");
  } catch (error) {
    check(false, "final evidence ledger", error.message);
  }

  let status = "";
  try {
    status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
    headCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    commitEpoch = Number(execFileSync("git", ["log", "-1", "--format=%ct"], { encoding: "utf8" }).trim());
    if (releaseCommit) releaseEpoch = Number(execFileSync("git", ["show", "-s", "--format=%ct", releaseCommit], { encoding: "utf8" }).trim());
    check(status === "", "Git freeze", status || `clean HEAD ${headCommit}`);
  } catch (error) {
    check(false, "Git freeze", error.message);
  }

  if (releaseCommit) {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", releaseCommit, "HEAD"], { stdio: "ignore" });
      const postReleaseFiles = execFileSync("git", ["diff", "--name-only", `${releaseCommit}..HEAD`], { encoding: "utf8" })
        .trim().split(/\r?\n/u).filter(Boolean);
      const allowedPostReleasePaths = ["docs/submission-ledger.md", artifactReviewPath, youtubeUploadConfirmationPath].filter(Boolean);
      const disallowed = postReleaseFiles.filter((path) => !allowedPostReleasePaths.includes(path));
      check(disallowed.length === 0, "release immutability", disallowed.join(", ") || `${releaseCommit} -> HEAD changes only submission ledger`);
      const commitShas = execFileSync("git", ["rev-list", "--reverse", `${releaseCommit}..HEAD`], { encoding: "utf8" })
        .trim().split(/\r?\n/u).filter(Boolean);
      const history = commitShas.map((sha) => ({
        sha,
        timestampMs: Number(execFileSync("git", ["show", "-s", "--format=%ct", sha], { encoding: "utf8" }).trim()) * 1000,
        paths: execFileSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", "-m", sha], { encoding: "utf8" })
          .trim().split(/\r?\n/u).filter(Boolean),
      }));
      const historyErrors = validatePostReleaseHistory(history, { allowedPaths: allowedPostReleasePaths });
      check(historyErrors.length === 0, "post-release commit history", historyErrors.join("; ") || `${history.length} ledger-only commit(s)`);
    } catch (error) {
      check(false, "release immutability", `--release-commit must be an ancestor of HEAD: ${error.message}`);
    }
  } else {
    check(false, "release immutability", "missing --release-commit");
  }

  if (ledger && buildSha256 && browserReportSha256 && demoVideoSha256 && artifactReviewSha256 &&
      youtubeUploadConfirmationSha256 && deployedUrl && githubUrl && youtubeUrl && releaseCommit) {
    const ledgerErrors = validateFinalLedger(ledger, {
      deployedUrl, githubUrl, youtubeUrl, commit: releaseCommit, buildSha256, browserReportSha256, demoVideoSha256,
      browserCompletedAt, artifactReviewSha256, artifactReviewerTask, artifactReviewedAt,
      youtubeUploadConfirmationSha256, youtubeUploader, youtubeUploadedAt,
      releaseEpochSeconds: releaseEpoch, headEpochSeconds: commitEpoch,
    });
    ledgerErrors.push(...validateFinalSubmissionReceipt(ledger, {
      commit: releaseCommit,
      buildSha256,
      required: requireFinalSubmitted === "true",
      headEpochSeconds: commitEpoch,
    }));
    check(ledgerErrors.length === 0, "final evidence ledger", ledgerErrors.join("; ") || ledgerPath);
  }
  const deadlineErrors = validateDeadline({
    commitEpochSeconds: commitEpoch,
    frozenAt: ledger ? getFinalFreezeTimestamp(ledger) : undefined,
  });
  check(deadlineErrors.length === 0, "commit/freeze deadline", deadlineErrors.join("; ") || new Date(commitEpoch * 1000).toISOString());
}

const secretPatterns = [/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/, /"(?:token|api_key|secret)"\s*:\s*"[^"\r\n]{12,}"/i];
const secretFindings = [];
for (const path of await walk(".")) {
  try {
    const content = await readFile(path);
    const isBuildText = path.startsWith("dist/") && /\.(?:css|html|js|json|map|svg|txt)$/iu.test(path);
    if ((isBuildText || content.length <= 1_000_000) && secretPatterns.some((pattern) => pattern.test(content.toString("utf8")))) secretFindings.push(path);
  } catch { /* unreadable generated files are outside the submission source scan */ }
}
check(secretFindings.length === 0, "secret scan", secretFindings.join(", ") || "clear");

if (worktreeBefore) {
  try {
    const worktreeAfter = await computeWorktreeEvidenceDigest();
    check(
      worktreeAfter.sha256 === worktreeBefore.sha256 && worktreeAfter.fileCount === worktreeBefore.fileCount,
      "preflight no-write",
      worktreeAfter.sha256 === worktreeBefore.sha256
        ? `${worktreeAfter.fileCount} tracked/nonignored files unchanged`
        : `before=${worktreeBefore.sha256} after=${worktreeAfter.sha256}`,
    );
  } catch (error) {
    check(false, "preflight no-write", error.message);
  }
}

passes.forEach((message) => console.log(`[PASS] ${message}`));
failures.forEach((message) => console.error(`[FAIL] ${message}`));
process.exit(failures.length ? 1 : 0);
