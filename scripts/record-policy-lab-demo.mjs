import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseURL = "http://127.0.0.1:4175";
const outputDirectory = "output/policy-lab-demo";
const rawVideoPath = `${outputDirectory}/corner-policy-lab-60s-visual.webm`;
const narratedVideoPath = `${outputDirectory}/corner-policy-lab-60s-narrated.webm`;
const visualManifestPath = `${outputDirectory}/visual-manifest.json`;
const narrationManifestPath = `${outputDirectory}/narration-manifest.json`;
const narrationPath = "docs/policy-lab-demo-narration.json";
const releaseManifestPath = "dist-policy-lab/release-manifest.json";
const submissionStoryPath = "docs/submission-story.json";
const node = process.execPath;

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout;
}

function probe(path) {
  const value = JSON.parse(run("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height:format=duration", "-of", "json", path,
  ]));
  return { duration_seconds: Number(value.format.duration), streams: value.streams };
}

function srtTime(seconds) {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(baseURL, { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Policy Lab release server did not become ready");
}

await mkdir(`${outputDirectory}/raw`, { recursive: true });
await mkdir(`${outputDirectory}/narration`, { recursive: true });
await mkdir(`${outputDirectory}/qa`, { recursive: true });
const releaseBytes = await readFile(releaseManifestPath);
const submissionStoryBytes = await readFile(submissionStoryPath);
const submissionStory = JSON.parse(submissionStoryBytes.toString("utf8"));
if (submissionStory.product_id !== "corner-policy-lab") throw new Error("canonical submission story is not Policy Lab");
const release = JSON.parse(releaseBytes.toString("utf8"));
if (release.release_status !== "candidate-public" || release.causal_recommendation_status !== "REJECT" || release.empirical_campaign_status !== "REVISE") {
  throw new Error("Policy Lab release claim boundary is not recordable");
}
const server = spawn(node, ["scripts/serve-policy-release.mjs"], { stdio: "inherit" });

try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: `${outputDirectory}/raw`, size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.getByRole("heading", { name: /조별리그에서 세우고/u }).waitFor();
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
    const scrollTo = async (locator) => locator.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));

    await waitUntil(5);
    await page.locator('.lane-card[data-lane="short"]').click();
    mark("priority-short", 5);
    await waitUntil(8);
    await page.locator('.lane-card[data-lane="near"]').click();
    mark("priority-near", 8);
    await waitUntil(12);
    await page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" }).click();
    mark("policy-lock", 12);
    await waitUntil(16);
    await page.getByRole("button", { name: "16강 8경기 평가 요약 공개" }).click();
    mark("r16-reveal", 16);
    await waitUntil(18);
    await scrollTo(page.getByTestId("counterexample"));
    mark("r16-summary", 18);
    await waitUntil(30);
    await page.getByRole("button", { name: "같은 정책으로 봉인 검증 8경기 공개" }).click();
    mark("final-reveal", 30);
    await waitUntil(34);
    await page.getByTestId("final-receipt").waitFor();
    mark("final-receipt", 34);
    await waitUntil(38);
    await scrollTo(page.locator('[data-action="save-meeting-note"]'));
    mark("meeting-note-view", 38);
    await waitUntil(42);
    await page.getByLabel("판단 보류").check();
    mark("meeting-decision", 42);
    await waitUntil(45);
    await page.getByLabel("이유 (120자 이내)").fill("봉인 검증만으로 우선 구역을 바꾸지 않고 다음 미팅에서 판단");
    mark("meeting-reason", 45);
    await waitUntil(48);
    await page.getByRole("button", { name: "다음 미팅 메모 저장" }).click();
    mark("meeting-note-save", 48);
    await waitUntil(59.8);
    const finalReceipt = await page.getByTestId("final-receipt").innerText();
    const meetingNote = await page.getByTestId("meeting-note-receipt").innerText();
    const video = page.video();
    await context.close();
    const recordedPath = await video.path();
    await copyFile(recordedPath, rawVideoPath);
    const rawBytes = await readFile(rawVideoPath);
    const rawMedia = probe(rawVideoPath);
    if (rawMedia.duration_seconds < 59.5 || rawMedia.duration_seconds > 61.5) throw new Error(`visual duration out of range: ${rawMedia.duration_seconds}`);
    if (rawMedia.streams.find((stream) => stream.codec_type === "video")?.width !== 1440) throw new Error("visual width drifted");
    const visualManifest = {
      schema_version: 1,
      status: "local-static-release-rehearsal-not-youtube-or-human-evidence",
      submission_story: { path: submissionStoryPath, sha256: digest(submissionStoryBytes) },
      release_manifest: { path: releaseManifestPath, sha256: digest(releaseBytes) },
      capture_started_at: new Date(Date.now() - Math.round(rawMedia.duration_seconds * 1000)).toISOString(),
      capture_completed_at: new Date().toISOString(),
      actions,
      interaction_contract: { activations: 7, policy_locks: 1, explicit_scrolls: 2, final_receipt_target_seconds: 45, meeting_note_target_seconds: 52 },
      final_receipt: finalReceipt,
      meeting_note: meetingNote,
      video: { path: rawVideoPath, sha256: digest(rawBytes), bytes: rawBytes.length, audio: "none-local-visual-rehearsal", ...rawMedia },
    };
    await writeFile(visualManifestPath, `${JSON.stringify(visualManifest, null, 2)}\n`);
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}

