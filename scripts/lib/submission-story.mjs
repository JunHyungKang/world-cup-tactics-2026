import { createHash } from "node:crypto";

export const exactBeatIds = ["hook", "evidence", "allocate", "lock", "reveal", "receipts", "memo", "final"];
export const exactEditorialChapters = [
  ["hook", 0],
  ["evidence", 6],
  ["allocate", 15],
  ["lock", 25],
  ["reveal", 31],
  ["receipts", 42],
  ["memo", 50],
  ["final", 57],
];
export const exactDemoActions = [
  ["evidence-open", 6],
  ["evidence-close", 12],
  ["short-add-1", 15],
  ["short-add-2", 16],
  ["short-add-3", 17],
  ["short-add-4", 18],
  ["short-add-5", 19],
  ["aerial-add-1", 20],
  ["aerial-add-2", 21],
  ["aerial-add-3", 22],
  ["aerial-add-4", 23],
  ["other-add-1", 24],
  ["training-lock", 25],
  ["held-out-reveal", 31],
  ["result-view", 33],
  ["receipt-view", 42],
  ["meeting-decision", 50],
  ["meeting-reason", 52],
  ["meeting-note-save", 55],
  ["final-hold", 57],
];

const expectedGallerySources = [
  "docs/assets/final-release/01-evidence-detail.png",
  "docs/assets/final-release/02-locked-allocation.png",
  "docs/assets/final-release/03-held-out-review.png",
];
const exactAllocationCue = "조별리그의 일곱·다섯·두 번을 열 번으로 단순 환산해, 다섯·넷·하나로 잠급니다. 최적 배분은 아닙니다.";
const safeNarrationNegations = [
  "최적 배분은 아닙니다.",
  "어떤 훈련이 막았을지는 이 자료로 알 수 없습니다.",
];
const broadUnsafeNarrationTerms = [
  "정답",
  "추천",
  "수비 성공",
  "막았다",
  "위험도",
  "강화학습이 학습했다",
  "최적",
  "경기 결과를 바꿨다",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function exactArray(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function stripSafeNarrationNegations(copy) {
  return safeNarrationNegations.reduce((remaining, phrase) => remaining.replaceAll(phrase, ""), copy);
}

export function validateSubmissionStory(story, sources) {
  const errors = [];
  if (story?.schema_version !== 3) errors.push("submission story schema_version must be 3");
  if (story?.product_id !== "corner-policy-lab") errors.push("submission story must bind corner-policy-lab");

  const gallery = story?.gallery ?? {};
  if (gallery.title !== "Corner Prep Lab — 포르투갈 코너 기록으로 훈련 10회를 나눕니다" ||
      gallery.hook !== "포르투갈 코너 상황 3유형. 훈련 10회를 어떻게 나눌까요?") {
    errors.push("gallery title and hook must bind the ten-repetition Corner Prep Lab decision");
  }
  if (!gallery.one_line?.includes("14개") || !gallery.one_line?.includes("6개") ||
      !gallery.one_line?.includes("따로") || !gallery.one_line?.includes("결과 전에 잠근") ||
      !gallery.one_line?.includes("5·2·3") || !gallery.one_line?.includes("다음 회의")) {
    errors.push("gallery one-line story must state separate samples, precommitment, held-out counts, and next-meeting use");
  }
  if (gallery.first_image !== "docs/assets/gallery/corner-policy-lab-first-image.png" ||
      !exactArray(gallery.source_images, expectedGallerySources)) {
    errors.push("gallery first image must bind the three current Corner Prep Lab states");
  }

  const decision = story?.manager_decision ?? {};
  if (decision.opponent !== "Portugal" || decision.manager_team !== "Uruguay" ||
      decision.opponent_group_stage_sample !== "14/14" || decision.manager_defensive_sample !== "5/6" ||
      decision.training_repetitions !== 10 ||
      !exactArray(decision.group_stage_counts, [7, 5, 2]) ||
      !exactArray(decision.demo_allocation, [5, 4, 1]) ||
      !exactArray(decision.held_out_counts, [5, 2, 3]) ||
      !exactArray(decision.actual_minus_allocation, [0, -2, 2]) ||
      decision.shots_within_10_seconds !== "4/10") {
    errors.push("submission story must preserve 14/14 and 5/6 → 7/5/2 → 5/4/1 → 5/2/3 → 0/-2/+2 and 4/10");
  }
  if (decision.conversion?.method !== "simple-proportional-rounding" ||
      decision.conversion?.is_recommendation !== false ||
      decision.conversion?.is_optimal !== false) {
    errors.push("5/4/1 must remain a simple conversion that is neither recommended nor optimal");
  }

  const video = story?.video ?? {};
  const beats = video.beats;
  if (video.duration_limit_seconds !== 60 ||
      video.visual_duration_target_seconds !== 60 ||
      video.narrated_duration_target_seconds !== 59.5 ||
      !Array.isArray(beats) ||
      beats.length !== exactBeatIds.length ||
      !exactArray(video.beat_order, exactBeatIds)) {
    errors.push("video contract must contain the exact eight-beat sub-60 Corner Prep Lab sequence");
  } else {
    let cursor = 0;
    beats.forEach((beat, index) => {
      if (beat.id !== exactBeatIds[index]) errors.push(`video beat ${index + 1} has the wrong ID`);
      if (beat.start !== cursor || !Number.isFinite(beat.end) || beat.end <= beat.start) {
        errors.push(`video beat ${beat.id} breaks contiguous timecodes`);
      }
      cursor = beat.end;
      if (!beat.action || !beat.proof) errors.push(`video beat ${beat.id} lacks action or proof`);
    });
    if (cursor !== 59.5 || cursor > video.duration_limit_seconds) {
      errors.push("video beats must end at 59.5 seconds within the 60-second limit");
    }
  }

  const interaction = video.interaction ?? {};
  if (interaction.timed_events !== exactDemoActions.length ||
      interaction.activations !== 16 ||
      interaction.allocation_activations !== 10 ||
      interaction.policy_locks !== 1 ||
      interaction.explicit_scrolls !== 4 ||
      interaction.result_reveal_seconds !== 31 ||
      interaction.meeting_note_seconds !== 55) {
    errors.push("video interaction contract must preserve 20 events, 16 activations, ten allocation clicks, one lock, four scrolls, a 31s reveal, and a 55s memo");
  }

  const boundary = story?.claim_boundary ?? {};
  if (boundary.human_evidence !== "unavailable" ||
      boundary.result_prediction !== false ||
      boundary.causal_recommendation_status !== "REJECT" ||
      boundary.empirical_campaign_status !== "REVISE") {
    errors.push("submission story must preserve unavailable human evidence, causal REJECT, empirical REVISE, and no-result-prediction boundaries");
  }
  if (!exactArray(boundary.allowed_negations, safeNarrationNegations) ||
      !Array.isArray(boundary.forbidden) ||
      boundary.forbidden.length < 10) {
    errors.push("submission story requires exact safe-negation and forbidden-claim coverage");
  }

  const evidence = story?.evidence ?? {};
  if (evidence.scope !== "local-rehearsal-only-not-final-public-video-or-youtube-evidence" ||
      evidence.artifact_status !== "regenerate-after-source-and-release-gates-pass" ||
      evidence.final_source_of_truth !== "submissions/final-demo.json generated after the final public release" ||
      evidence.release_manifest?.path !== "dist-policy-lab/release-manifest.json" ||
      evidence.visual_manifest?.path !== "output/demo/rehearsal-manifest.json" ||
      evidence.narration_manifest?.path !== "output/demo/narration-manifest.json" ||
      evidence.visual_video?.path !== "output/demo/corner-policy-lab-60s-rehearsal.webm" ||
      evidence.narrated_video?.path !== "output/demo/corner-policy-lab-60s-narrated-rehearsal.webm") {
    errors.push("submission story must point to the canonical local rehearsal chain and the post-release final manifest");
  }

  const requiredSourceMarkers = [
    ["app", "포르투갈 코너 상황 3유형"],
    ["app", "훈련 10회를 어떻게 나눌까요?"],
    ["app", "훈련 10회를 결과 전에 잠그기"],
    ["app", "가려 둔 맞대결 첫 전개 보기"],
    ["app", "다음 회의에서 훈련 비중 재배분"],
    ["app", "data-testid=\"meeting-note-receipt\""],
    ["productThesis", "Product selection ID: `corner-policy-lab`"],
    ["productThesis", "Portugal `7 / 5 / 2`"],
    ["productThesis", "ledger `5 / 2 / 3`"],
    ["planning", "Product selection ID: `corner-policy-lab`"],
    ["planning", "causal recommendation is `REJECT`"],
    ["judgingMap", "locks `5/4/1`"],
    ["judgingMap", "`0/-2/+2`"],
    ["officialState", "submitter 60%, participant 20%, and public 20%"],
    ["demoScript", gallery.title ?? ""],
  ];
  for (const [name, marker] of requiredSourceMarkers) {
    if (!marker || !sources?.[name]?.includes(marker)) errors.push(`${name} is not bound to the submission story`);
  }
  for (const beat of beats ?? []) {
    if (!sources?.demoScript?.includes(`${beat.start}–${beat.end}s`)) {
      errors.push(`demo script lacks beat ${beat.id} timecode`);
    }
  }
  return errors;
}

export function validateGalleryFirstImageManifest(storyBytes, story, manifest, artifactBytes) {
  const errors = [];
  if (manifest?.schema_version !== 2 ||
      manifest?.status !== "current-build-composite-not-human-evidence") {
    errors.push("gallery image manifest must preserve its current-build and non-human-evidence boundary");
  }
  if (manifest?.viewport !== "1440x900") errors.push("gallery first image must be 1440x900");
  if (manifest?.submission_story_sha256 !== sha256(storyBytes)) {
    errors.push("gallery first image is not bound to the current submission story");
  }
  if (!Array.isArray(manifest?.sources) ||
      !exactArray(manifest.sources.map(({ path }) => path), story?.gallery?.source_images)) {
    errors.push("gallery first image must bind the story-declared Corner Prep Lab states");
  } else {
    for (const [index, artifact] of manifest.sources.entries()) {
      const bytes = artifactBytes.get(artifact.path);
      if (!bytes || sha256(bytes) !== artifact.sha256 || artifact.bytes !== bytes.length) {
        errors.push(`gallery source ${index + 1} hash or size mismatch`);
      }
    }
  }
  const output = manifest?.output;
  const outputBytes = artifactBytes.get(output?.path);
  if (output?.path !== story?.gallery?.first_image ||
      !outputBytes ||
      sha256(outputBytes) !== output.sha256 ||
      output.bytes !== outputBytes.length) {
    errors.push("gallery first image output is not exactly bound to the canonical story asset");
  }
  return errors;
}

export function validateStoryboardManifest(storyBytes, story, manifest, artifactBytes) {
  const errors = [];
  if (manifest?.schema_version !== 2 ||
      manifest?.status !== "local-rehearsal-not-youtube-evidence") {
    errors.push("storyboard manifest must remain explicitly local rehearsal evidence");
  }
  if (manifest?.viewport !== "1440x900") errors.push("storyboard viewport must be 1440x900");
  if (manifest?.submission_story_sha256 !== sha256(storyBytes)) {
    errors.push("storyboard manifest is not bound to the current submission story");
  }
  if (!Array.isArray(manifest?.artifacts) || manifest.artifacts.length !== exactBeatIds.length) {
    return [...errors, "storyboard manifest must contain eight captured beats"];
  }
  const digests = new Set();
  manifest.artifacts.forEach((artifact, index) => {
    const beat = story.video.beats[index];
    if (artifact.order !== index + 1 ||
        artifact.id !== beat.id ||
        artifact.timecode !== `${beat.start}–${beat.end}s`) {
      errors.push(`storyboard artifact ${index + 1} drifted from its video beat`);
    }
    if (typeof artifact.path !== "string" ||
        !artifact.path.startsWith("docs/assets/demo-storyboard/") ||
        !artifact.path.endsWith(".png")) {
      errors.push(`storyboard artifact ${index + 1} has an unsafe path`);
    }
    const bytes = artifactBytes.get(artifact.path);
    const digest = bytes ? sha256(bytes) : null;
    if (!digest || digest !== artifact.sha256 || artifact.bytes !== bytes.length) {
      errors.push(`storyboard artifact ${artifact.id} hash or byte length mismatch`);
    }
    if (digest) digests.add(digest);
  });
  if (digests.size !== exactBeatIds.length) {
    errors.push("every storyboard beat must have a visually distinct captured frame");
  }
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
  if (narration?.schema_version !== 2 ||
      narration?.status !== "local-tts-rehearsal-not-final-voice") {
    errors.push("narration contract must remain explicitly local placeholder TTS");
  }
  const expected = story.video.narration;
  if (narration?.voice !== expected.voice ||
      narration?.locale !== expected.locale ||
      narration?.rate_words_per_minute !== expected.rate_words_per_minute ||
      !exactArray(narration?.cue_rate_overrides, expected.cue_rate_overrides) ||
      !exactArray(expected.cue_rate_overrides, { final: 240 })) {
    errors.push("narration voice and rate contract drifted");
  }
  if (!Array.isArray(narration?.cues) ||
      narration.cues.length !== story.video.beats.length) {
    return [...errors, "narration must contain one cue per story beat"];
  }
  narration.cues.forEach((cue, index) => {
    const beat = story.video.beats[index];
    if (cue.id !== beat.id || cue.start !== beat.start || cue.end !== beat.end) {
      errors.push(`narration cue ${index + 1} drifted from story timecodes`);
    }
    const expectedCueRate = expected.cue_rate_overrides?.[cue.id];
    if ((cue.rate_words_per_minute ?? undefined) !== expectedCueRate) {
      errors.push(`narration cue ${cue.id} rate override drifted`);
    }
    if (!(cue.caption_end > cue.start && cue.caption_end <= cue.end)) {
      errors.push(`narration cue ${cue.id} has an invalid caption end`);
    }
    if (typeof cue.text !== "string" || cue.text.length < 6) {
      errors.push(`narration cue ${cue.id} is empty`);
    }
    const captionLines = (cue.caption ?? cue.text).split("\n");
    if (captionLines.length > 2 || captionLines.some((line) => line.length > 34)) {
      errors.push(`narration cue ${cue.id} caption exceeds the two-line readability contract`);
    }
    if (!demoScript.includes(`\`${cue.text}\``)) {
      errors.push(`demo script narration drifted for cue ${cue.id}`);
    }
    for (const forbidden of story.claim_boundary.forbidden) {
      if (cue.text.includes(forbidden)) {
        errors.push(`narration cue ${cue.id} contains forbidden claim: ${forbidden}`);
      }
    }
    const unprotectedCopy = stripSafeNarrationNegations(cue.text);
    for (const unsafe of broadUnsafeNarrationTerms) {
      if (unprotectedCopy.includes(unsafe)) {
        errors.push(`narration cue ${cue.id} contains an unbounded claim token: ${unsafe}`);
      }
    }
  });
  if (narration.cues.find(({ id }) => id === "allocate")?.text !== exactAllocationCue) {
    errors.push("5/4/1 narration must say it is a simple conversion and not an optimal allocation");
  }
  const narrationCopy = narration.cues.map(({ text }) => text).join("\n");
  for (const safeNegation of safeNarrationNegations) {
    if (!narrationCopy.includes(safeNegation)) {
      errors.push(`narration is missing required uncertainty language: ${safeNegation}`);
    }
  }
  const expectedSrt = narration.cues
    .map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.caption_end)}\n${cue.caption ?? cue.text}`)
    .join("\n\n");
  if (captions.trim() !== expectedSrt) {
    errors.push("Korean SRT captions drifted from the narration contract");
  }
  return errors;
}

export function validateEditorialTreatment(treatment) {
  const errors = [];
  if (treatment?.schema_version !== 2 ||
      treatment?.status !== "editorial-overlay-not-product-ui-or-human-evidence" ||
      treatment?.label !== "[편집 요약]" ||
      treatment?.transition_ms !== 160) {
    errors.push("demo editorial treatment lost its explicit non-product boundary or transition contract");
  }
  if (!Array.isArray(treatment?.chapters) ||
      treatment.chapters.length !== exactEditorialChapters.length) {
    return [...errors, "demo editorial treatment must contain eight scheduled chapters"];
  }
  treatment.chapters.forEach((chapter, index) => {
    const [id, scheduled] = exactEditorialChapters[index];
    if (chapter?.id !== id || chapter?.scheduled_seconds !== scheduled) {
      errors.push(`demo editorial chapter ${index + 1} drifted`);
    }
    if (![chapter?.kicker, chapter?.title, chapter?.detail]
      .every((value) => typeof value === "string" && value.length >= 4)) {
      errors.push(`demo editorial chapter ${id} lacks a readable Korean summary`);
    }
  });
  const boundary = treatment?.claim_boundary ?? {};
  if (Object.values({
    product_ui: boundary.product_ui,
    human_evidence: boundary.human_evidence,
    causal_effect: boundary.causal_effect,
    result_prediction: boundary.result_prediction,
    optimal_policy: boundary.optimal_policy,
  }).some((value) => value !== false)) {
    errors.push("demo editorial treatment must reject product-UI, human, causal, predictive, and optimality claims");
  }
  const allCopy = treatment.chapters
    .map(({ kicker, title, detail }) => `${kicker} ${title} ${detail}`)
    .join("\n");
  for (const unsafe of ["AI 추천", "강화학습이 학습했다", "최적 배분입니다", "경기 결과를 바꿨다"]) {
    if (allCopy.includes(unsafe)) errors.push(`demo editorial treatment contains unsafe claim: ${unsafe}`);
  }
  for (const required of ["5·4·1", "5·2·3", "10개 중 4개", "다음 회의", "추천도 최적 배분도 아님"]) {
    if (!allCopy.includes(required)) {
      errors.push(`demo editorial treatment lacks canonical proof: ${required}`);
    }
  }
  return errors;
}

export function validateLocalPolicyDemoEvidence(storyBytes, story, evidence) {
  const errors = [];
  const bytesFor = (key) => evidence.bytes.get(story.evidence?.[key]?.path);
  for (const key of ["release_manifest", "visual_manifest", "narration_manifest", "visual_video", "narrated_video"]) {
    if (!bytesFor(key)) errors.push(`canonical local demo artifact is missing: ${key}`);
  }

  const visual = evidence.visualManifest;
  const narrated = evidence.narrationManifest;
  const storyHash = sha256(storyBytes);
  const releaseBytes = bytesFor("release_manifest");
  const visualBytes = bytesFor("visual_video");
  const narratedBytes = bytesFor("narrated_video");
  const visualManifestBytes = bytesFor("visual_manifest");

  if (visual?.status !== "local-timed-rehearsal-not-youtube-evidence" ||
      visual?.submission_story_sha256 !== storyHash ||
      visual?.release_manifest?.path !== story.evidence.release_manifest.path ||
      visual?.release_manifest?.sha256 !== (releaseBytes ? sha256(releaseBytes) : null) ||
      visual?.video?.path !== story.evidence.visual_video.path ||
      visual?.video?.sha256 !== (visualBytes ? sha256(visualBytes) : null) ||
      visual?.video?.bytes !== visualBytes?.length) {
    errors.push("visual rehearsal lost its local boundary or story/release/video binding");
  }
  if (!Array.isArray(visual?.actions) ||
      visual.actions.length !== story.video.interaction.timed_events ||
      visual?.interaction_contract?.activations !== story.video.interaction.activations ||
      visual?.interaction_contract?.allocation_activations !== story.video.interaction.allocation_activations ||
      visual?.interaction_contract?.policy_locks !== story.video.interaction.policy_locks ||
      visual?.interaction_contract?.explicit_scrolls !== story.video.interaction.explicit_scrolls ||
      !visual?.final_frame?.allocation?.includes("5 · 4 · 1") ||
      !visual?.final_frame?.held_out?.includes("5 · 2 · 3") ||
      !visual?.final_frame?.differences?.includes("횟수 차이 0") ||
      !visual?.final_frame?.differences?.includes("훈련 배분이 2회 많음") ||
      !visual?.final_frame?.differences?.includes("실제가 2회 많음") ||
      !visual?.final_frame?.meeting_note?.includes("다음 회의에서 훈련 비중 재배분") ||
      !visual?.final_frame?.meeting_note?.includes("기록과 훈련 배분을 바꾸지 않습니다")) {
    errors.push("visual rehearsal interaction, raw-difference, or immutable-memo proof drifted");
  }
  if (!Number.isFinite(visual?.video?.duration_seconds) ||
      visual.video.duration_seconds < 59.5 ||
      visual.video.duration_seconds > 61.5) {
    errors.push("visual rehearsal duration drifted");
  }

  if (narrated?.status !== "local-narrated-rehearsal-not-youtube-or-human-evidence" ||
      narrated?.submission_story_sha256 !== storyHash ||
      narrated?.visual_source?.manifest_sha256 !== (visualManifestBytes ? sha256(visualManifestBytes) : null) ||
      narrated?.visual_source?.video_sha256 !== (visualBytes ? sha256(visualBytes) : null) ||
      narrated?.captions?.presentation !== "burned-in" ||
      narrated?.narrated_video?.path !== story.evidence.narrated_video.path ||
      narrated?.narrated_video?.sha256 !== (narratedBytes ? sha256(narratedBytes) : null) ||
      narrated?.narrated_video?.bytes !== narratedBytes?.length) {
    errors.push("narrated rehearsal chain or local boundary drifted");
  }
  if (!Number.isFinite(narrated?.narrated_video?.duration_seconds) ||
      narrated.narrated_video.duration_seconds < 59.4 ||
      narrated.narrated_video.duration_seconds > 60) {
    errors.push("narrated rehearsal duration drifted");
  }
  return errors;
}
