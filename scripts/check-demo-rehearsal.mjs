import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parsePairedFlags } from "./lib/cli.mjs";
import { parseDeploymentUrl } from "./lib/final-submission.mjs";
import {
  exactDemoActions,
  validateEditorialTreatment,
} from "./lib/submission-story.mjs";

const args = parsePairedFlags(process.argv.slice(2));
for (const flag of args.keys()) {
  if (flag !== "--manifest") throw new Error(`unsupported demo audit flag: ${flag}`);
}
const manifestPath = args.get("--manifest") ?? "output/demo/rehearsal-manifest.json";
const [storyBytes, manifestText] = await Promise.all([
  readFile("docs/submission-story.json"),
  readFile(manifestPath, "utf8"),
]);
const manifest = JSON.parse(manifestText);
const videoBytes = await readFile(manifest.video.path);
const coldOpenBytes = await readFile(manifest.cold_open.path);
const releaseManifestBytes = await readFile(manifest.release_manifest.path);
const editorialTreatmentBytes = await readFile(manifest.editorial_treatment.path);
const editorialTreatment = JSON.parse(editorialTreatmentBytes.toString("utf8"));
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const finalMode =
  manifest.status === "frozen-public-visual-candidate-not-youtube-or-human-reviewed";

check(manifest.schema_version === 2, "rehearsal schema_version must be 2");
check(
  finalMode || manifest.status === "local-timed-rehearsal-not-youtube-evidence",
  "demo recording status is unsafe",
);
check(
  manifest.submission_story_sha256 === digest(storyBytes),
  "rehearsal story binding mismatch",
);
check(
  manifest.release_manifest.sha256 === digest(releaseManifestBytes),
  "rehearsal release manifest binding mismatch",
);
check(
  finalMode || manifest.video.path === "output/demo/corner-policy-lab-60s-rehearsal.webm",
  "rehearsal video path drifted",
);
check(manifest.video.sha256 === digest(videoBytes), "rehearsal video SHA mismatch");
check(manifest.video.bytes === videoBytes.length, "rehearsal video byte length mismatch");
check(manifest.cold_open.sha256 === digest(coldOpenBytes), "rehearsal cold-open SHA mismatch");
check(manifest.cold_open.bytes === coldOpenBytes.length, "rehearsal cold-open byte length mismatch");
check(
  manifest.cold_open.width === 1440 &&
    manifest.cold_open.height === 900 &&
    manifest.cold_open.source ===
      (finalMode ? "exact frozen public deployment" : "local release page"),
  "rehearsal cold-open capture contract drifted",
);
check(
  manifest.video.audio ===
    (finalMode ? "none-frozen-public-visual-candidate" : "none-local-visual-rehearsal"),
  "demo visual must disclose that it has no narration track",
);

for (const error of validateEditorialTreatment(editorialTreatment)) errors.push(error);
check(
  manifest.editorial_treatment.sha256 === digest(editorialTreatmentBytes),
  "demo editorial treatment SHA mismatch",
);
check(
  manifest.editorial_treatment.status === editorialTreatment.status,
  "demo editorial treatment status drifted",
);
check(
  manifest.editorial_treatment.label === "[편집 요약]",
  "demo editorial overlay must stay visibly labeled",
);
const expectedEditorial = editorialTreatment.chapters
  .map(({ id, scheduled_seconds }) => [id, scheduled_seconds]);
check(
  Array.isArray(manifest.editorial_treatment.transitions) &&
    manifest.editorial_treatment.transitions.length === expectedEditorial.length,
  "demo editorial transition ledger must contain eight chapters",
);
for (const [index, [id, scheduled]] of expectedEditorial.entries()) {
  const transition = manifest.editorial_treatment.transitions?.[index];
  check(
    transition?.id === id && transition?.scheduled_seconds === scheduled,
    `demo editorial transition ${index + 1} drifted`,
  );
  check(
    Math.abs((transition?.actual_seconds ?? 99) - scheduled) <= 0.5,
    `demo editorial transition ${id} missed its timing window`,
  );
}

