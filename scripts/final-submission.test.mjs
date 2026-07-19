import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePairedFlags } from "./lib/cli.mjs";
import {
  computeBuildDigest,
  buildFinalArtifactReviewTemplate,
  buildYouTubeUploadAttestation,
  collectBrowserArtifactEvidence,
  computeDemoFrameEvidence,
  assertSnapshotSourceEntry,
  auditStaticBuild,
  computeWorktreeEvidenceDigest,
  REQUIRED_BROWSER_GATE_TITLES,
  parseDeploymentUrl,
  parseGitHubRepoUrl,
  parseYouTubeVideoUrl,
  probeDeployment,
  probeGitHubPublic,
  probeYouTubePublic,
  runReleaseVerification,
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

function response({ status = 200, url = "https://entry.example/", type = "text/html", body = "<html><main>Manager</main></html>", json }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? type : null },
    text: async () => body,
    arrayBuffer: async () => Buffer.from(json === undefined ? body : `${JSON.stringify(json, null, 2)}\n`),
    json: async () => json ?? JSON.parse(body),
  };
}

const commit = "a".repeat(40);
const buildSha256 = "b".repeat(64);
const browserReportSha256 = "d".repeat(64);
const testSourceSha256 = "e".repeat(64);
const demoVideoSha256 = "9".repeat(64);
const demoManifestSha256 = "8".repeat(64);
const artifactReviewSha256 = "7".repeat(64);
const youtubeUploadConfirmationSha256 = "2".repeat(64);
const deployedUrl = "https://entry.example/";
const githubUrl = "https://github.com/example/world-cup";
const youtubeUrl = "https://www.youtube.com/watch?v=abcdefghijk";

function finalLedger(overrides = {}) {
  const values = { commit, buildSha256, deployedUrl, githubUrl, youtubeUrl, ...overrides };
  return [
    `| 2026-08-02T20:00:00+09:00 | final-browser-qa | ${values.deployedUrl} | commit=${values.commit} build=${values.buildSha256} report=${browserReportSha256} | browser-report PASS artifact-visual PASS voiceover UNAVAILABLE-NO-CLAIM | public | reviewer=/root/final_artifact_reviewer role=independent-agent review=${artifactReviewSha256} Playwright=1.61.1 |`,
    `| 2026-08-02T20:10:00+09:00 | github-public | ${values.githubUrl} | commit=${values.commit} | public-API PASS release-commit PASS repo-docs PASS | public | GitHub API |`,
    `| 2026-08-02T20:20:00+09:00 | youtube-public | ${values.youtubeUrl} | commit=${values.commit} build=${values.buildSha256} video=${demoVideoSha256} | oEmbed PASS demo-contract PASS artifact-audio-visual PASS | public | reviewer=/root/final_artifact_reviewer role=independent-agent review=${artifactReviewSha256} source-url=${values.deployedUrl} uploader=JunhyungKang confirmation=${youtubeUploadConfirmationSha256} |`,
    `| 2026-08-02T20:30:00+09:00 | final-freeze | release | commit=${values.commit} build=${values.buildSha256} | clean PASS deadline PASS | frozen | preflight=PASS |`,
  ].join("\n");
}

