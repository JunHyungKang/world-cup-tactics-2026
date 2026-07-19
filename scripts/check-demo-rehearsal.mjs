import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parsePairedFlags } from "./lib/cli.mjs";
import { parseDeploymentUrl } from "./lib/final-submission.mjs";

const args = parsePairedFlags(process.argv.slice(2));
for (const flag of args.keys()) if (flag !== "--manifest") throw new Error(`unsupported demo audit flag: ${flag}`);
const manifestPath = args.get("--manifest") ?? "output/demo/rehearsal-manifest.json";
const storyBytes = await readFile("docs/submission-story.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const videoBytes = await readFile(manifest.video.path);
const coldOpenBytes = await readFile(manifest.cold_open.path);
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const finalMode = manifest.status === "frozen-public-visual-candidate-not-youtube-or-human-reviewed";

check(manifest.schema_version === 1, "rehearsal schema_version must be 1");
check(finalMode || manifest.status === "local-timed-rehearsal-not-youtube-evidence", "demo recording status is unsafe");
check(manifest.submission_story_sha256 === digest(storyBytes), "rehearsal story binding mismatch");
check(manifest.cold_open.path === "docs/assets/gallery/corner-war-room-first-image.png", "rehearsal cold-open path drifted");
check(manifest.cold_open.sha256 === digest(coldOpenBytes), "rehearsal cold-open SHA mismatch");
check(manifest.cold_open.duration_seconds === 5, "rehearsal cold-open duration must be five seconds");
check(finalMode || manifest.video.path === "output/demo/corner-war-room-60s-rehearsal.webm", "rehearsal video path drifted");
check(manifest.video.sha256 === digest(videoBytes), "rehearsal video SHA mismatch");
check(manifest.video.bytes === videoBytes.length, "rehearsal video byte length mismatch");
check(manifest.video.audio === (finalMode ? "none-frozen-public-visual-candidate" : "none-local-visual-rehearsal"), "demo visual must disclose that it has no narration track");

if (finalMode) {
  try {
    check(manifest.base_url === parseDeploymentUrl(manifest.base_url), "final demo base URL must be canonical public HTTPS");
  } catch (error) {
    errors.push(`final demo base URL is invalid: ${error.message}`);
  }
  check(/^[0-9a-f]{40}$/u.test(manifest.release?.release_commit ?? ""), "final demo release commit is invalid");
  check(/^[0-9a-f]{64}$/u.test(manifest.release?.build_sha256 ?? ""), "final demo build digest is invalid");
  check(manifest.release?.deployment_parity === "PASS", "final demo deployment parity is not PASS");
  try {
    const markerBytes = await readFile(manifest.release.local_marker_path);
    const marker = JSON.parse(markerBytes.toString("utf8"));
    const markerSha = digest(markerBytes);
    check(markerSha === manifest.release.local_marker_sha256, "final demo local marker SHA mismatch");
    check(markerSha === manifest.release.deployed_marker_sha256, "final demo deployed marker SHA mismatch");
    check(marker.releaseCommit === manifest.release.release_commit, "final demo marker release commit mismatch");
    check(marker.buildSha256 === manifest.release.build_sha256, "final demo marker build digest mismatch");
  } catch (error) {
    errors.push(`final demo release marker is unavailable: ${error.message}`);
  }
  const started = Date.parse(manifest.capture_started_at);
  const completed = Date.parse(manifest.capture_completed_at);
  check(Number.isFinite(started) && Number.isFinite(completed) && completed >= started, "final demo capture timestamps are invalid");
}

const probe = spawnSync("ffprobe", [
  "-v", "error", "-select_streams", "v:0", "-show_entries",
  "stream=codec_name,width,height:format=duration", "-of", "json", manifest.video.path,
], { encoding: "utf8" });
check(probe.status === 0, "ffprobe could not inspect rehearsal video");
if (probe.status === 0) {
  const media = JSON.parse(probe.stdout);
  const duration = Number(media.format.duration);
  const stream = media.streams[0];
  check(duration >= 59.5 && duration <= 61.5, `rehearsal duration outside 59.5–61.5 seconds: ${duration}`);
  check(Math.abs(duration - manifest.video.duration_seconds) < 0.01, "rehearsal duration manifest drifted");
  check(stream.codec_name === manifest.video.codec, "rehearsal codec manifest drifted");
  check(stream.width === 1440 && stream.height === 900, "rehearsal resolution must be 1440x900");
}

const expectedActions = [
  ["commit", 5], ["replay", 12], ["replay-pitch", 13],
  ["replay-receipt", 22], ["separate-hold", 25], ["reverse", 32],
  ["reset", 34], ["counterexample", 38], ["counterexample-pitch", 39],
  ["counterexample-receipt", 48], ["final-hold", 55],
];
check(Array.isArray(manifest.actions) && manifest.actions.length === expectedActions.length, "rehearsal action ledger must contain eleven bound interaction/view events");
for (const [index, [id, scheduled]] of expectedActions.entries()) {
  const action = manifest.actions?.[index];
  check(action?.id === id && action?.scheduled_seconds === scheduled, `rehearsal action ${index + 1} drifted`);
  check(action?.actual_seconds >= scheduled && action?.actual_seconds <= scheduled + 1.5, `rehearsal action ${id} missed its 1.5-second window`);
}
check(manifest.reset_status === "처음 상태로 돌아왔습니다. 과거 기록과 고정 집계는 그대로입니다.", "reset proof is missing or stale");
check(manifest.final_frame?.heading === "이 선택으로 설명되지 않는 슈팅 기록", "final frame must hold the counterexample heading");
check(manifest.final_frame?.verdict?.includes("이 선택이 슈팅을 막았을지는 알 수 없습니다"), "final frame must preserve the prevention boundary");
check(manifest.final_frame?.transcript?.includes("선택 구역과 겹치지 않음"), "final frame must show non-contact state");
check(manifest.final_frame?.transcript?.includes("이벤트 #"), "final frame must show a source event ID");
check(manifest.final_frame?.semantic_snapshot?.windowKind === "counterexample", "final semantic state must be counterexample");

if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}
console.log(`[PASS] ${finalMode ? "frozen-public demo visual" : "timed demo rehearsal"}: ${manifest.video.duration_seconds.toFixed(3)}s, eleven on-time interaction/view events, counterexample final frame`);
