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
const videoPath = finalMode ? args.get("--output") : "output/demo/corner-policy-lab-60s-rehearsal.webm";
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
const [storyBytes, editorialTreatmentBytes] = await Promise.all([
  readFile("docs/submission-story.json"),
  readFile("docs/demo-editorial-treatment.json"),
]);
const editorialTreatment = JSON.parse(editorialTreatmentBytes.toString("utf8"));
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
  run(["scripts/build-policy-lab.mjs", "--output", "dist-policy-lab"]);
  preview = spawn(node, [
    "scripts/serve-policy-release.mjs", "--root", "dist-policy-lab", "--port", "4185",
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
    await page.getByRole("heading", { name: /코너킥 수비/u }).waitFor();
    const galleryImage = await readFile("docs/assets/gallery/corner-policy-lab-first-image.png");
    await page.evaluate(({ source, treatment }) => {
      const style = document.createElement("style");
      style.textContent = `
        @keyframes demo-cold-open-zoom {
          from { transform: scale(1); }
          to { transform: scale(1.04); }
        }
        #demo-editorial {
          position: fixed;
          top: 22px;
          right: 22px;
          z-index: 2147483500;
          width: min(390px, calc(100vw - 44px));
          color: #f7fbf8;
          background: linear-gradient(145deg, rgba(7,17,14,.94), rgba(20,49,38,.9));
          border: 1px solid rgba(131,230,184,.42);
          border-radius: 18px;
          box-shadow: 0 18px 44px rgba(0,0,0,.34);
          padding: 14px 16px 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif;
          pointer-events: none;
          transition: opacity 160ms ease, transform 160ms ease;
          backdrop-filter: blur(14px);
        }
        #demo-editorial.is-changing { opacity: .38; transform: translateY(-4px); }
        #demo-editorial .demo-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
        #demo-editorial .demo-label {
          padding: 4px 7px;
          border-radius: 999px;
          color: #07110e;
          background: #83e6b8;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .02em;
        }
        #demo-editorial .demo-kicker {
          color: #f1c84b;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: .08em;
        }
        #demo-editorial .demo-title { font-size: 21px; line-height: 1.25; font-weight: 900; }
        #demo-editorial .demo-detail { margin-top: 5px; color: #d4e1da; font-size: 13px; line-height: 1.4; font-weight: 650; }
        #demo-editorial .demo-progress { height: 3px; margin-top: 11px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.12); }
        #demo-editorial .demo-progress > span { display: block; height: 100%; border-radius: inherit; background: #f1c84b; transition: width 220ms ease; }
        #demo-editorial[data-tone="counterexample"] { border-color: rgba(240,165,106,.72); }
        #demo-editorial[data-tone="boundary"] { border-color: rgba(138,184,255,.72); }
        #gallery-cold-open { animation: demo-cold-open-zoom 5s ease-out both; }
      `;
      document.head.append(style);
      const overlay = document.createElement("img");
      overlay.id = "gallery-cold-open";
      overlay.src = source;
      overlay.alt = "코너킥 수비에 한 명을 더 둘지 역습에 남길지 고르고 같은 선택으로 두 경기 묶음을 확인하는 장면";
      Object.assign(overlay.style, {
        position: "fixed", inset: "0", width: "100vw", height: "100vh", objectFit: "cover",
        zIndex: "2147483000", background: "#07110d",
      });
      document.body.append(overlay);
      const editorial = document.createElement("aside");
      editorial.id = "demo-editorial";
      editorial.setAttribute("aria-hidden", "true");
      editorial.innerHTML = `
        <div class="demo-meta"><span class="demo-label"></span><span class="demo-kicker"></span></div>
        <div class="demo-title"></div><div class="demo-detail"></div>
        <div class="demo-progress"><span></span></div>
      `;
      document.body.append(editorial);
      window.__setDemoEditorial = (id) => {
        const chapter = treatment.chapters.find((item) => item.id === id);
        if (!chapter) throw new Error("unknown editorial chapter " + id);
        editorial.classList.add("is-changing");
        editorial.dataset.tone = chapter.tone;
        editorial.querySelector(".demo-label").textContent = treatment.label;
        editorial.querySelector(".demo-kicker").textContent = chapter.kicker;
        editorial.querySelector(".demo-title").textContent = chapter.title;
        editorial.querySelector(".demo-detail").textContent = chapter.detail;
        editorial.querySelector(".demo-progress > span").style.width =
          `${Math.min(100, Math.max(2, chapter.scheduled_seconds / 59.5 * 100))}%`;
        requestAnimationFrame(() => requestAnimationFrame(() => editorial.classList.remove("is-changing")));
      };
      window.__setDemoEditorial("hook");
    }, {
      source: `data:image/png;base64,${galleryImage.toString("base64")}`,
      treatment: editorialTreatment,
    });
    const start = performance.now();
    const actions = [];
    const editorialTransitions = [{
      id: "hook",
      scheduled_seconds: 0,
      actual_seconds: 0,
    }];
    const waitUntil = async (seconds) => {
      const remaining = start + seconds * 1000 - performance.now();
      if (remaining > 0) await page.waitForTimeout(remaining);
    };
    const mark = (id, scheduled) => actions.push({
      id, scheduled_seconds: scheduled,
      actual_seconds: Number(((performance.now() - start) / 1000).toFixed(3)),
    });
    const scrollTo = async (locator) => locator.evaluate((element) => {
      element.scrollIntoView({ block: "center", behavior: "instant" });
    });
    const updateEditorial = async (id, scheduled) => {
      await page.evaluate((chapterId) => window.__setDemoEditorial(chapterId), id);
      editorialTransitions.push({
        id,
        scheduled_seconds: scheduled,
        actual_seconds: Number(((performance.now() - start) / 1000).toFixed(3)),
      });
    };

    await waitUntil(5);
    await page.locator("#gallery-cold-open").evaluate((element) => element.remove());
    await updateEditorial("reference", 5);
    await page.waitForTimeout(80);
    await page.locator('.lane-card[data-lane="short"]').click();
    mark("priority-short", 5);

    await waitUntil(8);
    await page.locator('.lane-card[data-lane="near"]').click();
    mark("priority-near", 8);

    await waitUntil(10);
    await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
    mark("minimum-overlap", 10);

    await waitUntil(12);
    await updateEditorial("lock", 12);
    await page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" }).click();
    mark("policy-lock", 12);

    await waitUntil(16);
    await updateEditorial("r16", 16);
    await page.getByRole("button", { name: "16강 8경기 결과 보기" }).click();
    mark("r16-reveal", 16);

    await waitUntil(18);
    await scrollTo(page.getByTestId("counterexample"));
    mark("r16-contradiction", 18);

    await waitUntil(20.5);
    await scrollTo(page.getByTestId("counterexample"));
    await updateEditorial("receipts", 20.5);

    await waitUntil(23);
    await scrollTo(page.getByTestId("counterexample"));
    await updateEditorial("counterexample", 23);

    await waitUntil(27);
    await scrollTo(page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }));
    await updateEditorial("sealed", 27);

    await waitUntil(30);
    await updateEditorial("final-audit", 30);
    await page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }).click();
    mark("final-reveal", 30);

    await waitUntil(34);
    await page.getByTestId("final-receipt").waitFor();
    mark("final-receipt", 34);

    await waitUntil(36);
    await scrollTo(page.getByTestId("final-receipt"));
    await updateEditorial("boundary", 36);

    await waitUntil(38);
    await scrollTo(page.locator('[data-action="save-meeting-note"]'));
    mark("meeting-note-view", 38);

    await waitUntil(40);
    await updateEditorial("next-meeting", 40);

    await waitUntil(42);
    await page.getByLabel("다음 회의에서 우선 구역 수정").check();
    mark("meeting-decision", 42);

    await waitUntil(45);
    await page.getByLabel("이유 (120자 이내)").fill("선택 밖 전달이 반복돼 다음 회의에서 구역 조합을 다시 검토");
    mark("meeting-reason", 45);

    await waitUntil(48);
    await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();
    mark("meeting-note-save", 48);

    await waitUntil(53);
    await scrollTo(page.getByTestId("final-receipt"));
    await updateEditorial("final-hold", 53);
    await waitUntil(59.9);
    const finalReceipt = await page.getByTestId("final-receipt").innerText();
    const finalFrame = {
      receipt: finalReceipt,
      meeting_note: await page.getByTestId("meeting-note-receipt").innerText(),
      policy_fingerprint: finalReceipt.match(/P-[0-9a-f]+/u)?.[0] ?? null,
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
        path: "docs/assets/gallery/corner-policy-lab-first-image.png",
        sha256: createHash("sha256").update(galleryImage).digest("hex"),
        duration_seconds: 5,
        motion: "slow-zoom-1.04x",
      },
      editorial_treatment: {
        path: "docs/demo-editorial-treatment.json",
        sha256: createHash("sha256").update(editorialTreatmentBytes).digest("hex"),
        status: editorialTreatment.status,
        label: editorialTreatment.label,
        transitions: editorialTransitions,
      },
      video: {
        path: videoPath,
        sha256: createHash("sha256").update(videoBytes).digest("hex"),
        bytes: videoBytes.length,
        audio: finalMode ? "none-frozen-public-visual-candidate" : "none-local-visual-rehearsal",
        ...media,
      },
      actions,
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