const narrationBytes = await readFile(narrationPath);
const narration = JSON.parse(narrationBytes.toString("utf8"));
const cueReports = [];
for (const [index, cue] of narration.cues.entries()) {
  const path = `${outputDirectory}/narration/${String(index + 1).padStart(2, "0")}-${cue.id}.aiff`;
  run("say", ["-v", narration.voice, "-r", String(narration.rate_words_per_minute), "-o", path, cue.text]);
  const bytes = await readFile(path);
  const duration = probe(path).duration_seconds;
  if (duration > cue.end - cue.start - 0.25) throw new Error(`narration cue does not fit: ${cue.id}`);
  cueReports.push({ id: cue.id, path, start: cue.start, end: cue.end, duration_seconds: duration, sha256: digest(bytes), bytes: bytes.length });
}
const srt = narration.cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.caption_end)}\n${cue.text}`).join("\n\n") + "\n";
const srtPath = `${outputDirectory}/corner-policy-lab.ko.srt`;
await writeFile(srtPath, srt);
const inputArgs = cueReports.flatMap((cue) => ["-i", cue.path]);
const delayed = cueReports.map((cue, index) => {
  const milliseconds = Math.round((cue.start + 0.15) * 1000);
  return `[${index}:a]adelay=${milliseconds}|${milliseconds}[a${index}]`;
});
const mixInputs = cueReports.map((_, index) => `[a${index}]`).join("");
const audioPath = `${outputDirectory}/narration/corner-policy-lab-narration.wav`;
run("ffmpeg", ["-y", ...inputArgs, "-filter_complex", `${delayed.join(";")};${mixInputs}amix=inputs=${cueReports.length}:duration=longest:normalize=0,apad=pad_dur=60,atrim=0:59.5[a]`, "-map", "[a]", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", audioPath]);
run("ffmpeg", [
  "-y", "-i", rawVideoPath, "-i", audioPath, "-map", "0:v:0", "-map", "1:a:0",
  "-vf", `subtitles=${srtPath}:force_style='FontName=D2Coding,FontSize=8,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,OutlineColour=&H00000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=15'`,
  "-c:v", "libvpx", "-b:v", "3M", "-c:a", "libopus", "-b:a", "96k", "-t", "59.5",
  "-metadata", "title=CORNER POLICY LAB - LOCAL REHEARSAL - NOT FINAL", "-metadata", "comment=Static local candidate; not YouTube or human evidence", narratedVideoPath,
]);
const narratedBytes = await readFile(narratedVideoPath);
const narratedMedia = probe(narratedVideoPath);
const srtBytes = await readFile(srtPath);
const audioBytes = await readFile(audioPath);
const visualManifestBytes = await readFile(visualManifestPath);
const narrationManifest = {
  schema_version: 1,
  status: "local-narrated-static-release-rehearsal-not-youtube-or-human-evidence",
  submission_story: { path: submissionStoryPath, sha256: digest(submissionStoryBytes) },
  visual_source: { path: visualManifestPath, sha256: digest(visualManifestBytes), video_sha256: JSON.parse(visualManifestBytes).video.sha256 },
  narration_contract: { path: narrationPath, sha256: digest(narrationBytes), voice: narration.voice, locale: narration.locale, rate_words_per_minute: narration.rate_words_per_minute },
  captions: { path: srtPath, sha256: digest(srtBytes), bytes: srtBytes.length, mode: "burned-in-and-byte-bound-sidecar" },
  cues: cueReports,
  mixed_audio: { path: audioPath, sha256: digest(audioBytes), bytes: audioBytes.length },
  narrated_video: { path: narratedVideoPath, sha256: digest(narratedBytes), bytes: narratedBytes.length, standalone_label: "LOCAL REHEARSAL - NOT FINAL", ...narratedMedia },
};
await writeFile(narrationManifestPath, `${JSON.stringify(narrationManifest, null, 2)}\n`);
for (const seconds of [2, 8, 20, 38, 45, 55, 59]) {
  run("ffmpeg", ["-y", "-v", "error", "-ss", String(seconds), "-i", narratedVideoPath, "-frames:v", "1", `${outputDirectory}/qa/${String(seconds).padStart(2, "0")}.png`]);
}
console.log(`[PASS] Policy Lab narrated rehearsal: ${narratedMedia.duration_seconds.toFixed(3)}s sha256=${digest(narratedBytes)}`);