describe("final submission readiness", () => {
  it("accepts pnpm's separator and preserves the fail-closed raw release invariant", async () => {
    expect(Object.fromEntries(parsePairedFlags([
      "--", "--phase", "plan", "--planning-pdf", "submissions/plan.pdf",
    ]))).toEqual({ "--phase": "plan", "--planning-pdf": "submissions/plan.pdf" });
    expect(() => parsePairedFlags(["--phase"])).toThrow("missing value");
    expect(() => parsePairedFlags(["--phase", "plan", "--phase", "final"])).toThrow("duplicate flag");
    const builder = await readFile("scripts/build-release.mjs", "utf8");
    expect(builder).toContain('["ls-files", "data/raw"]');
    expect(builder).toContain('path !== "data/raw/.gitkeep"');
    expect(builder).toContain("release build refuses tracked raw data");
    const drill = await readFile("scripts/drill-release-build.mjs", "utf8");
    expect(drill).toContain('"install", "--frozen-lockfile", "--ignore-scripts"');
    expect(drill).not.toContain('symlink(resolve(root, "node_modules")');
    expect(drill).toContain("fresh frozen-lock dependency install failed");
    const directory = await mkdtemp(join(tmpdir(), "snapshot-symlink-"));
    try {
      const link = join(directory, "tracked-link");
      await symlink("/tmp/out-of-tree-target", link);
      const linkStats = await lstat(link);
      expect(() => assertSnapshotSourceEntry("tracked-link", linkStats)).toThrow(
        "clean-clone snapshot refuses symbolic link source: tracked-link",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("hashes the complete build content while excluding only its self-referential marker", async () => {
    const directory = await mkdtemp(join(tmpdir(), "final-build-digest-"));
    try {
      await mkdir(join(directory, "assets"));
      await writeFile(join(directory, "index.html"), "entry");
      await writeFile(join(directory, "assets", "app.js"), "first");
      await writeFile(join(directory, "assets", "app.css"), "body{}");
      await writeFile(join(directory, "index.html"), '<script type="module" src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">');
      const first = await computeBuildDigest(directory);
      expect((await auditStaticBuild(directory)).errors).toEqual([]);
      await writeFile(join(directory, "index.html"), '<script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="./assets/missing.css">');
      expect((await auditStaticBuild(directory)).errors).toEqual(expect.arrayContaining([
        "static asset reference must be relative for subpath hosting: /assets/app.js",
        "static asset does not resolve inside the build: ./assets/missing.css",
      ]));
      await writeFile(join(directory, "index.html"), '<script type="module" src="https://cdn.example/app.js"></script><link rel="stylesheet" href="./assets/app.css">');
      expect((await auditStaticBuild(directory)).errors).toContain(
        "static entry depends on an external script or stylesheet: https://cdn.example/app.js",
      );
      await writeFile(join(directory, "index.html"), '<script type="module" src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">');
      await writeFile(join(directory, "submission-build.json"), "ignored marker");
      expect(await computeBuildDigest(directory)).toEqual(first);
      await writeFile(join(directory, "assets", "app.js"), "second");
      expect((await computeBuildDigest(directory)).buildSha256).not.toBe(first.buildSha256);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("accepts only canonical repository and video URLs", () => {
    expect(parseGitHubRepoUrl(githubUrl)).toMatchObject({ owner: "example", repo: "world-cup" });
    expect(() => parseGitHubRepoUrl(`${githubUrl}/issues`)).toThrow("exactly");
    expect(parseYouTubeVideoUrl("https://youtu.be/abcdefghijk").videoId).toBe("abcdefghijk");
    expect(() => parseYouTubeVideoUrl(`${youtubeUrl}&list=PL123`)).toThrow("tracking or playlist");
    expect(() => parseDeploymentUrl("https://127.0.0.1/app")).toThrow("private, loopback, or reserved");
    expect(() => parseDeploymentUrl("https://entry.internal/app")).toThrow("public hostname");
    expect(parseDeploymentUrl("https://entry.example/repo")).toBe("https://entry.example/repo/");
  });

  it("distinguishes deployment HTTP readiness from an access gate", async () => {
    const ready = await probeDeployment(deployedUrl, async () => response({}));
    expect(ready.errors).toEqual([]);
    const gated = await probeDeployment(deployedUrl, async () => response({ body: '<input type="password">' }));
    expect(gated.errors).toContain("deployment HTML appears to require a password or API key");
    const loginRedirect = await probeDeployment(deployedUrl, async () => response({ url: "https://entry.example/login" }));
    expect(loginRedirect.errors).toContain("deployment redirects to an authentication route");
  });

  it("matches the deployed build marker to the release artifact", async () => {
    let calls = 0;
    const urls = [];
    const result = await probeDeployment("https://entry.example/repo", async (url) => {
      urls.push(String(url));
      calls += 1;
      return calls === 1
        ? response({ url: "https://entry.example/repo/" })
        : response({ type: "application/json", json: { releaseCommit: commit, buildSha256 } });
    }, { releaseCommit: commit, buildSha256 }, async () => [{ address: "93.184.216.34", family: 4 }]);
    expect(result.errors).toEqual([]);
    expect(calls).toBe(2);
    expect(urls).toEqual(["https://entry.example/repo/", "https://entry.example/repo/submission-build.json"]);
  });

  it("rejects a copied marker when deployed asset bytes are stale", async () => {
    const releaseBody = "release bytes";
    const files = [{ path: "assets/app.js", bytes: releaseBody.length, sha256: "f".repeat(64) }];
    let calls = 0;
    const urls = [];
    const result = await probeDeployment("https://entry.example/repo", async (url) => {
      urls.push(String(url));
      calls += 1;
      if (calls === 1) return response({ url: "https://entry.example/repo/" });
      if (calls === 2) return response({ type: "application/json", json: { releaseCommit: commit, buildSha256, files } });
      return response({ type: "application/javascript", body: "stale bytes" });
    }, { releaseCommit: commit, buildSha256, files }, async () => [{ address: "93.184.216.34", family: 4 }]);
    expect(result.errors).toContain("deployed build file assets/app.js does not match release bytes");
    expect(urls).toEqual([
      "https://entry.example/repo/",
      "https://entry.example/repo/submission-build.json",
      "https://entry.example/repo/assets/app.js",
    ]);
  });

  it("rejects private GitHub metadata and unavailable YouTube metadata", async () => {
    const privateRepo = await probeGitHubPublic(githubUrl, async () => response({ type: "application/json", json: { private: true } }));
    expect(privateRepo.errors).toContain("GitHub repository is not confirmed public");
    const missingVideo = await probeYouTubePublic(youtubeUrl, async () => response({ status: 404, type: "application/json", json: {} }));
    expect(missingVideo.errors).toContain("YouTube oEmbed returned HTTP 404");
  });

  it("requires the release commit to be visible in the public repository", async () => {
    let calls = 0;
    const result = await probeGitHubPublic(githubUrl, async () => {
      calls += 1;
      return calls === 1
        ? response({ type: "application/json", json: { private: false, archived: false, disabled: false } })
        : response({ status: 404, type: "application/json", json: {} });
    }, commit);
    expect(result.errors).toContain("release commit is not public through the GitHub API: HTTP 404");
  });

  it("checks submission documentation and required source paths at the release commit", async () => {
    let calls = 0;
    const result = await probeGitHubPublic(githubUrl, async () => {
      calls += 1;
      if (calls === 1) return response({ type: "application/json", json: { private: false, archived: false, disabled: false, default_branch: "main" } });
      if (calls === 2) return response({ type: "application/json", json: { sha: commit } });
      if (calls === 3) return response({ type: "application/json", json: { encoding: "base64", content: Buffer.from("No setup here").toString("base64") } });
      return response({ type: "application/json", json: [] });
    }, commit);
    expect(result.errors).toContain("release README lacks setup commands or technology disclosure");
    expect(calls).toBe(5);
  });

  it("requires the exact evidence HEAD to be public after ledger commits", async () => {
    const evidenceHead = "c".repeat(40);
    let calls = 0;
    const result = await probeGitHubPublic(githubUrl, async () => {
      calls += 1;
      if (calls === 1) return response({ type: "application/json", json: { private: false, archived: false, disabled: false, default_branch: "main" } });
      if (calls === 2) return response({ type: "application/json", json: { sha: commit } });
      if (calls === 3) return response({ type: "application/json", json: { encoding: "base64", content: Buffer.from("## Local setup\npnpm install\npnpm dev\n## Tech stack\nReact").toString("base64") } });
      if (calls === 4) return response({ type: "application/json", json: { type: "file" } });
      if (calls === 5) return response({ type: "application/json", json: [{ name: "App.tsx" }] });
      return response({ type: "application/json", json: { sha: evidenceHead } });
    }, commit, evidenceHead);
    expect(result.errors).toEqual([]);
    expect(calls).toBe(6);

    const missing = await probeGitHubPublic(githubUrl, async (_, options) => {
      void options;
      calls += 1;
      return response({ status: 404, type: "application/json", json: {} });
    }, undefined, evidenceHead);
    expect(missing.errors).toContain("GitHub repository metadata lacks a default branch for evidence HEAD verification");
  });

  it("rejects every forbidden path and late timestamp in post-release commit history", () => {
    const beforeDeadline = Date.parse("2026-08-03T09:00:00+09:00");
    expect(validatePostReleaseHistory([
      { sha: "c".repeat(40), timestampMs: beforeDeadline, paths: ["docs/submission-ledger.md"] },
    ])).toEqual([]);
    const errors = validatePostReleaseHistory([
      { sha: "d".repeat(40), timestampMs: beforeDeadline, paths: ["src/App.tsx", "docs/submission-ledger.md"] },
      { sha: "e".repeat(40), timestampMs: Date.parse("2026-08-03T10:01:00+09:00"), paths: ["docs/submission-ledger.md"] },
    ]);
    expect(errors).toContain(`post-release commit ${"d".repeat(40)} changed forbidden path: src/App.tsx`);
    expect(errors).toContain(`post-release commit ${"e".repeat(40)} is after the submission deadline`);
  });

  it("fingerprints tracked and nonignored worktree bytes while excluding ignored caches", async () => {
    const directory = await mkdtemp(join(tmpdir(), "submission-no-write-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: directory });
      await writeFile(join(directory, ".gitignore"), "cache/\n");
      await writeFile(join(directory, "tracked.txt"), "first");
      execFileSync("git", ["add", ".gitignore", "tracked.txt"], { cwd: directory });
      const baseline = await computeWorktreeEvidenceDigest({ cwd: directory });
      await mkdir(join(directory, "cache"));
      await writeFile(join(directory, "cache", "ignored.txt"), "ignored mutation");
      expect((await computeWorktreeEvidenceDigest({ cwd: directory })).sha256).toBe(baseline.sha256);
      await writeFile(join(directory, "tracked.txt"), "changed");
      expect((await computeWorktreeEvidenceDigest({ cwd: directory })).sha256).not.toBe(baseline.sha256);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("accepts only a zero-finding, release-bound independent-agent artifact review", () => {
    const browserCompletedAt = Date.parse("2026-08-02T19:31:00+09:00");
    const demoCompletedAt = Date.parse("2026-08-02T19:02:00+09:00");
    const browserScreenshots = ["chromium", "firefox", "mobile", "webkit"].flatMap((project) =>
      ["artifact-counterexample", "artifact-initial", "artifact-selected"].map((name) => ({
        project, name, sha256: "6".repeat(64), bytes: 1000, width: 1440, height: 900,
      }))).sort((a, b) => `${a.project}:${a.name}`.localeCompare(`${b.project}:${b.name}`));
    const demoFrames = [2, 8, 18, 29, 35, 45, 58].map((time_seconds) => ({
      time_seconds, pixel_sha256: "5".repeat(64), bytes: 1440 * 900 * 3,
      width: 1440, height: 900, pixel_format: "rgb24",
    }));
    const captionsSha256 = "4".repeat(64);
    const narrationAuditSha256 = "3".repeat(64);
    const inspectionManifestSha256 = "1".repeat(64);
    const review = {
      schema_version: 1,
      status: "PASS",
      scope: "independent-agent-final-artifact-qa-not-human-accessibility-usability-preference-memorability-evidence",
      reviewed_at: "2026-08-02T19:45:00+09:00",
      reviewer: { task: "/root/final_artifact_reviewer", role: "independent-agent", artifact_creator: false },
      release: { deployed_url: deployedUrl, commit, build_sha256: buildSha256 },
      browser: {
        report_sha256: browserReportSha256,
        test_source_sha256: testSourceSha256,
        completed_at: new Date(browserCompletedAt).toISOString(),
        criteria: ["visual_hierarchy", "manager_loop", "claim_boundaries", "no_login_key", "major_browser_report"],
        screenshots: browserScreenshots,
        findings: [],
      },
      demo: {
        youtube_url: youtubeUrl,
        video_sha256: demoVideoSha256,
        manifest_sha256: demoManifestSha256,
        completed_at: new Date(demoCompletedAt).toISOString(),
        criteria: ["cold_open", "direct_manipulation", "pitch_replays", "counterexample_receipt", "audio_captions", "claim_boundaries"],
        frames: demoFrames,
        captions_sha256: captionsSha256,
        narration_audit_sha256: narrationAuditSha256,
        audio_codec: "opus",
        findings: [],
      },
      inspection: { manifest_sha256: inspectionManifestSha256, file_count: 19 },
      summary: { blocker: 0, major: 0, minor: 0, finding_count: 0 },
    };
    const options = {
      deployedUrl, youtubeUrl, commit, buildSha256, browserReportSha256, testSourceSha256,
      demoVideoSha256, demoManifestSha256, browserCompletedAt, demoCompletedAt,
      browserScreenshots, demoFrames, captionsSha256, narrationAuditSha256,
      inspectionManifestSha256,
      now: Date.parse("2026-08-02T20:00:00+09:00"),
    };
    expect(validateFinalArtifactReview(review, options)).toEqual([]);
    expect(validateFinalArtifactReview({ ...review, reviewer: { ...review.reviewer, task: "/root" } }, options))
      .toContain("final artifact review must identify a distinct /root/<task> reviewer");
    expect(validateFinalArtifactReview({ ...review, demo: { ...review.demo, video_sha256: "3".repeat(64) } }, options))
      .toContain("final artifact review demo evidence binding mismatch");
    expect(validateFinalArtifactReview({ ...review, summary: { ...review.summary, major: 1 } }, options))
      .toContain("final artifact review summary must report zero findings");
    expect(validateFinalArtifactReview({ ...review, browser: { ...review.browser, screenshots: [] } }, options))
      .toContain("final artifact review must bind twelve recomputed browser screenshots");
    expect(validateFinalArtifactReview({ ...review, demo: { ...review.demo, frames: [] } }, options))
      .toContain("final artifact review must bind seven recomputed canonical demo frames");
  });

  it("recomputes browser PNG and canonical demo-frame bytes instead of trusting review JSON", async () => {
    const png = Buffer.alloc(24);
    Buffer.from("89504e470d0a1a0a", "hex").copy(png, 0);
    png.write("IHDR", 12, "ascii"); png.writeUInt32BE(1440, 16); png.writeUInt32BE(900, 20);
    const names = ["artifact-initial", "artifact-selected", "artifact-counterexample"];
    const report = { suites: [{ specs: [{ title: "BG-14 evidence", tests:
      ["chromium", "firefox", "mobile", "webkit"].map((projectName) => ({
        projectName, results: [{ attachments: names.map((name) => ({
          name, contentType: "image/png", path: `test-results/${projectName}-${name}.png`,
        })) }],
      })),
    }] }] };
    const screenshots = await collectBrowserArtifactEvidence(report, { read: async () => png });
    expect(screenshots).toHaveLength(12);
    expect(screenshots).toContainEqual(expect.objectContaining({ project: "chromium", name: "artifact-initial", width: 1440, height: 900 }));
    report.suites[0].specs[0].tests[0].results[0].attachments[1].name = "artifact-initial";
    await expect(collectBrowserArtifactEvidence(report, { read: async () => png })).rejects.toThrow("unique four-project by three-state");
    const pixels = Buffer.alloc(1440 * 900 * 3, 7);
    const frames = computeDemoFrameEvidence("candidate.webm", { runner: () => ({ status: 0, stdout: pixels }) });
    expect(frames).toHaveLength(7);
    expect(frames.map(({ time_seconds }) => time_seconds)).toEqual([2, 8, 18, 29, 35, 45, 58]);
    expect(frames[0]).toMatchObject({ bytes: pixels.length, pixel_format: "rgb24" });
    const regular = { isFile: () => true, isSymbolicLink: () => false };
    expect(validateTrackedEvidenceFile("docs/reviews/review.json", png, regular, Buffer.from(png))).toEqual([]);
    expect(validateTrackedEvidenceFile("docs/reviews/review.json", png,
      { isFile: () => false, isSymbolicLink: () => true }, Buffer.from(png)))
      .toContain("docs/reviews/review.json must be a regular non-symlink file");
    expect(validateTrackedEvidenceFile("docs/reviews/review.json", png, regular, Buffer.from("different")))
      .toContain("docs/reviews/review.json working bytes must exactly match the Git HEAD blob");
  });

  it("treats YouTube upload identity as a content-addressed owner attestation only", () => {
    const attestation = buildYouTubeUploadAttestation({
      owner: "JunhyungKang", youtubeUrl, demoVideoSha256, uploadedAt: "2026-08-02T20:10:00+09:00",
    });
    const options = {
      youtubeUrl, demoVideoSha256, demoCompletedAt: Date.parse("2026-08-02T19:02:00+09:00"),
      now: Date.parse("2026-08-02T20:15:00+09:00"),
    };
    expect(validateYouTubeUploadAttestation(attestation, options)).toEqual([]);
    expect(validateYouTubeUploadAttestation({ ...attestation, local_video_sha256: "0".repeat(64) }, options))
      .toContain("YouTube upload attestation must bind the public URL and exact local candidate SHA-256");
    expect(validateYouTubeUploadAttestation({ ...attestation, owner: "agent" }, options))
      .toContain("YouTube upload attestation must identify the real owner");
    expect(validateYouTubeUploadAttestation(attestation, { ...options, demoCompletedAt: Number.NaN }))
      .toContain("YouTube upload attestation timestamp must follow the candidate and precede the deadline");
  });

  it("prepares a deliberately failing review template and content-addressed finalization scripts", async () => {
    const template = buildFinalArtifactReviewTemplate({
      deployedUrl, youtubeUrl, commit, buildSha256, browserReportSha256, testSourceSha256,
      browserCompletedAt: Date.parse("2026-08-02T19:31:00+09:00"), browserScreenshots: [],
      demoVideoSha256, demoManifestSha256, demoCompletedAt: Date.parse("2026-08-02T19:02:00+09:00"),
      demoFrames: [], captionsSha256: "4".repeat(64), narrationAuditSha256: "3".repeat(64),
      inspectionManifestSha256: "1".repeat(64),
    });
    expect(template.status).toBe("PENDING-INDEPENDENT-REVIEW");
    expect(template.reviewer.task).toBeNull();
    expect(template.browser.findings).toEqual(["UNREVIEWED"]);
    expect(template.demo.findings).toEqual(["UNREVIEWED"]);
    expect(template.summary).toMatchObject({ blocker: 1, finding_count: 1 });
    const [prepare, finalize, attest] = await Promise.all([
      readFile("scripts/prepare-final-artifact-review.mjs", "utf8"),
      readFile("scripts/finalize-final-artifact-review.mjs", "utf8"),
      readFile("scripts/record-youtube-upload-attestation.mjs", "utf8"),
    ]);
    expect(prepare).toContain("PENDING-INDEPENDENT-REVIEW");
    expect(prepare).toContain("loadAndValidateFinalEvidenceContext");
    expect(prepare).toContain('path: relativePath');
    expect(prepare).toContain("A distinct non-creator subagent must inspect every listed PNG");
    expect(finalize).toContain("validateFinalArtifactReview");
    expect(finalize).toContain("loadAndValidateFinalEvidenceContext");
    expect(finalize).toContain('args.get("--inspection-manifest")');
    expect(finalize).toContain("resolve(packetRoot, file.path)");
    expect(finalize).toContain("final-artifact-review-${sha256.slice(0, 16)}.json");
    expect(attest).toContain('--confirmed owner-observed');
    expect(attest).toContain('args.get("--demo-manifest")');
    expect(attest).toContain("youtube-upload-attestation-${sha256.slice(0, 16)}.json");
  });

  it("binds independent-agent artifact review and owner upload evidence to the release", () => {
    const timing = {
      now: Date.parse("2026-08-02T21:00:00+09:00"),
      releaseEpochSeconds: Date.parse("2026-08-02T19:00:00+09:00") / 1000,
      headEpochSeconds: Date.parse("2026-08-02T20:40:00+09:00") / 1000,
      browserCompletedAt: Date.parse("2026-08-02T19:31:00+09:00"),
      artifactReviewSha256,
      artifactReviewerTask: "/root/final_artifact_reviewer",
      artifactReviewedAt: Date.parse("2026-08-02T19:45:00+09:00"),
      youtubeUploadConfirmationSha256,
      youtubeUploader: "JunhyungKang",
      youtubeUploadedAt: Date.parse("2026-08-02T20:10:00+09:00"),
    };
    expect(validateFinalLedger(finalLedger(), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    })).toEqual([]);
    const mismatched = validateFinalLedger(finalLedger({ commit: "c".repeat(40) }), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(mismatched.some((error) => error.includes("SHA/commit cell must exactly match"))).toBe(true);
    const missingBrowser = validateFinalLedger(finalLedger().replace("final-browser-qa", "browser-note"), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(missingBrowser).toContain("submission ledger lacks a final-browser-qa row");
    const contradictory = validateFinalLedger(finalLedger().replace("browser-report PASS", "NOT browser-report PASS"), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(contradictory).toContain("final-browser-qa row Checks cell must exactly match the evidence contract");
    const duplicate = validateFinalLedger(`${finalLedger()}\n${finalLedger().split("\n")[0]}`, {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(duplicate).toContain("submission ledger contains duplicate final-browser-qa rows");
    const future = validateFinalLedger(finalLedger(), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256,
      now: Date.parse("2026-07-17T20:00:00+09:00"), releaseEpochSeconds: undefined, headEpochSeconds: undefined,
    });
    expect(future).toContain("final-browser-qa row timestamp is in the future");
    const unorderedLedger = finalLedger().replace("2026-08-02T20:20:00+09:00 | youtube-public", "2026-08-02T20:05:00+09:00 | youtube-public");
    const unordered = validateFinalLedger(unorderedLedger, {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(unordered).toContain("youtube-public row is out of evidence order");
    const wrongRole = validateFinalLedger(finalLedger().replace("role=independent-agent", "role=human"), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(wrongRole).toContain("final-browser-qa row Notes must bind role=independent-agent");
    const prematureLedger = validateFinalLedger(finalLedger(), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256,
      ...timing, browserCompletedAt: Date.parse("2026-08-02T20:01:00+09:00"),
    });
    expect(prematureLedger).toContain("final-browser-qa row must be timestamped after the browser report completed");
    const fakeReviewer = validateFinalLedger(finalLedger().replace("reviewer=/root/final_artifact_reviewer", "reviewer=agent"), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(fakeReviewer).toContain("final-browser-qa reviewer must identify the distinct /root/<task> independent agent");
    const mismatchedReviewer = validateFinalLedger(finalLedger().replaceAll(
      "reviewer=/root/final_artifact_reviewer", "reviewer=/root/other_reviewer",
    ), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(mismatchedReviewer).toContain("final-browser-qa reviewer must match the SHA-bound artifact review task");
    const unboundVideo = validateFinalLedger(finalLedger().replace(` video=${demoVideoSha256}`, ""), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(unboundVideo).toContain("youtube-public row SHA/commit cell must exactly match the evidence contract");
    const duplicateReviewer = validateFinalLedger(finalLedger().replace(
      "reviewer=/root/final_artifact_reviewer role=independent-agent",
      "reviewer=/root/final_artifact_reviewer role=independent-agent reviewer=/root/other",
    ), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(duplicateReviewer).toContain("final-browser-qa row Notes must use exact unique keys: reviewer role review Playwright");
    const duplicateSource = validateFinalLedger(finalLedger().replace(
      `source-url=${deployedUrl}`, `source-url=${deployedUrl} source-url=https://other.example/`,
    ), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(duplicateSource).toContain("youtube-public row Notes must use exact unique keys: reviewer role review source-url uploader confirmation");
    const fakeUploader = validateFinalLedger(finalLedger().replace("uploader=JunhyungKang", "uploader=agent"), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(fakeUploader).toContain("youtube-public uploader must match the content-addressed owner attestation");
    const weakConfirmation = validateFinalLedger(finalLedger().replace(`confirmation=${youtubeUploadConfirmationSha256}`, "confirmation=x"), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(weakConfirmation).toContain("youtube-public confirmation must match the content-addressed owner attestation SHA-256");
    const prematureReviewRow = validateFinalLedger(finalLedger(), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256,
      ...timing, artifactReviewedAt: Date.parse("2026-08-02T20:01:00+09:00"),
    });
    expect(prematureReviewRow).toContain("final-browser-qa row must be timestamped after the independent-agent artifact review");
    const extraCell = validateFinalLedger(finalLedger().replace(
      " Playwright=1.61.1 |", " Playwright=1.61.1 | EXTRA |",
    ), {
      deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, ...timing,
    });
    expect(extraCell).toContain("final-browser-qa row must contain exactly 7 cells");
  });

  it("validates optional/required owner receipts and exact final-demo release binding", async () => {
    const receipt = `| 2026-08-02T21:00:00+09:00 | final-submitted | DAKER-final-entry | commit=${commit} build=${buildSha256} | owner-confirmation PASS | submitted | owner=jhkang confirmation=DAKER-FINAL-123 |`;
    const ledger = `${finalLedger()}\n${receipt}`;
    const options = { commit, buildSha256, now: Date.parse("2026-08-02T22:00:00+09:00") };
    expect(validateFinalSubmissionReceipt(finalLedger(), options)).toEqual([]);
    expect(validateFinalSubmissionReceipt(finalLedger(), { ...options, required: true }))
      .toContain("submission ledger lacks a required final-submitted row");
    expect(validateFinalSubmissionReceipt(ledger, options)).toEqual([]);
    expect(validateFinalSubmissionReceipt(ledger.replace("DAKER-FINAL-123", "N/A"), options))
      .toContain("final-submitted row contains a forbidden non-pass token");
    expect(validateFinalSubmissionReceipt(ledger.replace("owner=jhkang", "owner=agent"), options))
      .toContain("final-submitted owner must be a real owner identity, not a placeholder");
    expect(validateFinalSubmissionReceipt(receipt.replace(" | submitted |", " |"), options))
      .toContain("final-submitted row must contain exactly 7 cells");
    expect(validateFinalSubmissionReceipt(`${ledger}\n${receipt}`, options))
      .toContain("submission ledger contains duplicate final-submitted rows");
    expect(validateFinalSubmissionReceipt(ledger.replace("DAKER-FINAL-123", "x"), options))
      .toContain("final-submitted confirmation must be an official ID, HTTPS URL, or screenshot SHA-256");
    expect(validateFinalSubmissionReceipt(ledger, {
      ...options, headEpochSeconds: Date.parse("2026-08-02T20:50:00+09:00") / 1000,
    })).toContain("final-submitted row is later than final HEAD");
    const calls = [];
    const runner = (...args) => { calls.push(args); return { status: 0 }; };
    expect(() => runReleaseVerification({ cwd: "/release", npmExecPath: "/tools/pnpm.cjs", runner })).not.toThrow();
    expect(calls).toEqual([[process.execPath, ["/tools/pnpm.cjs", "verify"], { cwd: "/release", stdio: "inherit" }]]);
    expect(() => runReleaseVerification({ npmExecPath: "/tools/pnpm/11.9.0/bin/pnpm.cjs", runner })).not.toThrow();
    expect(() => runReleaseVerification({ npmExecPath: "", runner })).toThrow(/launched through pnpm/u);
    expect(() => runReleaseVerification({ npmExecPath: "/tools/npm-cli.js", runner })).toThrow(/launched through pnpm/u);
    expect(() => runReleaseVerification({ npmExecPath: "/tools/pnpm.cjs", runner: () => ({ status: 1 }) }))
      .toThrow(/failed pnpm verify/u);

    const markerSha256 = "f".repeat(64);
    const storySha256 = "1".repeat(64);
    const visualVideoBytes = Buffer.from("frozen public visual bytes");
    const coldOpenBytes = Buffer.from("release-bound gallery image");
    const coldOpenSha256 = createHash("sha256").update(coldOpenBytes).digest("hex");
    const visual = {
      status: "frozen-public-visual-candidate-not-youtube-or-human-reviewed",
      base_url: deployedUrl,
      release: { release_commit: commit, build_sha256: buildSha256, deployed_marker_sha256: markerSha256, deployment_parity: "PASS" },
      cold_open: { path: "docs/assets/gallery/corner-war-room-first-image.png", sha256: coldOpenSha256, duration_seconds: 5 },
      capture_started_at: "2026-08-02T10:01:00.000Z", capture_completed_at: "2026-08-02T10:02:00.000Z",
      video: { path: "submissions/final-demo-visual.webm", sha256: createHash("sha256").update(visualVideoBytes).digest("hex"), bytes: visualVideoBytes.length },
    };
    const visualBytes = Buffer.from(JSON.stringify(visual));
    const visualManifestSha256 = createHash("sha256").update(visualBytes).digest("hex");
    const demoManifest = {
      schema_version: 1,
      status: "final-upload-candidate-not-youtube-or-human-reviewed",
      submission_story_sha256: storySha256,
      source: {
        deployed_url: deployedUrl, release_commit: commit, build_sha256: buildSha256,
        deployed_marker_sha256: markerSha256,
        capture_started_at: "2026-08-02T10:01:00.000Z", capture_completed_at: "2026-08-02T10:02:00.000Z",
        cold_open: visual.cold_open,
      },
      visual_source: { manifest_path: "submissions/final-demo-visual.json", manifest_sha256: visualManifestSha256, sha256: visual.video.sha256 },
      narrated_video: { path: "submissions/final-demo.webm", sha256: demoVideoSha256, bytes: 200_000 },
    };
    const files = new Map([
      ["submissions/final-demo-visual.json", visualBytes],
      [visual.video.path, visualVideoBytes],
      [visual.cold_open.path, coldOpenBytes],
    ]);
    const demoOptions = {
      deployedUrl, commit, buildSha256, demoVideoPath: demoManifest.narrated_video.path,
      demoVideoSha256, storySha256, markerSha256,
      markerBuiltAt: Date.parse("2026-08-02T10:00:00.000Z"), now: Date.parse("2026-08-02T10:03:00.000Z"),
      read: async (path) => { if (!files.has(path)) throw new Error(`missing ${path}`); return files.get(path); },
    };
    expect(await validateFinalDemoManifest(demoManifest, demoOptions)).toEqual([]);
    expect(await validateFinalDemoManifest({ ...demoManifest, source: { ...demoManifest.source, deployed_url: "https://other.example/" } }, demoOptions))
      .toContain("final demo manifest deployed URL mismatch");
    expect(await validateFinalDemoManifest({ ...demoManifest, narrated_video: { ...demoManifest.narrated_video, sha256: "3".repeat(64) } }, demoOptions))
      .toContain("final demo manifest video SHA does not match exact uploaded bytes");
    const corruptedVisualFiles = new Map(files);
    corruptedVisualFiles.set(visual.video.path, Buffer.from("corrupted frozen public visual bytes"));
    expect(await validateFinalDemoManifest(demoManifest, {
      ...demoOptions,
      read: async (path) => { if (!corruptedVisualFiles.has(path)) throw new Error(`missing ${path}`); return corruptedVisualFiles.get(path); },
    })).toContain("final demo visual video byte binding mismatch");
    expect(await validateFinalDemoManifest({
      ...demoManifest,
      source: { ...demoManifest.source, capture_completed_at: "2026-08-02T10:02:01.000Z" },
    }, demoOptions)).toContain("final demo visual capture timestamps drift from the upload manifest");
  });

  it("requires a bound, all-project Playwright JSON report with named acceptance tests", () => {
    const project = (name) => ({ name, metadata: { baseURL: deployedUrl, releaseCommit: commit, buildSha256, testSourceSha256 } });
    const passing = (title) => ({
      title,
      tests: ["chromium", "webkit", "firefox", "mobile"].map((projectName) => ({
        projectName, status: "expected", results: [{ status: "passed" }],
      })),
    });
    const report = {
      config: {
        metadata: { deployedUrl, releaseCommit: commit, buildSha256, testSourceSha256 },
        projects: ["chromium", "webkit", "firefox", "mobile"].map(project),
        rootDir: "/workspace/tests/final-e2e",
      },
      suites: [{ file: "final-manager-loop.spec.ts", specs: REQUIRED_BROWSER_GATE_TITLES.map((title) => passing(`${title} contract`)) }],
      errors: [],
      stats: { expected: 60, skipped: 0, unexpected: 0, flaky: 0, startTime: "2026-08-02T10:30:00.000Z", duration: 1_000 },
    };
    const expected = {
      deployedUrl, releaseCommit: commit, buildSha256, testSourceSha256,
      now: Date.parse("2026-08-02T21:00:00+09:00"), earliestEvidenceMs: Date.parse("2026-08-02T19:00:00+09:00"),
    };
    expect(validateBrowserReport(report, expected)).toEqual([]);
    report.config.projects = report.config.projects.filter(({ name }) => name !== "webkit");
    expect(validateBrowserReport(report, expected)).toContain(
      "Playwright report lacks project webkit",
    );
    report.config.projects.push(project("webkit"));
    report.suites[0].specs = report.suites[0].specs.filter(({ title }) => !title.startsWith("BG-15 "));
    expect(validateBrowserReport(report, expected)).toContain("Playwright report lacks required gate 'BG-15' for chromium");
  });

  it("rejects late commits and requires a pre-deadline freeze after cutoff", () => {
    const before = Date.parse("2026-08-03T09:00:00+09:00") / 1000;
    const after = Date.parse("2026-08-03T10:01:00+09:00");
    expect(validateDeadline({ now: after, commitEpochSeconds: before, frozenAt: "2026-08-03T09:30:00+09:00" })).toEqual([]);
    expect(validateDeadline({ now: after, commitEpochSeconds: before })).toContain(
      "post-deadline verification requires a recorded pre-deadline final freeze",
    );
    expect(validateDeadline({ now: before * 1000, commitEpochSeconds: after / 1000, frozenAt: undefined })).toContain(
      "latest commit is after the final submission deadline",
    );
  });
});
