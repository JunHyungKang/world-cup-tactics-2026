import { createHash } from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";
import { parsePairedFlags } from "./lib/cli.mjs";
import { parseDeploymentUrl, probeDeployment } from "./lib/final-submission.mjs";

const node = process.execPath;
const args = parsePairedFlags(process.argv.slice(2));
const allowedFlags = new Set(["--deployed-url", "--release-commit", "--build-sha256", "--output", "--manifest"]);
for (const flag of args.keys()) if (!allowedFlags.has(flag)) throw new Error(`unsupported final demo flag: ${flag}`);
const finalMode = args.size > 0;
const localBaseURL = "http://127.0.0.1:4185";
let baseURL = localBaseURL;
const releaseCommit = args.get("--release-commit");
const buildSha256 = args.get("--build-sha256");
const videoPath = finalMode ? args.get("--output") : "output/demo/corner-war-room-60s-rehearsal.webm";
const manifestPath = finalMode ? args.get("--manifest") : "output/demo/rehearsal-manifest.json";
if (finalMode && (!args.get("--deployed-url") || !videoPath || !manifestPath || !/^[0-9a-f]{40}$/u.test(releaseCommit ?? "") || !/^[0-9a-f]{64}$/u.test(buildSha256 ?? ""))) {
  throw new Error("final demo recording requires --deployed-url, --release-commit, --build-sha256, --output, and --manifest");
}
const outputDirectory = dirname(videoPath);

