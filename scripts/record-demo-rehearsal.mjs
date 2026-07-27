import { createHash } from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";
import { parsePairedFlags } from "./lib/cli.mjs";
import { parseDeploymentUrl, probeDeployment } from "./lib/final-submission.mjs";
import { exactDemoActions } from "./lib/submission-story.mjs";

const node = process.execPath;
const args = parsePairedFlags(process.argv.slice(2));
const allowedFlags = new Set(["--deployed-url", "--release-commit", "--build-sha256", "--output", "--manifest"]);
for (const flag of args.keys()) {
  if (!allowedFlags.has(flag)) throw new Error(`unsupported final demo flag: ${flag}`);
}
const finalMode = args.size > 0;
const localBaseURL = "http://127.0.0.1:4185";
let baseURL = localBaseURL;
const releaseCommit = args.get("--release-commit");
const buildSha256 = args.get("--build-sha256");
const videoPath = finalMode
  ? args.get("--output")
  : "output/demo/corner-policy-lab-60s-rehearsal.webm";
const manifestPath = finalMode
  ? args.get("--manifest")
  : "output/demo/rehearsal-manifest.json";
if (finalMode &&
    (!args.get("--deployed-url") ||
      !videoPath ||
      !manifestPath ||
      !/^[0-9a-f]{40}$/u.test(releaseCommit ?? "") ||
      !/^[0-9a-f]{64}$/u.test(buildSha256 ?? ""))) {
  throw new Error(
    "final demo recording requires --deployed-url, --release-commit, --build-sha256, --output, and --manifest",
  );
}
const outputDirectory = dirname(videoPath);
const coldOpenPath = `${outputDirectory}/corner-policy-lab-cold-open.png`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

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
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,width,height:format=duration",
    "-of", "json",
    path,
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
const story = JSON.parse(storyBytes.toString("utf8"));
const editorialTreatment = JSON.parse(editorialTreatmentBytes.toString("utf8"));
if (story.schema_version !== 3 || story.product_id !== "corner-policy-lab") {
  throw new Error("demo recorder requires the canonical schema-3 Corner Prep Lab story");
}

let preview;
let releaseEvidence;
let releaseManifestPath;
if (finalMode) {
  baseURL = parseDeploymentUrl(args.get("--deployed-url"));
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  if (head !== releaseCommit || status) {
    throw new Error("final demo recording requires the exact clean release commit as HEAD");
  }
  const markerBytes = await readFile("dist/submission-build.json");
  const marker = JSON.parse(markerBytes.toString("utf8"));
  if (marker.releaseCommit !== releaseCommit || marker.buildSha256 !== buildSha256) {
    throw new Error("local release marker does not match final demo release/build inputs");
  }
  const deployed = await probeDeployment(baseURL, fetch, marker);
  if (deployed.errors.length) {
    throw new Error(`final demo deployment parity failed: ${deployed.errors.join("; ")}`);
  }
  baseURL = parseDeploymentUrl(deployed.finalUrl);
  releaseManifestPath = "dist/release-manifest.json";
  releaseEvidence = {
    release_commit: releaseCommit,
    build_sha256: buildSha256,
    local_marker_path: "dist/submission-build.json",
    local_marker_sha256: sha256(markerBytes),
    deployed_marker_sha256: sha256(deployed.deployedBuildBytes),
    deployment_parity: "PASS",
  };
} else {
  run(["scripts/build-policy-lab.mjs", "--output", "dist-policy-lab"]);
  releaseManifestPath = "dist-policy-lab/release-manifest.json";
  preview = spawn(node, [
    "scripts/serve-policy-release.mjs",
    "--root", "dist-policy-lab",
    "--port", "4185",
  ], { stdio: "inherit" });
  await waitForServer();
}

const releaseManifestBytes = await readFile(releaseManifestPath);
const releaseManifest = JSON.parse(releaseManifestBytes.toString("utf8"));
if (releaseManifest.product_id !== "corner-policy-lab" ||
    releaseManifest.product_selection_status !== "PASS" ||
    releaseManifest.causal_recommendation_status !== "REJECT" ||
    releaseManifest.empirical_campaign_status !== "REVISE") {
  throw new Error("release claim boundary is not recordable");
}

