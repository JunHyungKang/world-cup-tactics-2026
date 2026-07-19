import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { readFile, readdir, stat } from "node:fs/promises";
import { isIP } from "node:net";
import { join } from "node:path";

export const FINAL_DEADLINE = "2026-08-03T10:00:00+09:00";

export function runReleaseVerification({
  cwd = process.cwd(),
  npmExecPath = process.env.npm_execpath,
  runner = spawnSync,
} = {}) {
  if (!npmExecPath || !/(?:^|[/\\])pnpm(?:[/\\]|\.c?js$|$)/iu.test(npmExecPath)) {
    throw new Error("release build must be launched through pnpm so exact-commit verification is available");
  }
  const result = runner(process.execPath, [npmExecPath, "verify"], { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`exact release commit failed pnpm verify (exit ${result.status ?? "unknown"})`);
}

export function assertSnapshotSourceEntry(path, stats) {
  if (stats.isSymbolicLink()) throw new Error(`clean-clone snapshot refuses symbolic link source: ${path}`);
  if (!stats.isFile()) throw new Error(`clean-clone snapshot requires a regular file source: ${path}`);
}
const FINAL_DEADLINE_MS = Date.parse(FINAL_DEADLINE);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const KST_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/u;
export const REQUIRED_BROWSER_GATE_TITLES = Array.from({ length: 15 }, (_, index) =>
  `BG-${String(index + 1).padStart(2, "0")}`);
export const FINAL_EVIDENCE_SOURCE_PATHS = [
  "playwright.final.config.ts",
  "tests/final-e2e/final-manager-loop.spec.ts",
  "vite.invalid-artifact.config.ts",
  "scripts/serve-invalid-fixture.mjs",
  "tests/fixtures/invalid-corner-scenarios.json",
];

export async function computeWorktreeEvidenceDigest({ cwd = process.cwd(), execFile = execFileSync, read = readFile } = {}) {
  const output = execFile("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd, encoding: "buffer" });
  const paths = output.toString("utf8").split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(path); hash.update("\0");
    try { hash.update(await read(join(cwd, path))); }
    catch { hash.update("MISSING"); }
    hash.update("\0");
  }
  return { sha256: hash.digest("hex"), fileCount: paths.length, paths };
}

export async function validateFinalDemoManifest(manifest, {
  deployedUrl,
  commit,
  buildSha256,
  demoVideoPath,
  demoVideoSha256,
  storySha256,
  markerSha256,
  markerBuiltAt,
  now = Date.now(),
  read = readFile,
} = {}) {
  const errors = [];
  const safePath = (path) => typeof path === "string" && path.length > 0 && !path.startsWith("/") &&
    !path.split(/[\\/]/u).includes("..");
  if (manifest?.schema_version !== 1 || manifest?.status !== "final-upload-candidate-not-youtube-or-human-reviewed") {
    errors.push("final demo manifest status is not an upload candidate with human/YouTube review pending");
  }
  if (manifest?.submission_story_sha256 !== storySha256) errors.push("final demo manifest story SHA mismatch");
  if (manifest?.source?.deployed_url !== deployedUrl) errors.push("final demo manifest deployed URL mismatch");
  if (manifest?.source?.release_commit !== commit) errors.push("final demo manifest release commit mismatch");
  if (manifest?.source?.build_sha256 !== buildSha256) errors.push("final demo manifest build digest mismatch");
  if (manifest?.source?.deployed_marker_sha256 !== markerSha256) errors.push("final demo manifest deployed marker SHA mismatch");
  if (manifest?.narrated_video?.path !== demoVideoPath) errors.push("final demo manifest video path does not match --demo-video");
  if (manifest?.narrated_video?.sha256 !== demoVideoSha256) errors.push("final demo manifest video SHA does not match exact uploaded bytes");
  if (!Number.isInteger(manifest?.narrated_video?.bytes) || manifest.narrated_video.bytes < 100_000) {
    errors.push("final demo manifest video byte length is invalid");
  }
  const started = Date.parse(manifest?.source?.capture_started_at);
  const completed = Date.parse(manifest?.source?.capture_completed_at);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started || completed > now ||
      (Number.isFinite(markerBuiltAt) && started < markerBuiltAt)) {
    errors.push("final demo capture timestamps do not follow the stamped release build");
  }
  const visualManifestPath = manifest?.visual_source?.manifest_path;
  if (!safePath(visualManifestPath)) {
    errors.push("final demo visual manifest path is unsafe");
    return errors;
  }
  try {
    const visualBytes = await read(visualManifestPath);
    const visualSha = createHash("sha256").update(visualBytes).digest("hex");
    if (visualSha !== manifest.visual_source.manifest_sha256) errors.push("final demo visual manifest SHA mismatch");
    const visual = JSON.parse(visualBytes.toString("utf8"));
    if (visual.status !== "frozen-public-visual-candidate-not-youtube-or-human-reviewed") errors.push("final demo visual status is not frozen-public");
    if (visual.base_url !== deployedUrl) errors.push("final demo visual deployed URL mismatch");
    if (visual.release?.release_commit !== commit || visual.release?.build_sha256 !== buildSha256) {
      errors.push("final demo visual release/build binding mismatch");
    }
    if (visual.release?.deployed_marker_sha256 !== markerSha256 || visual.release?.deployment_parity !== "PASS") {
      errors.push("final demo visual deployment marker/parity mismatch");
    }
    if (visual.capture_started_at !== manifest.source?.capture_started_at ||
        visual.capture_completed_at !== manifest.source?.capture_completed_at) {
      errors.push("final demo visual capture timestamps drift from the upload manifest");
    }
    const visualStarted = Date.parse(visual.capture_started_at);
    const visualCompleted = Date.parse(visual.capture_completed_at);
    if (!Number.isFinite(visualStarted) || !Number.isFinite(visualCompleted) || visualCompleted < visualStarted ||
        visualCompleted > now || (Number.isFinite(markerBuiltAt) && visualStarted < markerBuiltAt)) {
      errors.push("final demo visual capture timestamps do not follow the stamped release build");
    }
    const visualVideoPath = visual.video?.path;
    if (!safePath(visualVideoPath)) errors.push("final demo visual video path is unsafe");
    else {
      const visualVideoBytes = await read(visualVideoPath);
      if (createHash("sha256").update(visualVideoBytes).digest("hex") !== visual.video.sha256 ||
          visualVideoBytes.length !== visual.video.bytes) {
        errors.push("final demo visual video byte binding mismatch");
      }
    }
    if (visual.video?.sha256 !== manifest.visual_source.sha256) errors.push("final demo narrated visual source SHA mismatch");
    if (JSON.stringify(visual.cold_open) !== JSON.stringify(manifest.source?.cold_open)) errors.push("final demo cold-open binding mismatch");
    const coldOpenPath = visual.cold_open?.path;
    if (!safePath(coldOpenPath)) errors.push("final demo cold-open path is unsafe");
    else {
      const coldOpenBytes = await read(coldOpenPath);
      if (createHash("sha256").update(coldOpenBytes).digest("hex") !== visual.cold_open.sha256) {
        errors.push("final demo cold-open SHA mismatch");
      }
    }
  } catch (error) {
    errors.push(`final demo visual evidence is unavailable: ${error.message}`);
  }
  return errors;
}