function run(argv) {
  const result = spawnSync(node, argv, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(baseURL, { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`demo preview did not become ready: ${baseURL}`);
}

function probe(path) {
  const result = spawnSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries",
    "stream=codec_name,width,height:format=duration", "-of", "json", path,
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`ffprobe failed: ${result.stderr}`);
  const value = JSON.parse(result.stdout);
  return {
    duration_seconds: Number(value.format.duration),
    codec: value.streams[0].codec_name,
    width: value.streams[0].width,
    height: value.streams[0].height,
  };
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(dirname(manifestPath), { recursive: true });
const storyBytes = await readFile("docs/submission-story.json");
let preview;
let releaseEvidence;
if (finalMode) {
  baseURL = parseDeploymentUrl(args.get("--deployed-url"));
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  if (head !== releaseCommit || status) throw new Error("final demo recording requires the exact clean release commit as HEAD");
  const markerBytes = await readFile("dist/submission-build.json");
  const marker = JSON.parse(markerBytes.toString("utf8"));
  if (marker.releaseCommit !== releaseCommit || marker.buildSha256 !== buildSha256) {
    throw new Error("local release marker does not match final demo release/build inputs");
  }
  const deployed = await probeDeployment(baseURL, fetch, marker);
  if (deployed.errors.length) throw new Error(`final demo deployment parity failed: ${deployed.errors.join("; ")}`);
  baseURL = parseDeploymentUrl(deployed.finalUrl);
  releaseEvidence = {
    release_commit: releaseCommit,
    build_sha256: buildSha256,
    local_marker_path: "dist/submission-build.json",
    local_marker_sha256: createHash("sha256").update(markerBytes).digest("hex"),
    deployed_marker_sha256: createHash("sha256").update(deployed.deployedBuildBytes).digest("hex"),
    deployment_parity: "PASS",
  };
} else {
  run(["node_modules/vite/bin/vite.js", "build"]);
  preview = spawn(node, [
    "node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4185", "--strictPort",
  ], { stdio: "inherit" });
  await waitForServer();
}

try {
  const captureStartedAt = new Date().toISOString();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: `${outputDirectory}/raw`, size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.getByRole("heading", { name: /코너 수비에 한 명 더/u }).waitFor();
    const galleryImage = await readFile("docs/assets/gallery/corner-war-room-first-image.png");
    await page.evaluate((source) => {
      const overlay = document.createElement("img");
      overlay.id = "gallery-cold-open";
      overlay.src = source;
      overlay.alt = "선택 전, 수비 전환, 이 선택으로 설명되지 않는 슈팅의 세 장면";
      Object.assign(overlay.style, {
        position: "fixed", inset: "0", width: "100vw", height: "100vh", objectFit: "cover",
        zIndex: "2147483647", background: "#07110d",
      });
      document.body.append(overlay);
    }, `data:image/png;base64,${galleryImage.toString("base64")}`);
    const start = performance.now();
    const actions = [];
    const waitUntil = async (seconds) => {
      const remaining = start + seconds * 1000 - performance.now();
      if (remaining > 0) await page.waitForTimeout(remaining);
    };
    const mark = (id, scheduled) => actions.push({
      id, scheduled_seconds: scheduled,
      actual_seconds: Number(((performance.now() - start) / 1000).toFixed(3)),
    });
    const showPitch = async () => {
      await page.getByTestId("evidence-pitch").evaluate((element) => {
        element.scrollIntoView({ block: "center", behavior: "instant" });
      });
    };
    const showReceipt = async () => {
      await page.getByTestId("evidence-receipt").evaluate((element) => {
        element.scrollIntoView({ block: "start", behavior: "instant" });
      });
    };

    const dragRoleTo = async (targetName) => {
      const source = await page.getByRole("button", { name: "역습 역할 1명을 수비 임무로 옮기기" }).boundingBox();
      const target = await page.getByRole("button", { name: targetName, exact: true }).boundingBox();
      if (!source || !target) throw new Error(`demo drag geometry is unavailable: ${targetName}`);
      const from = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
      const to = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let step = 1; step <= 10; step += 1) {
        const progress = step / 10;
        await page.mouse.move(
          from.x + (to.x - from.x) * progress,
          from.y + (to.y - from.y) * progress,
        );
        await page.waitForTimeout(35);
      }
      await page.mouse.up();
    };

    await waitUntil(5);
    await page.locator("#gallery-cold-open").evaluate((element) => element.remove());
    await page.waitForTimeout(80);
    await dragRoleTo("세컨드볼 대비");
    await page.getByRole("heading", { name: "세컨드볼 대비 우선 · 역습 1명 수비 전환" }).waitFor();
    mark("commit", 5);

    await waitUntil(12);
    await page.getByRole("button", { name: "재생", exact: true }).click();
    mark("replay", 12);

    await waitUntil(13);
    await showPitch();
    mark("replay-pitch", 13);

    await waitUntil(22);
    await showReceipt();
    mark("replay-receipt", 22);

    await waitUntil(25);
    mark("separate-hold", 25);

    await waitUntil(32);
    await page.getByRole("button", { name: "니어포스트 수비", exact: true }).click();
    await page.getByRole("heading", { name: "니어포스트 수비 우선 · 역습 1명 수비 전환" }).waitFor();
    mark("reverse", 32);

    await waitUntil(34);
    await page.getByRole("button", { name: "초기화", exact: true }).click();
    await page.locator(".reset-status").waitFor();
    mark("reset", 34);
    const resetStatus = await page.locator(".reset-status").innerText();

    await waitUntil(38);
    await page.getByRole("button", { name: "세컨드볼 대비", exact: true }).click();
    await page.getByRole("button", { name: /반례 보기/u }).click();
    await page.getByRole("heading", { name: "이 선택으로 설명되지 않는 슈팅 기록" }).waitFor();
    await page.getByRole("button", { name: "재생", exact: true }).click();
    mark("counterexample", 38);

    await waitUntil(39);
    await showPitch();
    mark("counterexample-pitch", 39);

    await waitUntil(48);
    await showReceipt();
    mark("counterexample-receipt", 48);

    await waitUntil(55);
    mark("final-hold", 55);
    await waitUntil(60);
    const finalFrame = {
      heading: await page.getByRole("heading", { name: "이 선택으로 설명되지 않는 슈팅 기록" }).innerText(),
      verdict: await page.locator(".counter-verdict").innerText(),
      transcript: await page.getByTestId("current-event-transcript").innerText(),
      semantic_snapshot: JSON.parse(await page.getByTestId("semantic-snapshot").innerText()),
    };
    const video = page.video();
    await context.close();
    const rawPath = await video.path();
    await copyFile(rawPath, videoPath);

    const videoBytes = await readFile(videoPath);
    const media = probe(videoPath);
    const manifest = {
      schema_version: 1,
      status: finalMode ? "frozen-public-visual-candidate-not-youtube-or-human-reviewed" : "local-timed-rehearsal-not-youtube-evidence",
      source: finalMode ? "exact frozen public deployment" : "current production build rendered locally",
      base_url: baseURL,
      capture_started_at: captureStartedAt,
      capture_completed_at: new Date().toISOString(),
      ...(finalMode ? { release: releaseEvidence } : {}),
      submission_story_sha256: createHash("sha256").update(storyBytes).digest("hex"),
      cold_open: {
        path: "docs/assets/gallery/corner-war-room-first-image.png",
        sha256: createHash("sha256").update(galleryImage).digest("hex"),
        duration_seconds: 5,
      },
      video: {
        path: videoPath,
        sha256: createHash("sha256").update(videoBytes).digest("hex"),
        bytes: videoBytes.length,
        audio: finalMode ? "none-frozen-public-visual-candidate" : "none-local-visual-rehearsal",
        ...media,
      },
      actions,
      reset_status: resetStatus,
      final_frame: finalFrame,
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`[PASS] ${finalMode ? "frozen-public visual candidate" : "60-second demo rehearsal"}: duration=${media.duration_seconds.toFixed(3)}s sha256=${manifest.video.sha256}`);
  } finally {
    await browser.close();
  }
} finally {
  preview?.kill("SIGTERM");
}
