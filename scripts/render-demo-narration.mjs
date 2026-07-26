import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parsePairedFlags } from "./lib/cli.mjs";

const args = parsePairedFlags(process.argv.slice(2));
const allowedFlags = new Set(["--visual-manifest", "--output", "--manifest"]);
for (const flag of args.keys()) if (!allowedFlags.has(flag)) throw new Error(`unsupported narration flag: ${flag}`);
const finalMode = args.size > 0;
const visualManifestPath = finalMode ? args.get("--visual-manifest") : "output/demo/rehearsal-manifest.json";
const narratedPath = finalMode ? args.get("--output") : "output/demo/corner-policy-lab-60s-narrated-rehearsal.webm";
const outputManifestPath = finalMode ? args.get("--manifest") : "output/demo/narration-manifest.json";
if (!visualManifestPath || !narratedPath || !outputManifestPath) {
  throw new Error("final narration requires --visual-manifest, --output, and --manifest");
}
const visualManifestBytes = await readFile(visualManifestPath);
const visualManifest = JSON.parse(visualManifestBytes.toString("utf8"));
if (finalMode && visualManifest.status !== "frozen-public-visual-candidate-not-youtube-or-human-reviewed") {
  throw new Error("final narration requires a frozen-public visual manifest");
}
const visualPath = visualManifest.video.path;
const outputDirectory = finalMode ? `${dirname(narratedPath)}/narration-audio` : "output/demo/narration";
const narration = JSON.parse(await readFile("docs/policy-lab-demo-narration.json", "utf8"));
const storyBytes = await readFile("docs/submission-story.json");
const narrationBytes = await readFile("docs/policy-lab-demo-narration.json");
const captionsBytes = await readFile("docs/policy-lab-demo-captions.ko.srt");
const editorialTreatmentBytes = await readFile("docs/demo-editorial-treatment.json");
const editorialTreatment = JSON.parse(editorialTreatmentBytes.toString("utf8"));
const visualBytes = await readFile(visualPath);
const outputDurationSeconds = 59.92;
const videoStartNormalization = {
  source_frame_seconds: 0.2,
  held_duration_seconds: 0.2,
  purpose: "replace-browser-capture-startup-flash-with-first-complete-cold-open-frame",
};
const captionFilter = "subtitles=filename=docs/policy-lab-demo-captions.ko.srt:force_style='FontName=Apple SD Gothic Neo,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&H90000000,Outline=1,Shadow=0,MarginV=38,Alignment=2'";
const videoFilter = [
  "[0:v]split=2[head-source][tail-source]",
  `[head-source]trim=start=${videoStartNormalization.source_frame_seconds}:end=0.24,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.16,trim=duration=${videoStartNormalization.held_duration_seconds}[head]`,
  `[tail-source]trim=start=${videoStartNormalization.source_frame_seconds},setpts=PTS-STARTPTS[tail]`,
  `[head][tail]concat=n=2:v=1:a=0[stitched]`,
  `[stitched]${captionFilter}[video]`,
].join(";");
const audioMastering = {
  target_integrated_lufs: -16,
  target_true_peak_dbfs: -1.5,
  target_loudness_range_lu: 7,
  highpass_hz: 80,
  compressor_ratio: 3,
};