export async function validateFinalEvidenceContext({
  browserReport, demoManifest, deployedUrl, releaseCommit, buildSha256, testSourceSha256,
  demoVideoPath, demoVideoSha256, storySha256, markerSha256, markerBuiltAt,
  releaseEpochSeconds, now = Date.now(), read = readFile,
}) {
  const browserErrors = validateBrowserReport(browserReport, {
    deployedUrl, releaseCommit, buildSha256, testSourceSha256, now,
    earliestEvidenceMs: Math.max((releaseEpochSeconds ?? 0) * 1000, markerBuiltAt ?? 0),
  });
  const demoErrors = await validateFinalDemoManifest(demoManifest, {
    deployedUrl, commit: releaseCommit, buildSha256, demoVideoPath, demoVideoSha256,
    storySha256, markerSha256, markerBuiltAt, now, read,
  });
  if (browserReport?.config?.metadata?.deployedUrl !== demoManifest?.source?.deployed_url) {
    demoErrors.push("browser and demo deployed URLs do not match");
  }
  return [...browserErrors, ...demoErrors];
}

export function validatePostReleaseHistory(commits, {
  allowedPaths = ["docs/submission-ledger.md"], deadlineMs = FINAL_DEADLINE_MS,
} = {}) {
  const errors = [];
  for (const commit of commits) {
    if (!COMMIT.test(commit.sha ?? "")) errors.push("post-release history contains an invalid commit SHA");
    if (!Number.isFinite(commit.timestampMs) || commit.timestampMs > deadlineMs) {
      errors.push(`post-release commit ${commit.sha ?? "unknown"} is after the submission deadline`);
    }
    const paths = [...new Set(commit.paths ?? [])];
    if (!paths.length) errors.push(`post-release commit ${commit.sha ?? "unknown"} has no inspectable changed paths`);
    for (const path of paths) {
      if (!allowedPaths.includes(path)) errors.push(`post-release commit ${commit.sha ?? "unknown"} changed forbidden path: ${path}`);
    }
  }
  return errors;
}

function secureUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  if (url.username || url.password) throw new Error(`${label} must not contain credentials`);
  return url;
}

function assertPublicHostname(url, label) {
  const hostname = url.hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (["localhost", "localhost.localdomain"].includes(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error(`${label} must use a public hostname`);
  }
  const ipVersion = isIP(hostname);
  if (!ipVersion && !hostname.includes(".")) throw new Error(`${label} must use a public hostname`);
  if (ipVersion === 4) {
    const octets = hostname.split(".").map(Number);
    const privateIp = octets[0] === 0 || octets[0] === 10 || octets[0] === 127 ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
      (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) || (octets[0] === 198 && [18, 19].includes(octets[1])) || octets[0] >= 224;
    if (privateIp) throw new Error(`${label} must not use a private, loopback, or reserved IP address`);
  }
  if (ipVersion === 6 && (/^(?:::|::1)$/u.test(hostname) || /^(?:fc|fd|fe[89ab])/u.test(hostname))) {
    throw new Error(`${label} must not use a private, loopback, or link-local IP address`);
  }
}

async function assertPublicDns(url, lookupImpl) {
  const hostname = url.hostname.replace(/^\[|\]$/gu, "");
  if (isIP(hostname)) return;
  const answers = await lookupImpl(hostname, { all: true, verbatim: true });
  if (!answers.length) throw new Error("Deployment hostname has no DNS answer");
  for (const answer of answers) {
    const host = answer.family === 6 ? `[${answer.address}]` : answer.address;
    assertPublicHostname(new URL(`https://${host}/`), "Deployment DNS answer");
  }
}

export function parseGitHubRepoUrl(value) {
  const url = secureUrl(value, "GitHub repository URL");
  if (url.hostname !== "github.com" || url.search || url.hash) {
    throw new Error("GitHub URL must be the canonical github.com repository URL");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_.-]+$/u.test(part))) {
    throw new Error("GitHub URL must be exactly https://github.com/<owner>/<repo>");
  }
  return { url: `https://github.com/${parts[0]}/${parts[1]}`, owner: parts[0], repo: parts[1] };
}

export function parseYouTubeVideoUrl(value) {
  const url = secureUrl(value, "YouTube video URL");
  let videoId;
  if (["youtube.com", "www.youtube.com"].includes(url.hostname)) {
    if (url.pathname !== "/watch" || url.hash) throw new Error("YouTube URL must be a watch or youtu.be video URL");
    videoId = url.searchParams.get("v");
    if ([...url.searchParams.keys()].some((key) => key !== "v")) {
      throw new Error("YouTube watch URL must not contain tracking or playlist parameters");
    }
  } else if (url.hostname === "youtu.be") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1 || url.search || url.hash) throw new Error("youtu.be URL must contain only the video ID");
    [videoId] = parts;
  } else {
    throw new Error("YouTube URL must use youtube.com or youtu.be");
  }
  if (!VIDEO_ID.test(videoId ?? "")) throw new Error("YouTube URL has an invalid video ID");
  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}

