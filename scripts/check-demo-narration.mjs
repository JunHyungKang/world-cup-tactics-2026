import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parsePairedFlags } from "./lib/cli.mjs";

const args = parsePairedFlags(process.argv.slice(2));
for (const flag of args.keys()) if (flag !== "--manifest") throw new Error(`unsupported narration audit flag: ${flag}`);
const manifestPath = args.get("--manifest") ?? "output/demo/narration-manifest.json";
const [storyBytes, narrationBytes, captionsBytes, editorialTreatmentBytes, demoScript, manifestText] = await Promise.all([
  readFile("docs/submission-story.json"), readFile("docs/policy-lab-demo-narration.json"),
  readFile("docs/policy-lab-demo-captions.ko.srt"), readFile("docs/demo-editorial-treatment.json"),
  readFile("docs/demo-script.md", "utf8"),
  readFile(manifestPath, "utf8"),
]);
const story = JSON.parse(storyBytes.toString("utf8"));
const narration = JSON.parse(narrationBytes.toString("utf8"));
const editorialTreatment = JSON.parse(editorialTreatmentBytes.toString("utf8"));
const manifest = JSON.parse(manifestText);
const visualManifestPath = manifest.visual_source?.manifest_path ?? "output/demo/rehearsal-manifest.json";
const visualManifestBytes = await readFile(visualManifestPath);
const visualManifest = JSON.parse(visualManifestBytes.toString("utf8"));
const finalMode = manifest.status === "final-upload-candidate-not-youtube-or-human-reviewed";
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const srtTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
};