function run(command, argv) {
  const result = spawnSync(command, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout;
}

function probe(path) {
  const value = JSON.parse(run("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height:format=duration:format_tags=title,comment",
    "-of", "json", path,
  ]));
  return {
    duration_seconds: Number(value.format.duration),
    streams: value.streams,
    tags: value.format.tags ?? {},
  };
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(dirname(outputManifestPath), { recursive: true });
const cueReports = [];
for (const [index, cue] of narration.cues.entries()) {
  const path = `${outputDirectory}/${String(index + 1).padStart(2, "0")}-${cue.id}.aiff`;
  run("say", ["-v", narration.voice, "-r", String(narration.rate_words_per_minute), "-o", path, cue.text]);
  const bytes = await readFile(path);
  const media = probe(path);
  if (bytes.length <= 4096 || !Number.isFinite(media.duration_seconds) || media.duration_seconds <= 0) {
    throw new Error(`narration cue contains no audio: ${cue.id}; rerun with macOS speech access`);
  }
  if (media.duration_seconds > cue.end - cue.start - 0.3) {
    throw new Error(`narration cue does not fit its beat: ${cue.id}`);
  }
  cueReports.push({
    id: cue.id, path, start: cue.start, end: cue.end,
    duration_seconds: media.duration_seconds,
    sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  });
}

const inputArgs = cueReports.flatMap((cue) => ["-i", cue.path]);
const delayed = cueReports.map((cue, index) => {
  const milliseconds = Math.round((cue.start + 0.2) * 1000);
  return `[${index}:a]adelay=${milliseconds}|${milliseconds}[a${index}]`;
});
const mixInputs = cueReports.map((_, index) => `[a${index}]`).join("");
const filter = `${delayed.join(";")};${mixInputs}amix=inputs=${cueReports.length}:duration=longest:normalize=0,highpass=f=${audioMastering.highpass_hz},acompressor=threshold=0.125:ratio=${audioMastering.compressor_ratio}:attack=5:release=80,loudnorm=I=${audioMastering.target_integrated_lufs}:TP=${audioMastering.target_true_peak_dbfs}:LRA=${audioMastering.target_loudness_range_lu},apad=pad_dur=60,atrim=0:${outputDurationSeconds}[a]`;
const wavPath = `${outputDirectory}/corner-policy-lab-narration.wav`;
run("ffmpeg", ["-y", ...inputArgs, "-filter_complex", filter, "-map", "[a]", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wavPath]);
run("ffmpeg", [
  "-y", "-i", visualPath, "-i", wavPath,
  "-filter_complex", videoFilter,
  "-map", "[video]", "-map", "1:a:0",
  "-c:v", "libvpx", "-crf", "18", "-b:v", "0", "-deadline", "good", "-cpu-used", "2",
  "-c:a", "libopus", "-b:a", "96k",
  "-metadata", `title=${finalMode ? "FINAL UPLOAD CANDIDATE — HUMAN REVIEW PENDING" : "LOCAL REHEARSAL — NOT FINAL"}`,
  "-metadata", `comment=${finalMode ? `Frozen public source ${visualManifest.base_url}; not YouTube or human evidence until reviewed and published` : "Not YouTube or human evidence; regenerate from the frozen public URL for submission"}`,
  "-t", String(outputDurationSeconds), narratedPath,
]);

const [wavBytes, narratedBytes] = await Promise.all([readFile(wavPath), readFile(narratedPath)]);
const manifest = {
  schema_version: 1,
  status: finalMode ? "final-upload-candidate-not-youtube-or-human-reviewed" : "local-narrated-rehearsal-not-youtube-or-human-evidence",
  submission_story_sha256: createHash("sha256").update(storyBytes).digest("hex"),
  narration_contract_sha256: createHash("sha256").update(narrationBytes).digest("hex"),
  captions_sha256: createHash("sha256").update(captionsBytes).digest("hex"),
  editorial_treatment: {
    path: "docs/demo-editorial-treatment.json",
    sha256: createHash("sha256").update(editorialTreatmentBytes).digest("hex"),
    status: editorialTreatment.status,
    label: editorialTreatment.label,
  },
  captions: {
    path: "docs/policy-lab-demo-captions.ko.srt",
    sha256: createHash("sha256").update(captionsBytes).digest("hex"),
    presentation: "burned-in",
    font: "Apple SD Gothic Neo",
    font_source: "macOS system /System/Library/Fonts/AppleSDGothicNeo.ttc",
    font_size: 18,
    safe_margin_vertical_pixels: 38,
  },
  visual_source: {
    path: visualPath,
    sha256: createHash("sha256").update(visualBytes).digest("hex"),
    manifest_path: visualManifestPath,
    manifest_sha256: createHash("sha256").update(visualManifestBytes).digest("hex"),
  },
  ...(finalMode ? {
    source: {
      deployed_url: visualManifest.base_url,
      release_commit: visualManifest.release.release_commit,
      build_sha256: visualManifest.release.build_sha256,
      deployed_marker_sha256: visualManifest.release.deployed_marker_sha256,
      capture_started_at: visualManifest.capture_started_at,
      capture_completed_at: visualManifest.capture_completed_at,
      cold_open: visualManifest.cold_open,
    },
  } : {}),
  voice: {
    engine: "macOS say",
    name: narration.voice,
    locale: narration.locale,
    rate_words_per_minute: narration.rate_words_per_minute,
    status: finalMode ? "placeholder-tts-requires-human-listening-approval" : "placeholder-local-tts-not-final-voice",
  },
  video_start_normalization: videoStartNormalization,
  audio_mastering: audioMastering,
  cues: cueReports,
  mixed_audio: {
    path: wavPath,
    sha256: createHash("sha256").update(wavBytes).digest("hex"),
    bytes: wavBytes.length,
    ...probe(wavPath),
  },
  narrated_video: {
    path: narratedPath,
    sha256: createHash("sha256").update(narratedBytes).digest("hex"),
    bytes: narratedBytes.length,
    ...probe(narratedPath),
    standalone_label: finalMode ? "FINAL UPLOAD CANDIDATE — HUMAN REVIEW PENDING" : "LOCAL REHEARSAL — NOT FINAL",
  },
};
await writeFile(outputManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[PASS] ${finalMode ? "final narrated upload candidate" : "narrated demo rehearsal"}: duration=${manifest.narrated_video.duration_seconds.toFixed(3)}s sha256=${manifest.narrated_video.sha256}`);