export function parseDeploymentUrl(value) {
  const url = secureUrl(value, "Deployment URL");
  assertPublicHostname(url, "Deployment URL");
  if (url.hash) throw new Error("Deployment URL must not contain a fragment");
  if (url.search) throw new Error("Deployment URL must not depend on query credentials or parameters");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

async function fetchResponse(fetchImpl, url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeDeployment(value, fetchImpl = fetch, expectedBuild, lookupImpl = lookup) {
  const url = parseDeploymentUrl(value);
  if (expectedBuild) await assertPublicDns(new URL(url), lookupImpl);
  const response = await fetchResponse(fetchImpl, url, { redirect: "follow" });
  const errors = [];
  if (!response.ok) errors.push(`deployment returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) errors.push(`deployment content type is not HTML: ${contentType || "missing"}`);
  let finalUrl = response.url || url;
  let deploymentRoot = new URL(url);
  try {
    const parsedFinalUrl = secureUrl(finalUrl, "Final deployment URL");
    assertPublicHostname(parsedFinalUrl, "Final deployment URL");
    if (expectedBuild) await assertPublicDns(parsedFinalUrl, lookupImpl);
    if (!parsedFinalUrl.pathname.endsWith("/")) parsedFinalUrl.pathname += "/";
    finalUrl = parsedFinalUrl.toString();
    deploymentRoot = parsedFinalUrl;
  } catch (error) {
    errors.push(error.message);
  }
  if (/\/(?:login|signin|sign-in|auth)(?:\/|\?|$)/iu.test(new URL(finalUrl).pathname)) {
    errors.push("deployment redirects to an authentication route");
  }
  const body = await response.text();
  if (!body.trim()) errors.push("deployment returned an empty HTML body");
  const gatePatterns = [
    /<input\b[^>]*\btype\s*=\s*["']password["']/iu,
    /<(?:input|textarea)\b[^>]*(?:api[_ -]?key|api키|API 키)[^>]*>/iu,
    /(?:enter|provide|paste|입력).{0,40}(?:api[_ -]?key|API 키)/iu,
  ];
  if (gatePatterns.some((pattern) => pattern.test(body))) errors.push("deployment HTML appears to require a password or API key");
  let deployedBuild;
  let deployedBuildBytes;
  if (expectedBuild) {
    const markerUrl = new URL("submission-build.json", deploymentRoot).toString();
    const markerResponse = await fetchResponse(fetchImpl, markerUrl, { cache: "no-store" });
    if (!markerResponse.ok) errors.push(`deployed build marker returned HTTP ${markerResponse.status}`);
    try {
      deployedBuildBytes = Buffer.from(await markerResponse.arrayBuffer());
      deployedBuild = JSON.parse(deployedBuildBytes.toString("utf8"));
    } catch { errors.push("deployed build marker did not return JSON"); }
    if (deployedBuild?.releaseCommit !== expectedBuild.releaseCommit) errors.push("deployed build marker release commit does not match");
    if (deployedBuild?.buildSha256 !== expectedBuild.buildSha256) errors.push("deployed build marker digest does not match local release build");
    if (JSON.stringify(deployedBuild) !== JSON.stringify(expectedBuild)) errors.push("deployed build marker does not exactly match the local release marker");
    const expectedMarkerBytes = Buffer.from(`${JSON.stringify(expectedBuild, null, 2)}\n`);
    if (!deployedBuildBytes?.equals(expectedMarkerBytes)) errors.push("deployed build marker bytes do not exactly match the local release marker");
    const fileManifestMatches = JSON.stringify(deployedBuild?.files) === JSON.stringify(expectedBuild.files);
    if (!fileManifestMatches) errors.push("deployed build marker file manifest does not match local release build");
    if (fileManifestMatches && Array.isArray(expectedBuild.files)) {
      for (const file of expectedBuild.files) {
        if (!/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u.test(file.path)) {
          errors.push(`build manifest contains unsafe path ${file.path}`);
          continue;
        }
        const assetResponse = await fetchResponse(fetchImpl, new URL(file.path, deploymentRoot), { cache: "no-store" });
        if (!assetResponse.ok) {
          errors.push(`deployed build file ${file.path} returned HTTP ${assetResponse.status}`);
          continue;
        }
        const bytes = Buffer.from(await assetResponse.arrayBuffer());
        const digest = createHash("sha256").update(bytes).digest("hex");
        if (bytes.length !== file.bytes || digest !== file.sha256) errors.push(`deployed build file ${file.path} does not match release bytes`);
      }
    }
  }
  return { errors, finalUrl, status: response.status, contentType, bodyBytes: Buffer.byteLength(body), deployedBuild, deployedBuildBytes };
}

export async function probeGitHubPublic(value, fetchImpl = fetch, releaseCommit, evidenceHeadCommit) {
  const repository = parseGitHubRepoUrl(value);
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`;
  const response = await fetchResponse(fetchImpl, apiUrl, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "world-cup-tactics-submission-preflight" },
  });
  const errors = [];
  if (!response.ok) errors.push(`GitHub API returned HTTP ${response.status}`);
  let metadata = {};
  try { metadata = await response.json(); } catch { errors.push("GitHub API did not return JSON"); }
  if (response.ok && metadata.private !== false) errors.push("GitHub repository is not confirmed public");
  if (metadata.archived === true) errors.push("GitHub repository is archived");
  if (metadata.disabled === true) errors.push("GitHub repository is disabled");
  let commitApiUrl;
  if (releaseCommit) {
    commitApiUrl = `${apiUrl}/commits/${encodeURIComponent(releaseCommit)}`;
    const commitResponse = await fetchResponse(fetchImpl, commitApiUrl, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "world-cup-tactics-submission-preflight" },
    });
    if (!commitResponse.ok) errors.push(`release commit is not public through the GitHub API: HTTP ${commitResponse.status}`);
    if (commitResponse.ok) {
      try {
        const commitMetadata = await commitResponse.json();
        if (commitMetadata.sha !== releaseCommit) errors.push("GitHub API did not resolve the exact release commit");
      } catch {
        errors.push("GitHub release commit response did not return JSON");
      }
      const requiredPaths = ["README.md", "package.json", "src"];
      for (const path of requiredPaths) {
        const contentsUrl = `${apiUrl}/contents/${path}?ref=${encodeURIComponent(releaseCommit)}`;
        const contentsResponse = await fetchResponse(fetchImpl, contentsUrl, {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "world-cup-tactics-submission-preflight" },
        });
        if (!contentsResponse.ok) {
          errors.push(`release commit lacks public required path ${path}: HTTP ${contentsResponse.status}`);
          continue;
        }
        try {
          const content = await contentsResponse.json();
          if (path === "README.md") {
            const readme = Buffer.from(content.content ?? "", content.encoding === "base64" ? "base64" : "utf8").toString("utf8");
            const readmeRequirements = [/## Local setup/iu, /## (?:Tech stack|Technology)/iu, /pnpm install/iu, /pnpm (?:dev|preview)/iu, /React/iu];
            if (readmeRequirements.some((pattern) => !pattern.test(readme))) {
              errors.push("release README lacks setup commands or technology disclosure");
            }
          } else if (path === "package.json" && (Array.isArray(content) || content.type !== "file")) {
            errors.push("release package.json is not a public file");
          } else if (path === "src" && (!Array.isArray(content) || content.length === 0)) {
            errors.push("release src path is not a nonempty public directory");
          }
        } catch {
          if (path === "README.md") {
            errors.push("release README contents could not be decoded");
          } else {
            errors.push(`release required path ${path} response did not return JSON`);
          }
        }
      }
    }
  }
  let evidenceHeadApiUrl;
  if (evidenceHeadCommit) {
    if (!COMMIT.test(evidenceHeadCommit)) {
      errors.push("evidence HEAD must be a full 40-character Git SHA");
    } else if (typeof metadata.default_branch !== "string" || !metadata.default_branch) {
      errors.push("GitHub repository metadata lacks a default branch for evidence HEAD verification");
    } else {
      evidenceHeadApiUrl = `${apiUrl}/commits/${encodeURIComponent(metadata.default_branch)}`;
      const headResponse = await fetchResponse(fetchImpl, evidenceHeadApiUrl, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "world-cup-tactics-submission-preflight" },
      });
      if (!headResponse.ok) errors.push(`public default-branch HEAD is unavailable through the GitHub API: HTTP ${headResponse.status}`);
      else {
        try {
          const headMetadata = await headResponse.json();
          if (headMetadata.sha !== evidenceHeadCommit) errors.push("public default-branch HEAD does not match the exact local evidence HEAD");
        } catch {
          errors.push("GitHub evidence HEAD response did not return JSON");
        }
      }
    }
  }
  return { errors, apiUrl, commitApiUrl, evidenceHeadApiUrl, repository, metadata };
}