check(
  JSON.stringify(manifest.interaction_contract) ===
    JSON.stringify(JSON.parse(storyBytes.toString("utf8")).video.interaction),
  "visual interaction contract drifted from the canonical story",
);
check(
  Array.isArray(manifest.actions) && manifest.actions.length === exactDemoActions.length,
  "rehearsal action ledger must contain twenty bound interaction/view events",
);
for (const [index, [id, scheduled]] of exactDemoActions.entries()) {
  const action = manifest.actions?.[index];
  check(
    action?.id === id && action?.scheduled_seconds === scheduled,
    `rehearsal action ${index + 1} drifted`,
  );
  check(
    action?.actual_seconds >= scheduled && action?.actual_seconds <= scheduled + 1.5,
    `rehearsal action ${id} missed its 1.5-second window`,
  );
}
check(
  manifest.final_frame?.allocation?.includes("5 · 4 · 1"),
  "final frame must preserve the locked 5/4/1",
);
check(
  manifest.final_frame?.held_out?.includes("5 · 2 · 3"),
  "final frame must preserve the held-out 5/2/3",
);
for (const proof of ["횟수 차이 0", "훈련 배분이 2회 많음", "실제가 2회 많음"]) {
  check(
    manifest.final_frame?.differences?.includes(proof),
    `final frame must preserve raw difference: ${proof}`,
  );
}
check(
  manifest.final_frame?.boundary?.includes("10개 중 4개") &&
    manifest.final_frame?.boundary?.includes("알 수 없습니다"),
  "final frame must preserve the 4/10 context and causal boundary",
);
check(
  manifest.final_frame?.meeting_note?.includes("다음 회의에서 훈련 비중 재배분") &&
    manifest.final_frame?.meeting_note?.includes("기록과 훈련 배분을 바꾸지 않습니다"),
  "final frame must preserve the separate immutable next-meeting memo",
);

if (finalMode) {
  try {
    check(
      manifest.base_url === parseDeploymentUrl(manifest.base_url),
      "final demo base URL must be canonical public HTTPS",
    );
  } catch (error) {
    errors.push(`final demo base URL is invalid: ${error.message}`);
  }
  check(
    /^[0-9a-f]{40}$/u.test(manifest.release?.release_commit ?? ""),
    "final demo release commit is invalid",
  );
  check(
    /^[0-9a-f]{64}$/u.test(manifest.release?.build_sha256 ?? ""),
    "final demo build digest is invalid",
  );
  check(
    manifest.release?.deployment_parity === "PASS",
    "final demo deployment parity is not PASS",
  );
}

const probe = spawnSync("ffprobe", [
  "-v", "error",
  "-select_streams", "v:0",
  "-show_entries", "stream=codec_name,width,height:format=duration",
  "-of", "json",
  manifest.video.path,
], { encoding: "utf8" });
check(probe.status === 0, "ffprobe could not inspect rehearsal video");
if (probe.status === 0) {
  const media = JSON.parse(probe.stdout);
  const duration = Number(media.format.duration);
  const stream = media.streams[0];
  check(
    duration >= 59.5 && duration <= 61.5,
    `rehearsal duration outside 59.5–61.5 seconds: ${duration}`,
  );
  check(
    Math.abs(duration - manifest.video.duration_seconds) < 0.01,
    "rehearsal duration manifest drifted",
  );
  check(stream.codec_name === manifest.video.codec, "rehearsal codec manifest drifted");
  check(
    stream.width === 1440 && stream.height === 900,
    "rehearsal resolution must be 1440x900",
  );
}

if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}
console.log(
  `[PASS] ${finalMode ? "frozen-public demo visual" : "timed Corner Prep Lab rehearsal"}: ` +
  `${manifest.video.duration_seconds.toFixed(3)}s, 20 on-time events, ` +
  "5/4/1 → 5/2/3 → raw differences → immutable memo",
);
