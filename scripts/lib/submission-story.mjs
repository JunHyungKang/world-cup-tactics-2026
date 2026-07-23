import { createHash } from "node:crypto";

const exactBeatIds = ["hook", "reference", "lock", "r16", "seal", "final-audit", "next-meeting", "final"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function validateSubmissionStory(story, sources) {
  const errors = [];
  if (story?.schema_version !== 2) errors.push("submission story schema_version must be 2");
  if (story?.product_id !== "corner-policy-lab") errors.push("submission story must bind corner-policy-lab");
  const gallery = story?.gallery ?? {};
  if (gallery.hook !== "조별리그에서 세우고, 토너먼트에서 검증하세요.") errors.push("gallery hook drifted from the product promise");
  if (!gallery.title?.includes("한 정책") || !gallery.one_line?.includes("2018 월드컵") || !gallery.one_line?.includes("봉인")) {
    errors.push("gallery surface must state the immutable policy, historical scope, and sealed audit");
  }
  if (gallery.first_image !== "docs/assets/gallery/corner-policy-lab-first-image.png" ||
      !Array.isArray(gallery.source_images) || gallery.source_images.length !== 3) {
    errors.push("gallery first image must bind the three Policy Lab campaign states");
  }
  const campaign = story?.campaign ?? {};
  if (campaign.reference_matches !== 48 || campaign.rehearsal_matches !== 8 || campaign.final_audit_matches !== 8 || campaign.policy_changes !== 0) {
    errors.push("submission story must preserve the fixed 48-8-8 campaign and zero policy changes");
  }
  const video = story?.video ?? {};
  const beats = video.beats;
  if (video.duration_limit_seconds !== 60 || video.narrated_duration_seconds !== 59.52 || video.visual_duration_seconds !== 59.84 ||
      !Array.isArray(beats) || beats.length !== exactBeatIds.length || JSON.stringify(video.beat_order) !== JSON.stringify(exactBeatIds)) {
    errors.push("video contract must contain the exact eight-beat sub-60 Policy Lab sequence");
  } else {
    let cursor = 0;
    beats.forEach((beat, index) => {
      if (beat.id !== exactBeatIds[index]) errors.push(`video beat ${index + 1} has the wrong ID`);
      if (beat.start !== cursor || !Number.isFinite(beat.end) || beat.end <= beat.start) errors.push(`video beat ${beat.id} breaks contiguous timecodes`);
      cursor = beat.end;
      if (!beat.action || !beat.proof) errors.push(`video beat ${beat.id} lacks action or proof`);
    });
    if (cursor !== 59.5 || cursor > video.duration_limit_seconds) errors.push("video beats must end at 59.5 seconds within the 60-second limit");
  }
  const interaction = video.interaction ?? {};
  if (interaction.timed_events !== 11 || interaction.activations !== 7 || interaction.policy_locks !== 1 ||
      interaction.explicit_scrolls !== 2 || interaction.final_receipt_seconds !== 34.005 ||
      interaction.meeting_note_seconds !== 48.023) {
    errors.push("video interaction contract must preserve 11 events, 7 activations, one lock, two scrolls, the 34.005s receipt, and the 48.023s next-meeting note");
  }
  if (story?.claim_boundary?.human_evidence !== "unavailable" || story?.claim_boundary?.result_prediction !== false ||
      story?.claim_boundary?.causal_recommendation_status !== "REJECT" || story?.claim_boundary?.empirical_campaign_status !== "REVISE") {
    errors.push("submission story must preserve unavailable human evidence, causal REJECT, empirical REVISE, and no-result-prediction boundaries");
  }
  if (!Array.isArray(story?.claim_boundary?.forbidden) || story.claim_boundary.forbidden.length < 9) {
    errors.push("submission story requires explicit forbidden-claim coverage");
  }
  const requiredSourceMarkers = [
    ["app", "이 정책을 잠가 두 시험에 적용"],
    ["app", "정책 변경 0회"],
    ["productThesis", "Product selection ID: `corner-policy-lab`"],
    ["productThesis", "48경기 조별리그 참고"],
    ["planning", "Product selection ID: `corner-policy-lab`"],
    ["planning", "causal recommendation is `REJECT`"],
    ["judgingMap", "| 제출팀 | 60% |"],
    ["officialState", "submitter 60%, participant 20%, and public 20%"],
    ["demoScript", gallery.title ?? ""],
  ];
  for (const [name, marker] of requiredSourceMarkers) if (!marker || !sources?.[name]?.includes(marker)) errors.push(`${name} is not bound to the submission story`);
  for (const beat of beats ?? []) {
    const marker = `${beat.start}–${beat.end}s`;
    if (!sources?.demoScript?.includes(marker)) errors.push(`demo script lacks beat ${beat.id} timecode`);
  }
  return errors;
}

export function validateGalleryFirstImageManifest(storyBytes, story, manifest, artifactBytes) {
  const errors = [];
  if (manifest?.schema_version !== 1 || manifest?.status !== "current-build-composite-not-human-evidence") errors.push("gallery image manifest must preserve its current-build and non-human-evidence boundary");
  if (manifest?.viewport !== "1440x900") errors.push("gallery first image must be 1440x900");
  if (manifest?.submission_story_sha256 !== sha256(storyBytes)) errors.push("gallery first image is not bound to the current submission story");
  if (!Array.isArray(manifest?.sources) || JSON.stringify(manifest.sources.map(({ path }) => path)) !== JSON.stringify(story?.gallery?.source_images)) {
    errors.push("gallery first image must bind the story-declared Policy Lab states");
  } else {
    for (const [index, artifact] of manifest.sources.entries()) {
      const bytes = artifactBytes.get(artifact.path);
      if (!bytes || sha256(bytes) !== artifact.sha256 || artifact.bytes !== bytes.length) errors.push(`gallery source ${index + 1} hash or size mismatch`);
    }
  }
  const output = manifest?.output;
  const outputBytes = artifactBytes.get(output?.path);
  if (output?.path !== story?.gallery?.first_image || !outputBytes || sha256(outputBytes) !== output.sha256 || output.bytes !== outputBytes.length) errors.push("gallery first image output is not exactly bound to the canonical story asset");
  return errors;
}

export function validateStoryboardManifest(storyBytes, story, manifest, artifactBytes) {
  const errors = [];
  if (manifest?.schema_version !== 1 || manifest?.status !== "local-rehearsal-not-youtube-evidence") errors.push("storyboard manifest must remain explicitly local rehearsal evidence");
  if (manifest?.viewport !== "1440x900") errors.push("storyboard viewport must be 1440x900");
  if (manifest?.submission_story_sha256 !== sha256(storyBytes)) errors.push("storyboard manifest is not bound to the current submission story");
  if (!Array.isArray(manifest?.artifacts) || manifest.artifacts.length !== exactBeatIds.length) return [...errors, "storyboard manifest must contain eight captured beats"];
  const digests = new Set();
  manifest.artifacts.forEach((artifact, index) => {
    const beat = story.video.beats[index];
    if (artifact.order !== index + 1 || artifact.id !== beat.id || artifact.timecode !== `${beat.start}–${beat.end}s`) errors.push(`storyboard artifact ${index + 1} drifted from its video beat`);
    if (typeof artifact.path !== "string" || !artifact.path.startsWith("docs/assets/demo-storyboard/") || !artifact.path.endsWith(".png")) errors.push(`storyboard artifact ${index + 1} has an unsafe path`);
    const bytes = artifactBytes.get(artifact.path);
    const digest = bytes ? sha256(bytes) : null;
    if (!digest || digest !== artifact.sha256 || artifact.bytes !== bytes.length) errors.push(`storyboard artifact ${artifact.id} hash or byte length mismatch`);
    if (digest) digests.add(digest);
  });
  if (digests.size !== exactBeatIds.length) errors.push("every storyboard beat must have a visually distinct captured frame");
  return errors;
}

function srtTime(seconds) {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function validateNarrationContract(story, narration, captions, demoScript) {
  const errors = [];
  if (narration?.schema_version !== 1 || narration?.status !== "local-tts-rehearsal-not-final-voice") errors.push("narration contract must remain explicitly local placeholder TTS");
  const expected = story.video.narration;
  if (narration?.voice !== expected.voice || narration?.locale !== expected.locale || narration?.rate_words_per_minute !== expected.rate_words_per_minute) errors.push("narration voice and rate contract drifted");
  if (!Array.isArray(narration?.cues) || narration.cues.length !== story.video.beats.length) return [...errors, "narration must contain one cue per story beat"];
  narration.cues.forEach((cue, index) => {
    const beat = story.video.beats[index];
    if (cue.id !== beat.id || cue.start !== beat.start || cue.end !== beat.end) errors.push(`narration cue ${index + 1} drifted from story timecodes`);
    if (!(cue.caption_end > cue.start && cue.caption_end <= cue.end)) errors.push(`narration cue ${cue.id} has an invalid caption end`);
    if (typeof cue.text !== "string" || cue.text.length < 6) errors.push(`narration cue ${cue.id} is empty`);
    if (!demoScript.includes(`\`${cue.text}\``)) errors.push(`demo script narration drifted for cue ${cue.id}`);
    for (const forbidden of story.claim_boundary.forbidden) if (cue.text.includes(forbidden)) errors.push(`narration cue ${cue.id} contains forbidden claim: ${forbidden}`);
  });
  const expectedSrt = narration.cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.caption_end)}\n${cue.text}`).join("\n\n");
  if (captions.trim() !== expectedSrt) errors.push("Korean SRT captions drifted from the narration contract");
  return errors;
}

export function validateLocalPolicyDemoEvidence(storyBytes, story, evidence) {
  const errors = [];
  for (const key of ["release_manifest", "visual_video", "narrated_video"]) {
    const declared = story.evidence?.[key];
    const bytes = evidence.bytes.get(declared?.path);
    if (!bytes || sha256(bytes) !== declared.sha256) errors.push(`submission story evidence hash mismatch: ${key}`);
  }
  const visual = evidence.visualManifest;
  const narrated = evidence.narrationManifest;
  if (visual?.status !== "local-static-release-rehearsal-not-youtube-or-human-evidence" || visual?.release_manifest?.sha256 !== story.evidence.release_manifest.sha256) errors.push("visual demo lost its local boundary or release binding");
  if (visual?.actions?.length !== story.video.interaction.timed_events || visual?.interaction_contract?.activations !== 7 || visual?.interaction_contract?.policy_locks !== 1 || visual?.interaction_contract?.explicit_scrolls !== 2 || !visual?.final_receipt?.includes("정책 변경 0회") || !visual?.meeting_note?.includes("검증 결과는 그대로") || visual?.video?.sha256 !== story.evidence.visual_video.sha256) errors.push("visual demo interaction/receipt/note/video binding drifted");
  if (Math.abs(visual?.video?.duration_seconds - story.video.visual_duration_seconds) > 0.001) errors.push("visual demo duration drifted");
  const visualManifestBytes = evidence.bytes.get(story.evidence.visual_manifest.path);
  const narrationManifestBytes = evidence.bytes.get(story.evidence.narration_manifest.path);
  if (!visualManifestBytes || !narrationManifestBytes) errors.push("local demo manifests are missing");
  if (narrated?.status !== "local-narrated-static-release-rehearsal-not-youtube-or-human-evidence" || narrated?.visual_source?.sha256 !== (visualManifestBytes ? sha256(visualManifestBytes) : null) || narrated?.visual_source?.video_sha256 !== story.evidence.visual_video.sha256 || narrated?.captions?.mode !== "burned-in-and-byte-bound-sidecar" || narrated?.narrated_video?.sha256 !== story.evidence.narrated_video.sha256) errors.push("narrated demo chain or local boundary drifted");
  if (Math.abs(narrated?.narrated_video?.duration_seconds - story.video.narrated_duration_seconds) > 0.001) errors.push("narrated demo duration drifted");
  const storyHash = sha256(storyBytes);
  if (visual?.submission_story?.sha256 !== storyHash || narrated?.submission_story?.sha256 !== storyHash) errors.push("local demo manifests are not bound to the canonical submission story");
  return errors;
}