export async function computeBuildDigest(directory, { excluded = ["submission-build.json"] } = {}) {
  async function collect(current, prefix = "") {
    const entries = await readdir(current, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const relative = join(prefix, entry.name);
      const path = join(current, entry.name);
      if (entry.isDirectory()) files.push(...await collect(path, relative));
      else if (!excluded.includes(relative)) files.push({ path, relative });
    }
    return files;
  }
  const files = (await collect(directory)).sort((left, right) => left.relative.localeCompare(right.relative));
  if (!files.length) throw new Error(`${directory} has no build files`);
  const hash = createHash("sha256");
  const manifest = [];
  for (const file of files) {
    const bytes = await readFile(file.path);
    hash.update(file.relative); hash.update("\0"); hash.update(bytes); hash.update("\0");
    manifest.push({ path: file.relative, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  return { buildSha256: hash.digest("hex"), fileCount: files.length, files: manifest };
}

export async function auditStaticBuild(directory) {
  const errors = [];
  let html = "";
  try {
    html = await readFile(join(directory, "index.html"), "utf8");
  } catch (error) {
    return { errors: [`static build lacks readable index.html: ${error.message}`], references: [] };
  }

  const references = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/giu)]
    .map((match) => match[1]);
  if (!references.some((value) => /\.js(?:[?#]|$)/iu.test(value))) errors.push("index.html lacks a JavaScript entry reference");
  if (!references.some((value) => /\.css(?:[?#]|$)/iu.test(value))) errors.push("index.html lacks a stylesheet reference");

  for (const reference of references) {
    if (/^(?:https?:)?\/\//iu.test(reference)) {
      errors.push(`static entry depends on an external script or stylesheet: ${reference}`);
      continue;
    }
    if (/^(?:data|blob):/iu.test(reference)) continue;
    if (reference.startsWith("/")) {
      errors.push(`static asset reference must be relative for subpath hosting: ${reference}`);
      continue;
    }
    const pathOnly = reference.split(/[?#]/u, 1)[0].replace(/^\.\//u, "");
    let decoded;
    try { decoded = decodeURIComponent(pathOnly); } catch { errors.push(`static asset reference is not valid URI text: ${reference}`); continue; }
    if (!decoded || decoded.includes("\\") || decoded.split("/").includes("..")) {
      errors.push(`static asset reference is unsafe: ${reference}`);
      continue;
    }
    try {
      const info = await stat(join(directory, decoded));
      if (!info.isFile() || info.size === 0) errors.push(`static asset is missing or empty: ${reference}`);
    } catch {
      errors.push(`static asset does not resolve inside the build: ${reference}`);
    }
  }

  if (/<input\b[^>]*\btype\s*=\s*["']password["']/iu.test(html)) errors.push("static entry contains a password gate");
  if (/(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|VITE_[A-Z0-9_]*(?:API_?KEY|SECRET))/u.test(html)) {
    errors.push("static entry references a runtime API key or secret");
  }
  return { errors, references };
}

export async function computeEvidenceSourceDigest(paths) {
  const hash = createHash("sha256");
  for (const path of [...paths].sort()) {
    hash.update(path); hash.update("\0"); hash.update(await readFile(path)); hash.update("\0");
  }
  return hash.digest("hex");
}

function collectReportTests(suites, output = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) output.push({ title: spec.title, ...test });
    collectReportTests(suite.suites, output);
  }
  return output;
}

export function validateBrowserReport(report, {
  deployedUrl, releaseCommit, buildSha256, testSourceSha256, now = Date.now(), earliestEvidenceMs = 0,
}) {
  const errors = [];
  const metadata = report?.config?.metadata ?? {};
  if (metadata.deployedUrl !== deployedUrl || metadata.releaseCommit !== releaseCommit || metadata.buildSha256 !== buildSha256 ||
      metadata.testSourceSha256 !== testSourceSha256) {
    errors.push("Playwright report metadata is not bound to deployment, release commit, build digest, and test source");
  }
  const requiredProjects = ["chromium", "webkit", "firefox", "mobile"];
  const projects = report?.config?.projects ?? [];
  for (const name of requiredProjects) {
    const project = projects.find((candidate) => candidate.name === name);
    if (!project) errors.push(`Playwright report lacks project ${name}`);
    else if (project.metadata?.baseURL !== deployedUrl || project.metadata?.releaseCommit !== releaseCommit ||
      project.metadata?.buildSha256 !== buildSha256 || project.metadata?.testSourceSha256 !== testSourceSha256) {
      errors.push(`Playwright project ${name} metadata is not bound to the public release`);
    }
  }
  const tests = collectReportTests(report?.suites);
  if (!tests.length) errors.push("Playwright report contains no tests");
  if ((report?.errors ?? []).length) errors.push("Playwright report contains top-level errors");
  const stats = report?.stats ?? {};
  if (!(stats.expected > 0) || stats.expected !== tests.length || stats.skipped !== 0 || stats.unexpected !== 0 || stats.flaky !== 0) {
    errors.push("Playwright report stats are not an all-expected zero-skip result");
  }
  const startTime = Date.parse(stats.startTime);
  const completedAt = startTime + stats.duration;
  if (!Number.isFinite(startTime) || !Number.isFinite(stats.duration) || stats.duration < 0 ||
      completedAt > now || startTime < earliestEvidenceMs) {
    errors.push("Playwright report start time is outside the valid release evidence window");
  }
  if (!/[/\\]tests[/\\]final-e2e$/u.test(report?.config?.rootDir ?? "")) {
    errors.push("Playwright report rootDir is not tests/final-e2e");
  }
  const suiteFiles = [];
  const collectSuiteFiles = (suites) => {
    for (const suite of suites ?? []) {
      if (suite.file) suiteFiles.push(suite.file);
      collectSuiteFiles(suite.suites);
    }
  };
  collectSuiteFiles(report?.suites);
  if (!suiteFiles.some((file) => /final-manager-loop\.spec\.ts$/u.test(file))) {
    errors.push("Playwright report does not contain the required final browser spec file");
  }
  for (const test of tests) {
    if (test.status !== "expected" || !test.results?.length || test.results.some((result) => result.status !== "passed")) {
      errors.push(`Playwright test did not pass cleanly: ${test.title ?? "untitled"}`);
    }
  }
  for (const projectName of requiredProjects) {
    if (!tests.some((test) => test.projectName === projectName)) errors.push(`Playwright report contains no executed tests for ${projectName}`);
  }
  for (const requiredTitlePrefix of REQUIRED_BROWSER_GATE_TITLES) {
    for (const projectName of requiredProjects) {
      if (!tests.some((test) => test.title.startsWith(`${requiredTitlePrefix} `) && test.projectName === projectName)) {
        errors.push(`Playwright report lacks required gate '${requiredTitlePrefix}' for ${projectName}`);
      }
    }
  }
  return errors;
}

export async function probeYouTubePublic(value, fetchImpl = fetch) {
  const video = parseYouTubeVideoUrl(value);
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(video.url)}&format=json`;
  const response = await fetchResponse(fetchImpl, endpoint);
  const errors = [];
  if (!response.ok) errors.push(`YouTube oEmbed returned HTTP ${response.status}`);
  let metadata = {};
  try { metadata = await response.json(); } catch { errors.push("YouTube oEmbed did not return JSON"); }
  if (response.ok && (!metadata.title || metadata.provider_name !== "YouTube")) {
    errors.push("YouTube oEmbed response lacks public video metadata");
  }
  return { errors, endpoint, video, metadata };
}

function parseRows(ledger) {
  const rows = new Map();
  const duplicates = [];
  for (const line of ledger.split(/\r?\n/u)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/gu, ""));
    if (cells.length >= 7) {
      if (rows.has(cells[1])) duplicates.push(cells[1]);
      rows.set(cells[1], { line, cells, timestamp: cells[0] });
    }
  }
  return { rows, duplicates };
}

export function getFinalFreezeTimestamp(ledger) {
  return parseRows(ledger).rows.get("final-freeze")?.timestamp;
}

const FINAL_ARTIFACT_REVIEW_SCOPE =
  "independent-agent-final-artifact-qa-not-human-accessibility-usability-preference-memorability-evidence";
const FINAL_BROWSER_REVIEW_CRITERIA = [
  "visual_hierarchy", "manager_loop", "claim_boundaries", "no_login_key", "major_browser_report",
];
const FINAL_DEMO_REVIEW_CRITERIA = [
  "cold_open", "direct_manipulation", "pitch_replays", "counterexample_receipt", "audio_captions", "claim_boundaries",
];
const FINAL_BROWSER_SCREENSHOT_NAMES = ["artifact-initial", "artifact-selected", "artifact-counterexample"];
const FINAL_DEMO_FRAME_TIMES = [2, 8, 18, 29, 35, 45, 58];

export function buildFinalArtifactReviewTemplate({
  deployedUrl, youtubeUrl, commit, buildSha256, browserReportSha256, testSourceSha256,
  browserCompletedAt, browserScreenshots, demoVideoSha256, demoManifestSha256,
  demoCompletedAt, demoFrames, captionsSha256, narrationAuditSha256, inspectionManifestSha256,
}) {
  return {
    schema_version: 1,
    status: "PENDING-INDEPENDENT-REVIEW",
    scope: FINAL_ARTIFACT_REVIEW_SCOPE,
    reviewed_at: null,
    reviewer: { task: null, role: "independent-agent", artifact_creator: false },
    release: { deployed_url: deployedUrl, commit, build_sha256: buildSha256 },
    browser: {
      report_sha256: browserReportSha256, test_source_sha256: testSourceSha256,
      completed_at: new Date(browserCompletedAt).toISOString(), criteria: FINAL_BROWSER_REVIEW_CRITERIA,
      screenshots: browserScreenshots, findings: ["UNREVIEWED"],
    },
    demo: {
      youtube_url: youtubeUrl, video_sha256: demoVideoSha256, manifest_sha256: demoManifestSha256,
      completed_at: new Date(demoCompletedAt).toISOString(), criteria: FINAL_DEMO_REVIEW_CRITERIA,
      frames: demoFrames, captions_sha256: captionsSha256,
      narration_audit_sha256: narrationAuditSha256, audio_codec: "opus", findings: ["UNREVIEWED"],
    },
    inspection: { manifest_sha256: inspectionManifestSha256, file_count: 19 },
    summary: { blocker: 1, major: 0, minor: 0, finding_count: 1 },
  };
}

export function buildYouTubeUploadAttestation({ owner, youtubeUrl, demoVideoSha256, uploadedAt }) {
  return {
    schema_version: 1,
    status: "OWNER-ATTESTED",
    owner,
    youtube_url: youtubeUrl,
    local_video_sha256: demoVideoSha256,
    uploaded_at: uploadedAt,
    scope: "owner-observed-external-upload-action-not-byte-equivalence-or-human-outcome-evidence",
  };
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a" || bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("browser artifact attachment is not a PNG");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export async function collectBrowserArtifactEvidence(report, { read = readFile } = {}) {
  const evidence = [];
  for (const test of collectReportTests(report?.suites)) {
    if (!test.title.startsWith("BG-14 ")) continue;
    for (const result of test.results ?? []) {
      for (const attachment of result.attachments ?? []) {
        if (!FINAL_BROWSER_SCREENSHOT_NAMES.includes(attachment.name) || attachment.contentType !== "image/png" || !attachment.path) continue;
        if (!/(?:^|[/\\])(?:test-results|artifacts)(?:[/\\])/u.test(attachment.path)) {
          throw new Error(`browser artifact attachment path is outside the evidence directories: ${attachment.path}`);
        }
        const bytes = await read(attachment.path);
        evidence.push({
          project: test.projectName, name: attachment.name,
          sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
          ...pngDimensions(bytes),
        });
      }
    }
  }
  const sorted = evidence.sort((a, b) => `${a.project}:${a.name}`.localeCompare(`${b.project}:${b.name}`));
  const expectedKeys = ["chromium", "firefox", "mobile", "webkit"].flatMap((project) =>
    FINAL_BROWSER_SCREENSHOT_NAMES.map((name) => `${project}:${name}`)).sort();
  if (JSON.stringify(sorted.map(({ project, name }) => `${project}:${name}`)) !== JSON.stringify(expectedKeys)) {
    throw new Error("browser artifact evidence must be the unique four-project by three-state screenshot set");
  }
  return sorted;
}

export function validateTrackedEvidenceFile(path, workingBytes, stats, headBytes) {
  const errors = [];
  if (!stats?.isFile?.() || stats?.isSymbolicLink?.()) errors.push(`${path} must be a regular non-symlink file`);
  if (!Buffer.isBuffer(workingBytes) || !Buffer.isBuffer(headBytes) || !workingBytes.equals(headBytes)) {
    errors.push(`${path} working bytes must exactly match the Git HEAD blob`);
  }
  return errors;
}

export function computeDemoFrameEvidence(videoPath, { runner = spawnSync } = {}) {
  return FINAL_DEMO_FRAME_TIMES.map((timeSeconds) => {
    const result = runner("ffmpeg", [
      "-v", "error", "-ss", String(timeSeconds), "-i", videoPath,
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ], { encoding: null, maxBuffer: 8_000_000 });
    if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || result.stdout.length !== 1440 * 900 * 3) {
      throw new Error(`could not decode canonical demo frame at ${timeSeconds}s`);
    }
    return {
      time_seconds: timeSeconds, pixel_sha256: createHash("sha256").update(result.stdout).digest("hex"),
      bytes: result.stdout.length, width: 1440, height: 900, pixel_format: "rgb24",
    };
  });
}

export function renderDemoInspectionPngs(videoPath, { runner = spawnSync } = {}) {
  return FINAL_DEMO_FRAME_TIMES.map((timeSeconds) => {
    const result = runner("ffmpeg", [
      "-v", "error", "-ss", String(timeSeconds), "-i", videoPath,
      "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1",
    ], { encoding: null, maxBuffer: 8_000_000 });
    if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
      throw new Error(`could not render canonical demo inspection PNG at ${timeSeconds}s`);
    }
    const dimensions = pngDimensions(result.stdout);
    if (dimensions.width !== 1440 || dimensions.height !== 900) {
      throw new Error(`canonical demo inspection PNG at ${timeSeconds}s is not 1440x900`);
    }
    return {
      evidence: {
        time_seconds: timeSeconds, sha256: createHash("sha256").update(result.stdout).digest("hex"),
        bytes: result.stdout.length, ...dimensions,
      },
      bytes: result.stdout,
    };
  });
}

export function computeDemoAuditDigest({ demoManifestPath, visualManifestPath, runner = spawnSync }) {
  const outputs = [];
  for (const [script, manifestPath] of [
    ["scripts/check-demo-rehearsal.mjs", visualManifestPath],
    ["scripts/check-demo-narration.mjs", demoManifestPath],
  ]) {
    const audit = runner(process.execPath, [script, "--manifest", manifestPath], { encoding: "utf8" });
    if (audit.status !== 0) throw new Error(`${script} failed: ${audit.stderr || audit.stdout}`);
    outputs.push(audit.stdout.trim());
  }
  return createHash("sha256").update(`${outputs.join("\n")}\n`).digest("hex");
}

export function validateFinalArtifactReview(review, {
  deployedUrl, youtubeUrl, commit, buildSha256, browserReportSha256, testSourceSha256,
  demoVideoSha256, demoManifestSha256, browserCompletedAt, demoCompletedAt,
  browserScreenshots, demoFrames, captionsSha256, narrationAuditSha256,
  inspectionManifestSha256,
  now = Date.now(), finalDeadlineMs = FINAL_DEADLINE_MS,
} = {}) {
  const errors = [];
  const exactArray = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
  if (review?.schema_version !== 1 || review?.status !== "PASS") {
    errors.push("final artifact review must be schema version 1 with PASS status");
  }
  if (review?.scope !== FINAL_ARTIFACT_REVIEW_SCOPE) {
    errors.push("final artifact review scope must disclaim human accessibility, usability, preference, and memorability evidence");
  }
  if (!/^\/root\/[a-z0-9_]+$/u.test(review?.reviewer?.task ?? "") || review.reviewer.task === "/root") {
    errors.push("final artifact review must identify a distinct /root/<task> reviewer");
  }
  if (review?.reviewer?.role !== "independent-agent" || review?.reviewer?.artifact_creator !== false) {
    errors.push("final artifact reviewer must be an independent non-creator agent");
  }
  const reviewedAt = Date.parse(review?.reviewed_at);
  const evidenceCompletedAt = Math.max(browserCompletedAt ?? -Infinity, demoCompletedAt ?? -Infinity);
  const browserCompletedIso = Number.isFinite(browserCompletedAt) ? new Date(browserCompletedAt).toISOString() : undefined;
  const demoCompletedIso = Number.isFinite(demoCompletedAt) ? new Date(demoCompletedAt).toISOString() : undefined;
  if (!KST_TIMESTAMP.test(review?.reviewed_at ?? "") || !Number.isFinite(reviewedAt) || reviewedAt > now || reviewedAt > finalDeadlineMs ||
      !Number.isFinite(evidenceCompletedAt) || reviewedAt < evidenceCompletedAt) {
    errors.push("final artifact review timestamp must follow browser/demo evidence and precede the deadline");
  }
  if (review?.release?.deployed_url !== deployedUrl || review?.release?.commit !== commit ||
      review?.release?.build_sha256 !== buildSha256) {
    errors.push("final artifact review release binding mismatch");
  }
  if (review?.browser?.report_sha256 !== browserReportSha256 || review?.browser?.test_source_sha256 !== testSourceSha256 ||
      review?.browser?.completed_at !== browserCompletedIso) {
    errors.push("final artifact review browser evidence binding mismatch");
  }
  if (!exactArray(review?.browser?.criteria, FINAL_BROWSER_REVIEW_CRITERIA)) {
    errors.push("final artifact review browser criteria mismatch");
  }
  if (!Array.isArray(review?.browser?.findings) || review.browser.findings.length !== 0) {
    errors.push("final artifact review browser findings must be an empty array");
  }
  if (!exactArray(review?.browser?.screenshots, browserScreenshots) || browserScreenshots?.length !== 12) {
    errors.push("final artifact review must bind twelve recomputed browser screenshots");
  }
  if (review?.demo?.youtube_url !== youtubeUrl || review?.demo?.video_sha256 !== demoVideoSha256 ||
      review?.demo?.manifest_sha256 !== demoManifestSha256 ||
      review?.demo?.completed_at !== demoCompletedIso) {
    errors.push("final artifact review demo evidence binding mismatch");
  }
  if (!exactArray(review?.demo?.criteria, FINAL_DEMO_REVIEW_CRITERIA)) {
    errors.push("final artifact review demo criteria mismatch");
  }
  if (!Array.isArray(review?.demo?.findings) || review.demo.findings.length !== 0) {
    errors.push("final artifact review demo findings must be an empty array");
  }
  if (!exactArray(review?.demo?.frames, demoFrames) || demoFrames?.length !== FINAL_DEMO_FRAME_TIMES.length) {
    errors.push("final artifact review must bind seven recomputed canonical demo frames");
  }
  if (review?.demo?.captions_sha256 !== captionsSha256 || review?.demo?.narration_audit_sha256 !== narrationAuditSha256 ||
      review?.demo?.audio_codec !== "opus") {
    errors.push("final artifact review audio/caption audit binding mismatch");
  }
  if (!SHA256.test(review?.inspection?.manifest_sha256 ?? "") || review?.inspection?.file_count !== 19 ||
      (inspectionManifestSha256 && review.inspection.manifest_sha256 !== inspectionManifestSha256)) {
    errors.push("final artifact review inspection manifest binding mismatch");
  }
  if (review?.summary?.blocker !== 0 || review?.summary?.major !== 0 || review?.summary?.minor !== 0 ||
      review?.summary?.finding_count !== 0) {
    errors.push("final artifact review summary must report zero findings");
  }
  return errors;
}

export function validateYouTubeUploadAttestation(attestation, {
  youtubeUrl, demoVideoSha256, demoCompletedAt, now = Date.now(), finalDeadlineMs = FINAL_DEADLINE_MS,
} = {}) {
  const errors = [];
  if (attestation?.schema_version !== 1 || attestation?.status !== "OWNER-ATTESTED") {
    errors.push("YouTube upload attestation must be schema version 1 with OWNER-ATTESTED status");
  }
  if (attestation?.youtube_url !== youtubeUrl || attestation?.local_video_sha256 !== demoVideoSha256) {
    errors.push("YouTube upload attestation must bind the public URL and exact local candidate SHA-256");
  }
  if (!attestation?.owner || /^(?:test|unknown|agent|codex|self|owner|admin|user|fake|placeholder|qa)$/iu.test(attestation.owner)) {
    errors.push("YouTube upload attestation must identify the real owner");
  }
  const uploadedAt = Date.parse(attestation?.uploaded_at);
  if (!Number.isFinite(demoCompletedAt) || !KST_TIMESTAMP.test(attestation?.uploaded_at ?? "") || !Number.isFinite(uploadedAt) ||
      uploadedAt < demoCompletedAt || uploadedAt > now || uploadedAt > finalDeadlineMs) {
    errors.push("YouTube upload attestation timestamp must follow the candidate and precede the deadline");
  }
  if (attestation?.scope !== "owner-observed-external-upload-action-not-byte-equivalence-or-human-outcome-evidence") {
    errors.push("YouTube upload attestation must preserve its limited external-action scope");
  }
  return errors;
}

export function validateFinalLedger(ledger, {
  deployedUrl, githubUrl, youtubeUrl, commit, buildSha256, browserReportSha256, demoVideoSha256, browserCompletedAt,
  artifactReviewSha256, artifactReviewerTask, artifactReviewedAt,
  youtubeUploadConfirmationSha256, youtubeUploader, youtubeUploadedAt,
  now = Date.now(), releaseEpochSeconds, headEpochSeconds,
}) {
  const errors = [];
  const { rows, duplicates } = parseRows(ledger);
  for (const phase of duplicates) errors.push(`submission ledger contains duplicate ${phase} rows`);
  const specifications = [
    {
      phase: "final-browser-qa",
      artifact: deployedUrl,
      sha: [`commit=${commit}`, `build=${buildSha256}`, `report=${browserReportSha256}`],
      checks: ["browser-report PASS", "artifact-visual PASS", "voiceover UNAVAILABLE-NO-CLAIM"],
      externalStatus: "public",
      agentReviewer: true, reviewerTask: artifactReviewerTask,
      noteValues: { role: "independent-agent", review: artifactReviewSha256, Playwright: "1.61.1" },
    },
    {
      phase: "github-public", artifact: githubUrl, sha: [`commit=${commit}`],
      checks: ["public-API PASS", "release-commit PASS", "repo-docs PASS"], externalStatus: "public",
    },
    {
      phase: "youtube-public", artifact: youtubeUrl,
      sha: [`commit=${commit}`, `build=${buildSha256}`, `video=${demoVideoSha256}`],
      checks: ["oEmbed PASS", "demo-contract PASS", "artifact-audio-visual PASS"], externalStatus: "public",
      agentReviewer: true, reviewerTask: artifactReviewerTask, ownerUpload: true,
      noteValues: { role: "independent-agent", review: artifactReviewSha256, "source-url": deployedUrl },
    },
    {
      phase: "final-freeze",
      artifact: "release",
      sha: [`commit=${commit}`, `build=${buildSha256}`],
      checks: ["clean PASS", "deadline PASS"],
      externalStatus: "frozen",
      noteValues: { preflight: "PASS" },
    },
  ];
  if (!COMMIT.test(commit)) errors.push("release commit must be a full 40-character Git SHA");
  if (!SHA256.test(buildSha256)) errors.push("production build must have a SHA-256");
  if (!SHA256.test(browserReportSha256 ?? "")) errors.push("browser report must have a SHA-256");
  if (!SHA256.test(demoVideoSha256 ?? "")) errors.push("final demo video must have a SHA-256");
  if (!SHA256.test(artifactReviewSha256 ?? "")) errors.push("final artifact review must have a SHA-256");
  let priorTimestamp = -Infinity;
  for (const specification of specifications) {
    const row = rows.get(specification.phase);
    if (!row) {
      errors.push(`submission ledger lacks a ${specification.phase} row`);
      continue;
    }
    if (row.cells.length !== 7) errors.push(`${specification.phase} row must contain exactly 7 cells`);
    if (!KST_TIMESTAMP.test(row.timestamp) || !Number.isFinite(Date.parse(row.timestamp))) {
      errors.push(`${specification.phase} row requires an RFC3339 KST timestamp`);
    } else if (Date.parse(row.timestamp) > FINAL_DEADLINE_MS) {
      errors.push(`${specification.phase} row timestamp is after the submission deadline`);
    } else {
      const timestamp = Date.parse(row.timestamp);
      if (timestamp > now) errors.push(`${specification.phase} row timestamp is in the future`);
      if (Number.isFinite(releaseEpochSeconds) && timestamp < releaseEpochSeconds * 1000) errors.push(`${specification.phase} row predates the release commit`);
      if (Number.isFinite(headEpochSeconds) && timestamp > headEpochSeconds * 1000) errors.push(`${specification.phase} row is later than final HEAD`);
      if (timestamp < priorTimestamp) errors.push(`${specification.phase} row is out of evidence order`);
      if (specification.phase === "final-browser-qa" && (!Number.isFinite(browserCompletedAt) || timestamp < browserCompletedAt)) {
        errors.push("final-browser-qa row must be timestamped after the browser report completed");
      }
      if (["final-browser-qa", "youtube-public"].includes(specification.phase) &&
          (!Number.isFinite(artifactReviewedAt) || timestamp < artifactReviewedAt)) {
        errors.push(`${specification.phase} row must be timestamped after the independent-agent artifact review`);
      }
      if (specification.phase === "youtube-public" && (!Number.isFinite(youtubeUploadedAt) || timestamp < youtubeUploadedAt)) {
        errors.push("youtube-public row must be timestamped after the owner upload attestation");
      }
      priorTimestamp = timestamp;
    }
    const [,, artifact, shaCell, checksCell, externalStatus, notes] = row.cells;
    if (artifact !== specification.artifact) errors.push(`${specification.phase} row is not bound to the expected artifact or URL`);
    if (shaCell !== specification.sha.join(" ")) errors.push(`${specification.phase} row SHA/commit cell must exactly match the evidence contract`);
    if (checksCell !== specification.checks.join(" ")) errors.push(`${specification.phase} row Checks cell must exactly match the evidence contract`);
    if (externalStatus !== specification.externalStatus) errors.push(`${specification.phase} row external status must be '${specification.externalStatus}'`);
    const requiresStructuredNotes = specification.agentReviewer || specification.ownerUpload || specification.noteKeys?.length || specification.noteValues;
    const noteTokens = (notes ?? "").split(/\s+/u).filter(Boolean);
    const expectedNoteKeys = requiresStructuredNotes
      ? [
          ...(specification.agentReviewer ? ["reviewer"] : []),
          ...(specification.noteKeys ?? []),
          ...Object.keys(specification.noteValues ?? {}),
          ...(specification.ownerUpload ? ["uploader", "confirmation"] : []),
        ]
      : [];
    const parsedNotes = new Map();
    let notesMalformed = false;
    if (requiresStructuredNotes) {
      for (const token of noteTokens) {
        const separator = token.indexOf("=");
        if (separator <= 0 || separator === token.length - 1) { notesMalformed = true; continue; }
        const key = token.slice(0, separator);
        if (parsedNotes.has(key)) notesMalformed = true;
        parsedNotes.set(key, token.slice(separator + 1));
      }
      if (notesMalformed || noteTokens.length !== expectedNoteKeys.length ||
          JSON.stringify([...parsedNotes.keys()]) !== JSON.stringify(expectedNoteKeys)) {
        errors.push(`${specification.phase} row Notes must use exact unique keys: ${expectedNoteKeys.join(" ")}`);
      }
    }
    const reviewer = parsedNotes.get("reviewer");
    if (specification.agentReviewer && !/^\/root\/[a-z0-9_]+$/u.test(reviewer ?? "")) {
      errors.push(`${specification.phase} reviewer must identify the distinct /root/<task> independent agent`);
    } else if (specification.agentReviewer && reviewer !== specification.reviewerTask) {
      errors.push(`${specification.phase} reviewer must match the SHA-bound artifact review task`);
    }
    for (const key of specification.noteKeys ?? []) {
      const value = parsedNotes.get(key);
      if (!value) errors.push(`${specification.phase} row Notes missing ${key}=<value>`);
      else if (/^(?:test|unknown|fake|placeholder|n\/a)$/iu.test(value)) errors.push(`${specification.phase} row Notes has placeholder ${key}=<value>`);
    }
    for (const [key, expected] of Object.entries(specification.noteValues ?? {})) {
      if (parsedNotes.get(key) !== expected) errors.push(`${specification.phase} row Notes must bind ${key}=${expected}`);
    }
    if (specification.ownerUpload) {
      const uploader = parsedNotes.get("uploader");
      if (uploader !== youtubeUploader) {
        errors.push(`${specification.phase} uploader must match the content-addressed owner attestation`);
      }
      if (parsedNotes.get("confirmation") !== youtubeUploadConfirmationSha256 || !SHA256.test(youtubeUploadConfirmationSha256 ?? "")) {
        errors.push(`${specification.phase} confirmation must match the content-addressed owner attestation SHA-256`);
      }
    }
  }
  return errors;
}

export function validateFinalSubmissionReceipt(ledger, {
  commit, buildSha256, now = Date.now(), finalDeadlineMs = FINAL_DEADLINE_MS, required = false, headEpochSeconds,
}) {
  const receiptRows = ledger.split(/\r?\n/u).flatMap((line) => {
    if (!line.trim().startsWith("|") || !line.trim().endsWith("|")) return [];
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/gu, ""));
    return cells[1] === "final-submitted" ? [{ line, cells, timestamp: cells[0] }] : [];
  });
  if (receiptRows.length === 0) return required ? ["submission ledger lacks a required final-submitted row"] : [];
  const { rows } = parseRows(ledger);
  const row = receiptRows[0];
  const errors = [];
  if (receiptRows.length > 1) errors.push("submission ledger contains duplicate final-submitted rows");
  if (row.cells.length !== 7) errors.push("final-submitted row must contain exactly 7 cells");
  const [timestamp,, artifact, shaCell, checksCell, externalStatus, notes] = row.cells;
  if (!KST_TIMESTAMP.test(timestamp ?? "") || !Number.isFinite(Date.parse(timestamp))) {
    errors.push("final-submitted row requires an RFC3339 KST timestamp");
  } else {
    const timestampMs = Date.parse(timestamp);
    if (timestampMs > now) errors.push("final-submitted row timestamp is in the future");
    if (timestampMs > finalDeadlineMs) errors.push("final-submitted row timestamp is after the submission deadline");
    if (Number.isFinite(headEpochSeconds) && timestampMs > headEpochSeconds * 1000) {
      errors.push("final-submitted row is later than final HEAD");
    }
    const freezeTimestamp = rows.get("final-freeze")?.timestamp;
    if (KST_TIMESTAMP.test(freezeTimestamp ?? "") && timestampMs < Date.parse(freezeTimestamp)) {
      errors.push("final-submitted row predates final-freeze evidence");
    }
  }
  if (artifact !== "DAKER-final-entry") errors.push("final-submitted Artifact/URL must exactly equal 'DAKER-final-entry'");
  if (shaCell !== `commit=${commit} build=${buildSha256}`) errors.push("final-submitted SHA/commit cell must exactly bind release commit and build");
  if (checksCell !== "owner-confirmation PASS") errors.push("final-submitted Checks cell must exactly equal 'owner-confirmation PASS'");
  if (externalStatus !== "submitted") errors.push("final-submitted external status must be 'submitted'");
  if (/\b(?:FAIL|PENDING|SKIP|N\/A)\b/iu.test(row.line)) errors.push("final-submitted row contains a forbidden non-pass token");
  const noteMatch = /^owner=([^\s|]+) confirmation=([^\s|]+)$/u.exec(notes ?? "");
  if (!noteMatch) errors.push("final-submitted Notes must exactly identify owner=<name> confirmation=<official-id-or-url-or-screenshot-sha256>");
  else if (/^(?:test|unknown|agent|codex|self)$/iu.test(noteMatch[1])) errors.push("final-submitted owner must be a real owner identity, not a placeholder");
  else {
    const confirmation = noteMatch[2];
    const validConfirmation = SHA256.test(confirmation) || /^https:\/\/[^\s|]+$/u.test(confirmation) || /^[A-Za-z][A-Za-z0-9_-]{7,}$/u.test(confirmation);
    if (!validConfirmation || /^(?:pending|unknown|placeholder|confirmation|screenshot|receipt)$/iu.test(confirmation)) {
      errors.push("final-submitted confirmation must be an official ID, HTTPS URL, or screenshot SHA-256");
    }
  }
  return errors;
}

export function validateDeadline({ now = Date.now(), commitEpochSeconds, frozenAt }) {
  const errors = [];
  if (!Number.isFinite(commitEpochSeconds)) errors.push("latest commit timestamp is invalid");
  else if (commitEpochSeconds * 1000 > FINAL_DEADLINE_MS) errors.push("latest commit is after the final submission deadline");
  if (now >= FINAL_DEADLINE_MS) {
    if (!KST_TIMESTAMP.test(frozenAt ?? "") || Date.parse(frozenAt) > FINAL_DEADLINE_MS) {
      errors.push("post-deadline verification requires a recorded pre-deadline final freeze");
    }
  }
  return errors;
}