check(narration.schema_version === 1 && narration.status === "local-tts-rehearsal-not-final-voice", "narration contract must remain local placeholder TTS");
check(narration.voice === "Yuna" && narration.locale === "ko_KR", "narration voice contract drifted");
check(narration.cues.length === story.video.beats.length, "narration must have one cue per story beat");
for (const [index, cue] of narration.cues.entries()) {
  const beat = story.video.beats[index];
  check(cue.id === beat.id && cue.start === beat.start && cue.end === beat.end, `narration cue ${index + 1} drifted from story timecodes`);
  check(cue.caption_end > cue.start && cue.caption_end <= cue.end, `narration cue ${cue.id} caption end is invalid`);
  check(typeof cue.text === "string" && cue.text.length > 5, `narration cue ${cue.id} is empty`);
  const captionLines = (cue.caption ?? cue.text).split("\n");
  check(captionLines.length <= 2 && captionLines.every((line) => line.length <= 34), `narration cue ${cue.id} caption exceeds the two-line readability contract`);
  check(demoScript.includes(`\`${cue.text}\``), `demo script narration drifted for cue ${cue.id}`);
  for (const forbidden of story.claim_boundary.forbidden) check(!cue.text.includes(forbidden), `narration cue ${cue.id} contains forbidden claim: ${forbidden}`);
}
const expectedCaptions = narration.cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.caption_end)}\n${cue.caption ?? cue.text}`).join("\n\n");
check(captionsBytes.toString("utf8").trim() === expectedCaptions, "Korean SRT captions drifted from the narration contract");

check(finalMode || manifest.status === "local-narrated-rehearsal-not-youtube-or-human-evidence", "narrated rehearsal status is unsafe");
check(manifest.submission_story_sha256 === digest(storyBytes), "narrated rehearsal story SHA mismatch");
check(manifest.narration_contract_sha256 === digest(narrationBytes), "narration contract SHA mismatch");
check(manifest.captions_sha256 === digest(captionsBytes), "caption SHA mismatch");
check(manifest.editorial_treatment?.path === "docs/demo-editorial-treatment.json", "editorial treatment path drifted");
check(manifest.editorial_treatment?.sha256 === digest(editorialTreatmentBytes), "editorial treatment SHA mismatch");
check(manifest.editorial_treatment?.status === editorialTreatment.status, "editorial treatment status drifted");
check(manifest.editorial_treatment?.label === "[편집 요약]", "editorial treatment disclosure label drifted");
check(manifest.captions?.path === "docs/policy-lab-demo-captions.ko.srt", "burned-in caption source path drifted");
check(manifest.captions?.sha256 === digest(captionsBytes), "burned-in caption byte binding mismatch");
check(manifest.captions?.presentation === "burned-in" && manifest.captions?.font === "Apple SD Gothic Neo", "narrated video must burn in the bound Korean captions");
check(manifest.captions?.font_source === "macOS system /System/Library/Fonts/AppleSDGothicNeo.ttc", "caption font source drifted");
check(manifest.captions?.font_size === 18 && manifest.captions?.safe_margin_vertical_pixels === 38, "caption legibility treatment drifted");
check(manifest.visual_source.sha256 === visualManifest.video.sha256, "narrated rehearsal visual source drifted");
check(manifest.visual_source.manifest_path === visualManifestPath, "narrated visual manifest path drifted");
check(manifest.visual_source.manifest_sha256 === digest(visualManifestBytes), "narrated visual manifest SHA mismatch");
check(manifest.voice.status === (finalMode ? "placeholder-tts-requires-human-listening-approval" : "placeholder-local-tts-not-final-voice"), "TTS evidence boundary drifted");
check(Number.isFinite(manifest.video_start_normalization?.source_frame_seconds) &&
  manifest.video_start_normalization.source_frame_seconds >= 0 &&
  manifest.video_start_normalization.source_frame_seconds <= 2 &&
  manifest.video_start_normalization?.held_duration_seconds === 0.2 &&
  manifest.video_start_normalization?.purpose === "replace-browser-capture-startup-flash-with-first-complete-cold-open-frame",
"narrated video must replace browser-capture startup frames with the first complete cold-open frame");
check(manifest.video_start_normalization?.detection?.method === "gallery-frame-mean-absolute-error" &&
  manifest.video_start_normalization.detection.sourceFrameSeconds === manifest.video_start_normalization.source_frame_seconds &&
  manifest.video_start_normalization.detection.detectedMeanAbsoluteError <= manifest.video_start_normalization.detection.maximumMeanAbsoluteError &&
  manifest.video_start_normalization.detection.maximumMeanAbsoluteError === 8 &&
  manifest.video_start_normalization.detection.framesPerSecond === 10,
"narrated video must bind its startup trim to the detected complete gallery frame");
check(manifest.audio_mastering?.target_integrated_lufs === -16, "audio mastering LUFS target drifted");
check(manifest.audio_mastering?.target_true_peak_dbfs === -1.5, "audio mastering true-peak target drifted");
check(manifest.audio_mastering?.highpass_hz === 80 && manifest.audio_mastering?.compressor_ratio === 3, "audio mastering speech chain drifted");
if (finalMode) {
  check(visualManifest.status === "frozen-public-visual-candidate-not-youtube-or-human-reviewed", "final narrated candidate lacks frozen-public visual evidence");
  check(manifest.source?.deployed_url === visualManifest.base_url, "final narrated source URL drifted");
  check(manifest.source?.release_commit === visualManifest.release?.release_commit, "final narrated release commit drifted");
  check(manifest.source?.build_sha256 === visualManifest.release?.build_sha256, "final narrated build digest drifted");
  check(manifest.source?.deployed_marker_sha256 === visualManifest.release?.deployed_marker_sha256, "final narrated marker digest drifted");
  check(JSON.stringify(manifest.source?.cold_open) === JSON.stringify(visualManifest.cold_open), "final narrated cold-open binding drifted");
}

for (const [index, cue] of manifest.cues.entries()) {
  const contract = narration.cues[index];
  const bytes = await readFile(cue.path);
  check(cue.sha256 === digest(bytes) && cue.bytes === bytes.length, `narration cue ${cue.id} byte binding mismatch`);
  check(cue.duration_seconds > 0 && cue.duration_seconds <= contract.end - contract.start - 0.3, `narration cue ${cue.id} does not fit its beat`);
  check(contract.start + 0.2 + cue.duration_seconds <= contract.caption_end, `narration cue ${cue.id} outlasts its caption`);
}

const narratedBytes = await readFile(manifest.narrated_video.path);
check(manifest.narrated_video.sha256 === digest(narratedBytes) && manifest.narrated_video.bytes === narratedBytes.length, "narrated video byte binding mismatch");
const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height:format=duration:format_tags=title,comment", "-of", "json", manifest.narrated_video.path], { encoding: "utf8" });
check(probe.status === 0, "ffprobe could not inspect narrated rehearsal");
if (probe.status === 0) {
  const media = JSON.parse(probe.stdout);
  const video = media.streams.find((stream) => stream.codec_type === "video");
  const audio = media.streams.find((stream) => stream.codec_type === "audio");
  check(Number(media.format.duration) >= 59.8 && Number(media.format.duration) <= 60, "narrated rehearsal must remain at or below 60 seconds");
  check(video?.width === 1440 && video?.height === 900 && video?.codec_name === "vp8", "narrated rehearsal visual stream drifted");
  check(audio?.codec_name === "opus", "narrated rehearsal requires an Opus audio stream");
  const expectedTitle = finalMode ? "FINAL UPLOAD CANDIDATE — HUMAN REVIEW PENDING" : "LOCAL REHEARSAL — NOT FINAL";
  check(media.format.tags?.title === expectedTitle, "narrated video standalone title tag drifted");
  check(media.format.tags?.COMMENT?.includes("not YouTube or human evidence") || media.format.tags?.comment?.includes("not YouTube or human evidence") ||
    media.format.tags?.COMMENT?.includes("Not YouTube or human evidence") || media.format.tags?.comment?.includes("Not YouTube or human evidence"), "narrated rehearsal lacks a standalone evidence-boundary comment tag");
}
check(manifest.narrated_video.standalone_label === (finalMode ? "FINAL UPLOAD CANDIDATE — HUMAN REVIEW PENDING" : "LOCAL REHEARSAL — NOT FINAL"), "narrated rehearsal manifest lacks standalone labeling");

const firstFrame = spawnSync("ffmpeg", [
  "-v", "error", "-i", manifest.narrated_video.path,
  "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
], { encoding: null, maxBuffer: 5_000_000 });
check(firstFrame.status === 0 && Buffer.isBuffer(firstFrame.stdout) && firstFrame.stdout.length === 1440 * 900 * 3,
  "ffmpeg could not decode the first narrated-video frame");
if (firstFrame.status === 0 && Buffer.isBuffer(firstFrame.stdout) && firstFrame.stdout.length === 1440 * 900 * 3) {
  let sum = 0;
  let squared = 0;
  for (const value of firstFrame.stdout) {
    sum += value;
    squared += value * value;
  }
  const mean = sum / firstFrame.stdout.length;
  const standardDeviation = Math.sqrt(squared / firstFrame.stdout.length - mean * mean);
  check(mean >= 5 && mean <= 180 && standardDeviation >= 8,
    `first narrated-video frame is blank or flash-prone: mean=${mean.toFixed(2)} stddev=${standardDeviation.toFixed(2)}`);
}

const loudness = spawnSync("ffmpeg", [
  "-nostats", "-i", manifest.narrated_video.path,
  "-filter_complex", "ebur128=peak=true", "-f", "null", "-",
], { encoding: "utf8" });
check(loudness.status === 0, "ffmpeg could not measure narrated audio loudness");
if (loudness.status === 0) {
  const summary = loudness.stderr.slice(loudness.stderr.lastIndexOf("Summary:"));
  const integratedMatch = summary.match(/I:\s+(-?\d+(?:\.\d+)?) LUFS/u);
  const truePeakMatch = summary.match(/Peak:\s+(-?\d+(?:\.\d+)?) dBFS/u);
  const integrated = integratedMatch ? Number(integratedMatch[1]) : Number.NaN;
  const truePeak = truePeakMatch ? Number(truePeakMatch[1]) : Number.NaN;
  check(Number.isFinite(integrated) && integrated >= -17.5 && integrated <= -14.5, `narrated audio integrated loudness is outside the professional speech window: ${integrated}`);
  check(Number.isFinite(truePeak) && truePeak <= -1, `narrated audio true peak is unsafe: ${truePeak}`);
}

if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}
console.log(`[PASS] ${finalMode ? "final narrated upload candidate" : "narrated demo rehearsal"}: eight fitted Korean cues, disclosed editorial HUD, mastered audio, burned-in captions, sub-60-second VP8/Opus output`);