try {
  const captureStartedAt = new Date().toISOString();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir: `${outputDirectory}/raw`,
        size: { width: 1440, height: 900 },
      },
    });
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.getByRole("heading", { name: /포르투갈 코너 상황 3유형/u }).waitFor();

    await page.evaluate((treatment) => {
      const style = document.createElement("style");
      style.textContent = `
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
        #demo-editorial .demo-detail {
          margin-top: 5px;
          color: #d4e1da;
          font-size: 13px;
          line-height: 1.4;
          font-weight: 650;
        }
        #demo-editorial .demo-progress {
          height: 3px;
          margin-top: 11px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
        }
        #demo-editorial .demo-progress > span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #f1c84b;
          transition: width 220ms ease;
        }
        #demo-editorial[data-tone="counterexample"] { border-color: rgba(240,165,106,.72); }
        #demo-editorial[data-tone="boundary"] { border-color: rgba(138,184,255,.72); }
      `;
      document.head.append(style);
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
        if (!chapter) throw new Error(`unknown editorial chapter ${id}`);
        editorial.classList.add("is-changing");
        editorial.dataset.tone = chapter.tone;
        editorial.querySelector(".demo-label").textContent = treatment.label;
        editorial.querySelector(".demo-kicker").textContent = chapter.kicker;
        editorial.querySelector(".demo-title").textContent = chapter.title;
        editorial.querySelector(".demo-detail").textContent = chapter.detail;
        editorial.querySelector(".demo-progress > span").style.width =
          `${Math.min(100, Math.max(2, chapter.scheduled_seconds / 59.5 * 100))}%`;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          editorial.classList.remove("is-changing");
        }));
      };
      window.__setDemoEditorial("hook");
    }, editorialTreatment);
    await page.waitForTimeout(editorialTreatment.transition_ms + 40);
    await page.screenshot({
      path: coldOpenPath,
      animations: "disabled",
    });

    const start = performance.now();
    const actions = [];
    const editorialTransitions = [{ id: "hook", scheduled_seconds: 0, actual_seconds: 0 }];
    const waitUntil = async (seconds) => {
      const remaining = start + seconds * 1000 - performance.now();
      if (remaining > 0) await page.waitForTimeout(remaining);
    };
    const mark = (id, scheduled) => actions.push({
      id,
      scheduled_seconds: scheduled,
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
    const activateAt = async (id, scheduled, locator) => {
      await waitUntil(scheduled);
      await locator.click();
      mark(id, scheduled);
    };

    await waitUntil(6);
    await updateEditorial("evidence", 6);
    await page.locator('[data-routine-card="short-recorded-endpoint"] summary').click();
    mark("evidence-open", 6);

    await activateAt(
      "evidence-close",
      12,
      page.locator('[data-routine-card="short-recorded-endpoint"] summary'),
    );

    await waitUntil(15);
    await updateEditorial("allocate", 15);
    const allocations = [
      ["short-add-1", 15, "숏 구역 전달 훈련 1회 추가"],
      ["short-add-2", 16, "숏 구역 전달 훈련 1회 추가"],
      ["short-add-3", 17, "숏 구역 전달 훈련 1회 추가"],
      ["short-add-4", 18, "숏 구역 전달 훈련 1회 추가"],
      ["short-add-5", 19, "숏 구역 전달 훈련 1회 추가"],
      ["aerial-add-1", 20, "비숏 · 공중 후속 기록 훈련 1회 추가"],
      ["aerial-add-2", 21, "비숏 · 공중 후속 기록 훈련 1회 추가"],
      ["aerial-add-3", 22, "비숏 · 공중 후속 기록 훈련 1회 추가"],
      ["aerial-add-4", 23, "비숏 · 공중 후속 기록 훈련 1회 추가"],
      ["other-add-1", 24, "비숏 · 기타 후속 기록 훈련 1회 추가"],
    ];
    for (const [id, scheduled, name] of allocations) {
      await activateAt(id, scheduled, page.getByRole("button", { name }));
    }

    await waitUntil(25);
    await updateEditorial("lock", 25);
    await page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" }).click();
    mark("training-lock", 25);

    await waitUntil(31);
    await updateEditorial("reveal", 31);
    await page.getByRole("button", { name: "가려 둔 맞대결 첫 전개 보기" }).click();
    mark("held-out-reveal", 31);

    await waitUntil(33);
    await scrollTo(page.getByTestId("scouting-result"));
    mark("result-view", 33);

    await waitUntil(42);
    await updateEditorial("receipts", 42);
    await scrollTo(page.locator(".receipt-grid"));
    mark("receipt-view", 42);

    await waitUntil(50);
    await updateEditorial("memo", 50);
    const meetingDecision = page.getByLabel("다음 회의에서 훈련 비중 재배분");
    await scrollTo(meetingDecision);
    await meetingDecision.check();
    mark("meeting-decision", 50);

    await waitUntil(52);
    await page.getByRole("textbox", { name: /이유/u }).fill(
      "비숏 전달 뒤 기타 후속 기록이 예상보다 2회 많아 재배분을 검토",
    );
    mark("meeting-reason", 52);

    await waitUntil(55);
    await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();
    mark("meeting-note-save", 55);

    await waitUntil(57);
    await updateEditorial("final", 57);
    await scrollTo(page.getByTestId("meeting-note-receipt"));
    mark("final-hold", 57);

    await waitUntil(59.9);
    const allocationValues = await page.locator(".user-row span").allTextContents();
    const heldOutValues = await page.locator(".actual-row span").allTextContents();
    const finalFrame = {
      allocation: `내 훈련 배분 ${allocationValues.join(" · ")}`,
      held_out: `실제 맞대결 ${heldOutValues.join(" · ")}`,
      differences: await page.locator(".difference-grid").innerText(),
      boundary: await page.locator(".result-boundary").innerText(),
      meeting_note: await page.getByTestId("meeting-note-receipt").innerText(),
    };
    const actionSchedule = actions.map(({ id, scheduled_seconds }) => [id, scheduled_seconds]);
    if (JSON.stringify(actionSchedule) !== JSON.stringify(exactDemoActions)) {
      throw new Error("recorded action ledger drifted from the canonical 20-event schedule");
    }
    const video = page.video();
    await context.close();
    const rawPath = await video.path();
    await copyFile(rawPath, videoPath);

    const [videoBytes, coldOpenBytes] = await Promise.all([
      readFile(videoPath),
      readFile(coldOpenPath),
    ]);
    const media = probe(videoPath);
    const manifest = {
      schema_version: 2,
      status: finalMode
        ? "frozen-public-visual-candidate-not-youtube-or-human-reviewed"
        : "local-timed-rehearsal-not-youtube-evidence",
      source: finalMode
        ? "exact frozen public deployment"
        : "current production build rendered locally",
      base_url: baseURL,
      capture_started_at: captureStartedAt,
      capture_completed_at: new Date().toISOString(),
      ...(finalMode ? { release: releaseEvidence } : {}),
      submission_story_sha256: sha256(storyBytes),
      release_manifest: {
        path: releaseManifestPath,
        sha256: sha256(releaseManifestBytes),
      },
      cold_open: {
        path: coldOpenPath,
        sha256: sha256(coldOpenBytes),
        bytes: coldOpenBytes.length,
        width: 1440,
        height: 900,
        source: finalMode ? "exact frozen public deployment" : "local release page",
      },
      editorial_treatment: {
        path: "docs/demo-editorial-treatment.json",
        sha256: sha256(editorialTreatmentBytes),
        status: editorialTreatment.status,
        label: editorialTreatment.label,
        transitions: editorialTransitions,
      },
      interaction_contract: story.video.interaction,
      video: {
        path: videoPath,
        sha256: sha256(videoBytes),
        bytes: videoBytes.length,
        audio: finalMode
          ? "none-frozen-public-visual-candidate"
          : "none-local-visual-rehearsal",
        ...media,
      },
      actions,
      final_frame: finalFrame,
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(
      `[PASS] ${finalMode ? "frozen-public visual candidate" : "60-second Corner Prep Lab rehearsal"}: ` +
      `duration=${media.duration_seconds.toFixed(3)}s events=${actions.length} sha256=${manifest.video.sha256}`,
    );
  } finally {
    await browser.close();
  }
} finally {
  preview?.kill("SIGTERM");
}
