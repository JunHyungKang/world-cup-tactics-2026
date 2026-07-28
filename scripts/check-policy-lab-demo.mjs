import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  exactDemoActions,
  validateNarrationContract,
} from "./lib/submission-story.mjs";

const visualManifestPath = "output/demo/rehearsal-manifest.json";
const narrationManifestPath = "output/demo/narration-manifest.json";
const narrationContractPath = "docs/policy-lab-demo-narration.json";
const captionsPath = "docs/policy-lab-demo-captions.ko.srt";
const storyPath = "docs/submission-story.json";
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function probe(path) {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries",
    "stream=codec_name,codec_type,width,height:format=duration:format_tags=title,comment",
    "-of", "json",
    path,
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`ffprobe failed for ${path}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

const [
  visualBytes,
  narratedManifestBytes,
  narrationBytes,
  captionsBytes,
  storyBytes,
  demoScript,
] = await Promise.all([
  readFile(visualManifestPath),
  readFile(narrationManifestPath),
  readFile(narrationContractPath),
  readFile(captionsPath),
  readFile(storyPath),
  readFile("docs/policy-lab-demo-60s.md", "utf8"),
]);
const visual = JSON.parse(visualBytes);
const narrated = JSON.parse(narratedManifestBytes);
const narration = JSON.parse(narrationBytes);
const story = JSON.parse(storyBytes);

check(
  visual.status === "local-timed-rehearsal-not-youtube-evidence",
  "visual status must remain local rehearsal",
);
check(
  narrated.status === "local-narrated-rehearsal-not-youtube-or-human-evidence",
  "narrated status must remain local rehearsal",
);
check(
  visual.submission_story_sha256 === digest(storyBytes),
  "visual story SHA drifted",
);
check(
  narrated.submission_story_sha256 === digest(storyBytes),
  "narrated story SHA drifted",
);
check(
  narrated.visual_source.manifest_sha256 === digest(visualBytes),
  "narrated visual manifest SHA drifted",
);
check(
  narrated.narration_contract_sha256 === digest(narrationBytes),
  "narration contract SHA drifted",
);
check(
  narrated.captions_sha256 === digest(captionsBytes),
  "caption contract SHA drifted",
);
for (const error of validateNarrationContract(
  story,
  narration,
  captionsBytes.toString("utf8"),
  demoScript,
)) {
  errors.push(error);
}

check(
  visual.actions.length === exactDemoActions.length,
  "visual action count drifted",
);
for (const [index, [id, scheduled]] of exactDemoActions.entries()) {
  const action = visual.actions[index];
  check(
    action?.id === id && action?.scheduled_seconds === scheduled,
    `visual action ${index + 1} contract drifted`,
  );
  check(
    action?.actual_seconds >= scheduled && action?.actual_seconds <= scheduled + 1.5,
    `visual action ${id} missed its timing window`,
  );
}
check(
  visual.final_frame.questions.includes("선택 · 선택 밖 · 선택 · 선택 밖 · 선택 밖") &&
    visual.final_frame.held_out.includes("5 · 2 · 0 · 0 · 3") &&
    visual.final_frame.shots.includes("2 · 0 · 0 · 0 · 2"),
  "final frame question-to-five-signature proof drifted",
);
check(
  visual.final_frame.counterevidence.includes("기타 전개 · 첫 기록은 수비팀") &&
    visual.final_frame.counterevidence.includes("10초 안 포르투갈 슈팅 기록이 2장면") &&
    visual.final_frame.counterevidence.includes("corner 261095314"),
  "unselected deterministic counterevidence drifted",
);
check(
  visual.final_frame.meeting_note.includes("다음 회의에서 영상 검토 안건 다시 선택") &&
    visual.final_frame.meeting_note.includes("이미 잠근 두 안건과 공개된 경기 기록을 바꾸지 않습니다"),
  "immutable next-meeting note drifted",
);

const rawVideoBytes = await readFile(visual.video.path);
check(
  visual.video.sha256 === digest(rawVideoBytes) &&
    visual.video.bytes === rawVideoBytes.length,
  "visual video byte binding drifted",
);
const rawMedia = probe(visual.video.path);
const rawVideo = rawMedia.streams.find((stream) => stream.codec_type === "video");
check(
  Number(rawMedia.format.duration) >= 59.5 &&
    Number(rawMedia.format.duration) <= 61.5,
  "visual duration is not 60 seconds",
);
check(
  rawVideo?.codec_name === "vp8" &&
    rawVideo.width === 1440 &&
    rawVideo.height === 900,
  "visual stream contract drifted",
);

check(
  narrated.cues.length === narration.cues.length,
  "narration cue count drifted",
);
for (const [index, cue] of narrated.cues.entries()) {
  const bytes = await readFile(cue.path);
  const contract = narration.cues[index];
  check(
    cue.id === contract.id &&
      cue.sha256 === digest(bytes) &&
      cue.bytes === bytes.length,
    `narration cue ${index + 1} byte binding drifted`,
  );
  check(
    cue.duration_seconds > 0 &&
      cue.duration_seconds <= contract.end - contract.start - 0.03 &&
      cue.rate_words_per_minute ===
        (contract.rate_words_per_minute ?? narration.rate_words_per_minute),
    `narration cue ${cue.id} does not fit`,
  );
}

const narratedVideoBytes = await readFile(narrated.narrated_video.path);
check(
  narrated.narrated_video.sha256 === digest(narratedVideoBytes) &&
    narrated.narrated_video.bytes === narratedVideoBytes.length,
  "narrated video byte binding drifted",
);
const narratedMedia = probe(narrated.narrated_video.path);
const video = narratedMedia.streams.find((stream) => stream.codec_type === "video");
const audio = narratedMedia.streams.find((stream) => stream.codec_type === "audio");
check(
  Number(narratedMedia.format.duration) >= 59.4 &&
    Number(narratedMedia.format.duration) <= 60,
  "narrated duration must remain at or below 60 seconds",
);
check(
  video?.codec_name === "vp8" &&
    video.width === 1440 &&
    video.height === 900 &&
    audio?.codec_name === "opus",
  "narrated stream contract drifted",
);
check(
  narratedMedia.format.tags?.title === "LOCAL REHEARSAL — NOT FINAL",
  "standalone local label drifted",
);

if (errors.length) {
  console.error(errors.map((error) => `[FAIL] ${error}`).join("\n"));
  process.exit(1);
}
console.log(
  `[PASS] Corner Scout Lab demo audit: ${Number(narratedMedia.format.duration).toFixed(3)}s, ` +
  "13 timed events, 2 question selections, one lock, 8 fitted cues, burned captions, " +
  `SHA=${narrated.narrated_video.sha256}`,
);
