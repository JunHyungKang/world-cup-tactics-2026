import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const visualManifestPath = "output/policy-lab-demo/visual-manifest.json";
const narrationManifestPath = "output/policy-lab-demo/narration-manifest.json";
const narrationContractPath = "docs/policy-lab-demo-narration.json";
const releaseManifestPath = "dist-policy-lab/release-manifest.json";
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function srtTime(seconds) {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function probe(path) {
  const result = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height:format=duration:format_tags=title,comment", "-of", "json", path,
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`ffprobe failed for ${path}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

const [visualBytes, narratedManifestBytes, narrationBytes, releaseBytes] = await Promise.all([
  readFile(visualManifestPath), readFile(narrationManifestPath), readFile(narrationContractPath), readFile(releaseManifestPath),
]);
const visual = JSON.parse(visualBytes);
const narrated = JSON.parse(narratedManifestBytes);
const narration = JSON.parse(narrationBytes);
const release = JSON.parse(releaseBytes);
check(visual.status === "local-static-release-rehearsal-not-youtube-or-human-evidence", "visual status must remain local rehearsal");
check(narrated.status === "local-narrated-static-release-rehearsal-not-youtube-or-human-evidence", "narrated status must remain local rehearsal");
check(visual.release_manifest.sha256 === digest(releaseBytes), "visual release manifest SHA drifted");
check(release.causal_recommendation_status === "REJECT" && release.empirical_campaign_status === "REVISE", "release claim boundary drifted");
check(narrated.visual_source.sha256 === digest(visualBytes), "narrated visual manifest SHA drifted");
check(narrated.narration_contract.sha256 === digest(narrationBytes), "narration contract SHA drifted");

const expectedActions = [
  ["priority-short", 5], ["priority-near", 8], ["minimum-overlap", 10], ["policy-lock", 12], ["r16-reveal", 16],
  ["r16-summary", 18], ["final-reveal", 30], ["final-receipt", 34],
  ["meeting-note-view", 38], ["meeting-decision", 42], ["meeting-reason", 45],
  ["meeting-note-save", 48],
];
check(visual.actions.length === expectedActions.length, "visual action count drifted");
for (const [index, [id, scheduled]] of expectedActions.entries()) {
  const action = visual.actions[index];
  check(action?.id === id && action?.scheduled_seconds === scheduled, `visual action ${index + 1} contract drifted`);
  check(Math.abs((action?.actual_seconds ?? 99) - scheduled) <= 0.25, `visual action ${id} missed its timing window`);
}
check(visual.final_receipt.includes("사전 기준 충족") && visual.final_receipt.includes("사전 위치 겹침 기준 50%") && visual.final_receipt.includes("정책 변경 0회") && visual.final_receipt.includes("16강과 공개하지 않고 남겨 둔 8강 이후 8경기에 그대로 적용"), "final receipt boundary drifted");
check(visual.meeting_note.includes("다음 미팅에서 우선 구역 수정") && visual.meeting_note.includes("정책 변경 0회") && visual.meeting_note.includes("검증 결과는 그대로"), "next-meeting note boundary drifted");
check(visual.interaction_contract?.activations === 8 && visual.interaction_contract?.policy_locks === 1 && visual.interaction_contract?.explicit_scrolls === 2, "one-lock interaction contract drifted");
check(visual.actions.find((action) => action.id === "final-receipt")?.actual_seconds <= 45.25, "final receipt missed the 45-second judge target");
check(visual.actions.find((action) => action.id === "meeting-note-save")?.actual_seconds <= 52.25, "next-meeting note missed the 52-second judge target");

const rawBytes = await readFile(visual.video.path);
check(visual.video.sha256 === digest(rawBytes) && visual.video.bytes === rawBytes.length, "visual video byte binding drifted");
const rawMedia = probe(visual.video.path);
const rawVideo = rawMedia.streams.find((stream) => stream.codec_type === "video");
check(Number(rawMedia.format.duration) >= 59.5 && Number(rawMedia.format.duration) <= 61.5, "visual duration is not 60 seconds");
check(rawVideo?.codec_name === "vp8" && rawVideo.width === 1440 && rawVideo.height === 900, "visual stream contract drifted");

check(narration.schema_version === 1 && narration.status === "local-tts-rehearsal-not-final-voice", "narration contract status drifted");
check(narration.cues.length === 8 && narrated.cues.length === 8, "narration cue count drifted");
const expectedSrt = narration.cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.caption_end)}\n${cue.text}`).join("\n\n") + "\n";
const captionBytes = await readFile(narrated.captions.path);
check(captionBytes.toString("utf8") === expectedSrt, "Korean captions drifted from narration cues");
check(narrated.captions.sha256 === digest(captionBytes) && narrated.captions.bytes === captionBytes.length, "caption byte binding drifted");
check(narrated.captions.mode === "burned-in-and-byte-bound-sidecar", "caption delivery mode drifted");
for (const [index, cue] of narrated.cues.entries()) {
  const bytes = await readFile(cue.path);
  const contract = narration.cues[index];
  check(cue.id === contract.id && cue.sha256 === digest(bytes) && cue.bytes === bytes.length, `narration cue ${index + 1} byte binding drifted`);
  check(cue.duration_seconds > 0 && cue.duration_seconds <= contract.end - contract.start - 0.25, `narration cue ${cue.id} does not fit`);
}
for (const forbidden of ["수비 성공", "위험도", "보상", "강화학습이 학습했다", "최적 전술", "경기 결과를 바꿨다"]) {
  check(!narration.cues.some((cue) => cue.text.includes(forbidden)), `narration contains forbidden claim: ${forbidden}`);
}

const narratedBytes = await readFile(narrated.narrated_video.path);
check(narrated.narrated_video.sha256 === digest(narratedBytes) && narrated.narrated_video.bytes === narratedBytes.length, "narrated video byte binding drifted");
const narratedMedia = probe(narrated.narrated_video.path);
const video = narratedMedia.streams.find((stream) => stream.codec_type === "video");
const audio = narratedMedia.streams.find((stream) => stream.codec_type === "audio");
check(Number(narratedMedia.format.duration) >= 59.4 && Number(narratedMedia.format.duration) <= 60, "narrated duration must remain at or below 60 seconds");
check(video?.codec_name === "vp8" && video.width === 1440 && video.height === 900 && audio?.codec_name === "opus", "narrated stream contract drifted");
check(narratedMedia.format.tags?.title === "CORNER POLICY LAB - LOCAL REHEARSAL - NOT FINAL", "standalone local label drifted");

if (errors.length) {
  console.error(errors.map((error) => `[FAIL] ${error}`).join("\n"));
  process.exit(1);
}
console.log(`[PASS] Policy Lab demo audit: ${Number(narratedMedia.format.duration).toFixed(3)}s, 12 timed events, 8 activations, 1 policy lock, 8 fitted cues, burned captions, SHA=${narrated.narrated_video.sha256}`);
