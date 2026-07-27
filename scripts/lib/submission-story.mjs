import { createHash } from "node:crypto";

export const exactBeatIds = [
  "hook",
  "evidence",
  "select",
  "lock",
  "reveal",
  "counterevidence",
  "memo",
  "final",
];

export const exactEditorialChapters = [
  ["hook", 0],
  ["evidence", 6],
  ["select", 15],
  ["lock", 25],
  ["reveal", 31],
  ["counterevidence", 42],
  ["memo", 50],
  ["final", 57],
];

export const exactDemoActions = [
  ["hero-hold", 0],
  ["model-view", 6],
  ["question-view", 12],
  ["aerial-defending-select", 15],
  ["short-attacking-select", 20],
  ["question-lock", 25],
  ["held-out-reveal", 31],
  ["result-view", 33],
  ["counterevidence-view", 42],
  ["meeting-decision", 50],
  ["meeting-reason", 52],
  ["meeting-note-save", 55],
  ["final-hold", 57],
];

export const exactSignatureOrder = [
  "short-attacking-first",
  "aerial-attacking-first",
  "aerial-defending-first",
  "other-attacking-first",
  "other-defending-first",
];

export const exactSelectedQuestions = [
  "aerial-defending-first",
  "short-attacking-first",
];

const expectedGallerySources = [
  "docs/assets/final-release/01-matchup-analysis.png",
  "docs/assets/final-release/02-locked-questions.png",
  "docs/assets/final-release/03-counterevidence.png",
];

const exactSelectCue =
  "포르투갈의 세 경기에서 반복된 두 흐름을 고릅니다. 숏 구역 전달 뒤 포르투갈 선수, 공중 경합 뒤 상대 수비 선수가 먼저 기록된 흐름입니다.";
const exactCounterevidenceCue =
  "선택 밖 ‘그 밖의 전개’는 세 장면이었고, 두 장면은 십 초 안에 슈팅이 기록됐습니다. 첫 이벤트 기록을 확인합니다.";
const requiredNarrationBoundaries = [
  "모델은 좁히고, 감독은 판단합니다.",
];
const broadUnsafeNarrationTerms = [
  "약점",
  "강점",
  "최적",
  "추천",
  "정답",
  "수비 성공",
  "막았다",
  "예방했다",
  "승률",
  "xG",
  "위험도",
  "강화학습",
  "경기 결과를 바꿨다",
  "원인",
];
const legacyNarrativeTerms = [
  "훈련 10회",
  "5·4·1",
  "5 / 4 / 1",
  "0/-2/+2",
  "훈련 배분",
  "단순 환산",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function exactValue(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function allVisibleCopy(story) {
  return [
    story?.gallery?.title,
    story?.gallery?.one_line,
    story?.gallery?.hook,
    story?.video?.title,
    ...(story?.video?.beats ?? []).flatMap(({ action, proof }) => [action, proof]),
  ].filter(Boolean).join("\n");
}

export function validateSubmissionStory(story, sources) {
  const errors = [];
  if (story?.schema_version !== 3) {
    errors.push("submission story schema_version must be 3");
  }
  if (story?.product_id !== "corner-policy-lab") {
    errors.push("submission story must bind corner-policy-lab");
  }

  const gallery = story?.gallery ?? {};
  if (gallery.title !==
      "Corner Scout Lab — 포르투갈 14개를 보정하고, 원본 장면 두 안건을 고릅니다" ||
      gallery.hook !==
      "포르투갈 코너 14개만 그대로 믿어도 될까요?") {
    errors.push("gallery title and hook must bind the team-model and source-scene question");
  }
  if (!gallery.one_line?.includes("포르투갈 코너 14개") ||
      !gallery.one_line?.includes("월드컵 조별리그 397개") ||
      !gallery.one_line?.includes("우루과이의 작은 수비 표본") ||
      !gallery.one_line?.includes("영상 검토 안건 두 개") ||
      !gallery.one_line?.includes("선택 밖 슈팅 장면") ||
      !gallery.one_line?.includes("다음 회의")) {
    errors.push(
      "gallery one-line story must state partial pooling, sparse Uruguay separation, two locked review questions, unselected evidence, and next-meeting use",
    );
  }
  if (gallery.first_image !== "docs/assets/gallery/corner-policy-lab-first-image.png" ||
      !exactValue(gallery.source_images, expectedGallerySources)) {
    errors.push("gallery first image must bind the three team-model and source-scene product states");
  }

  const decision = story?.manager_decision ?? {};
  if (decision.opponent !== "Portugal" ||
      decision.manager_team !== "Uruguay" ||
      decision.opponent_group_stage_sample !== "14/14" ||
      decision.manager_defensive_sample !== "5/6" ||
      !exactValue(decision.signature_order, exactSignatureOrder) ||
      !exactValue(decision.pre_match_counts?.opponent_attack, [7, 1, 4, 1, 1]) ||
      !exactValue(decision.pre_match_counts?.manager_defensive_exposure, [2, 2, 0, 0, 1]) ||
      decision.priority_count !== 2 ||
      !exactValue(decision.demo_selected_questions, exactSelectedQuestions) ||
      !exactValue(decision.held_out_counts, [5, 2, 0, 0, 3]) ||
      !exactValue(decision.held_out_shots_within_10_seconds, [2, 0, 0, 0, 2])) {
    errors.push(
      "submission story must preserve the exact five signatures, two selected questions, and held-out count/shot ledgers",
    );
  }
  const counterevidence = decision.counterevidence ?? {};
  if (counterevidence.signature !== "other-defending-first" ||
      counterevidence.corners !== 3 ||
      counterevidence.shots_within_10_seconds !== 2 ||
      counterevidence.corner_event_id !== 261095314) {
    errors.push(
      "submission story must bind other-defending-first 3-scene/2-shot counterevidence and corner 261095314",
    );
  }
  if (decision.selection?.is_recommendation !== false ||
      decision.selection?.is_ranked !== false ||
      decision.selection?.is_optimal !== false) {
    errors.push("the two-question demo choice must remain manual, unranked, and non-recommended");
  }

  const video = story?.video ?? {};
  const beats = video.beats;
  if (video.duration_limit_seconds !== 60 ||
      video.visual_duration_target_seconds !== 60 ||
      video.narrated_duration_target_seconds !== 59.5 ||
      !Array.isArray(beats) ||
      beats.length !== exactBeatIds.length ||
      !exactValue(video.beat_order, exactBeatIds)) {
    errors.push("video contract must contain the exact eight-beat sub-60 matchup-question sequence");
  } else {
    let cursor = 0;
    beats.forEach((beat, index) => {
      if (beat.id !== exactBeatIds[index]) {
        errors.push(`video beat ${index + 1} has the wrong ID`);
      }
      if (beat.start !== cursor || !Number.isFinite(beat.end) || beat.end <= beat.start) {
        errors.push(`video beat ${beat.id} breaks contiguous timecodes`);
      }
      cursor = beat.end;
      if (!beat.action || !beat.proof) {
        errors.push(`video beat ${beat.id} lacks action or proof`);
      }
    });
    if (cursor !== 59.5 || cursor > video.duration_limit_seconds) {
      errors.push("video beats must end at 59.5 seconds within the 60-second limit");
    }
  }

  const interaction = video.interaction ?? {};
  if (interaction.timed_events !== exactDemoActions.length ||
      interaction.activations !== 6 ||
      interaction.question_selection_activations !== 2 ||
      interaction.question_locks !== 1 ||
      interaction.explicit_scrolls !== 4 ||
      interaction.result_reveal_seconds !== 31 ||
      interaction.counterevidence_seconds !== 42 ||
      interaction.meeting_note_seconds !== 55) {
    errors.push(
      "video interaction contract must preserve 13 events, six activations, two selections, one lock, four scrolls, reveal, counterevidence, and memo timings",
    );
  }

  const boundary = story?.claim_boundary ?? {};
  if (boundary.human_evidence !== "unavailable" ||
      boundary.result_prediction !== false ||
      boundary.causal_recommendation_status !== "REJECT" ||
      boundary.empirical_campaign_status !== "REVISE") {
    errors.push(
      "submission story must preserve unavailable human evidence, causal REJECT, empirical REVISE, and no-result-prediction boundaries",
    );
  }
  if (!exactValue(boundary.required_boundaries, [
    "우루과이 수비 5개는 예측에 섞지 않았습니다.",
    "0은 이 작은 표본에서 같은 장면을 찾지 못했다는 뜻입니다.",
  ]) ||
      !Array.isArray(boundary.forbidden) ||
      !["약점", "최적", "AI 추천", "훈련이 막았다", "경기 결과를 바꿨다"]
        .every((phrase) => boundary.forbidden.includes(phrase))) {
    errors.push("submission story requires exact observation-gap, no-ranking, and forbidden-claim coverage");
  }

  const visibleCopy = allVisibleCopy(story);
  for (const legacy of legacyNarrativeTerms) {
    if (visibleCopy.includes(legacy)) {
      errors.push(`submission story still contains superseded allocation copy: ${legacy}`);
    }
  }

  const evidence = story?.evidence ?? {};
  if (evidence.scope !== "local-rehearsal-only-not-final-public-video-or-youtube-evidence" ||
      evidence.artifact_status !== "regenerate-after-source-and-release-gates-pass" ||
      evidence.final_source_of_truth !==
        "submissions/final-demo.json generated after the final public release" ||
      evidence.release_manifest?.path !== "dist-policy-lab/release-manifest.json" ||
      evidence.visual_manifest?.path !== "output/demo/rehearsal-manifest.json" ||
      evidence.narration_manifest?.path !== "output/demo/narration-manifest.json" ||
      evidence.visual_video?.path !== "output/demo/corner-policy-lab-60s-rehearsal.webm" ||
      evidence.narrated_video?.path !==
        "output/demo/corner-policy-lab-60s-narrated-rehearsal.webm") {
    errors.push(
      "submission story must point to the canonical local rehearsal chain and the post-release final manifest",
    );
  }

  const requiredSourceMarkers = [
    ["app", "포르투갈 코너 14개만"],
    ["app", "월드컵 조별리그 397개로 보정했습니다"],
    ["app", "선택한 영상 검토 안건 2개를 맞대결 공개 전에 잠그기"],
    ["app", "가려 둔 우루과이–포르투갈 코너 기록 보기"],
    ["app", "data-testid=\"counterevidence\""],
    ["app", "data-testid=\"meeting-note-receipt\""],
    ["productThesis", "Product selection status: `PASS — partial-pooled team forecast + source-linked scene review`"],
    ["productThesis", "`aerial-defending-first`"],
    ["productThesis", "`short-attacking-first`"],
    ["productThesis", "`261095314`"],
    ["planning", "Product selection ID: `corner-policy-lab`"],
    ["planning", "causal recommendation is `REJECT`"],
    ["judgingMap", "locks two concrete video-review questions"],
    ["judgingMap", "team-model plus source-scene story"],
    ["officialState", "submitter 60%, participant 20%, and public 20%"],
    ["demoScript", gallery.title ?? ""],
  ];
  for (const [name, marker] of requiredSourceMarkers) {
    if (!marker || !sources?.[name]?.includes(marker)) {
      errors.push(`${name} is not bound to the submission story`);
    }
  }
  for (const beat of beats ?? []) {
    if (!sources?.demoScript?.includes(`${beat.start}–${beat.end}s`)) {
      errors.push(`demo script lacks beat ${beat.id} timecode`);
    }
  }
  return errors;
}

export function validateGalleryFirstImageManifest(
  storyBytes,
  story,
  manifest,
  artifactBytes,
) {
  const errors = [];
  if (manifest?.schema_version !== 2 ||
      manifest?.status !== "current-build-composite-not-human-evidence") {
    errors.push(
      "gallery image manifest must preserve its current-build and non-human-evidence boundary",
    );
  }
  if (manifest?.viewport !== "1440x900") {
    errors.push("gallery first image must be 1440x900");
  }
  if (manifest?.submission_story_sha256 !== sha256(storyBytes)) {
    errors.push("gallery first image is not bound to the current submission story");
  }
  if (!Array.isArray(manifest?.sources) ||
      !exactValue(manifest.sources.map(({ path }) => path), story?.gallery?.source_images)) {
    errors.push("gallery first image must bind the story-declared matchup-question states");
  } else {
    for (const [index, artifact] of manifest.sources.entries()) {
      const bytes = artifactBytes.get(artifact.path);
      if (!bytes ||
          sha256(bytes) !== artifact.sha256 ||
          artifact.bytes !== bytes.length) {
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
    errors.push(
      "gallery first image output is not exactly bound to the canonical story asset",
    );
  }
  return errors;
}

export function validateStoryboardManifest(
  storyBytes,
  story,
  manifest,
  artifactBytes,
) {
  const errors = [];
  if (manifest?.schema_version !== 2 ||
      manifest?.status !== "local-rehearsal-not-youtube-evidence") {
    errors.push("storyboard manifest must remain explicitly local rehearsal evidence");
  }
  if (manifest?.viewport !== "1440x900") {
    errors.push("storyboard viewport must be 1440x900");
  }
  if (manifest?.submission_story_sha256 !== sha256(storyBytes)) {
    errors.push("storyboard manifest is not bound to the current submission story");
  }
  if (!Array.isArray(manifest?.artifacts) ||
      manifest.artifacts.length !== exactBeatIds.length) {
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
    if (!digest ||
        digest !== artifact.sha256 ||
        artifact.bytes !== bytes.length) {
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
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:` +
    `${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
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
      !exactValue(narration?.cue_rate_overrides, expected.cue_rate_overrides) ||
      !exactValue(expected.cue_rate_overrides, { final: 220 })) {
    errors.push("narration voice and rate contract drifted");
  }
  if (!Array.isArray(narration?.cues) ||
      narration.cues.length !== story.video.beats.length) {
    return [...errors, "narration must contain one cue per story beat"];
  }
  narration.cues.forEach((cue, index) => {
    const beat = story.video.beats[index];
    if (cue.id !== beat.id ||
        cue.start !== beat.start ||
        cue.end !== beat.end) {
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
    if (captionLines.length > 2 ||
        captionLines.some((line) => line.length > 34)) {
      errors.push(
        `narration cue ${cue.id} caption exceeds the two-line readability contract`,
      );
    }
    if (!demoScript.includes(`\`${cue.text}\``)) {
      errors.push(`demo script narration drifted for cue ${cue.id}`);
    }
    for (const forbidden of story.claim_boundary.forbidden) {
      if (cue.text.includes(forbidden)) {
        errors.push(
          `narration cue ${cue.id} contains forbidden claim: ${forbidden}`,
        );
      }
    }
    for (const unsafe of broadUnsafeNarrationTerms) {
      if (cue.text.includes(unsafe)) {
        errors.push(
          `narration cue ${cue.id} contains an unbounded claim token: ${unsafe}`,
        );
      }
    }
    for (const legacy of legacyNarrativeTerms) {
      if (cue.text.includes(legacy) || (cue.caption ?? "").includes(legacy)) {
        errors.push(
          `narration cue ${cue.id} contains superseded allocation copy: ${legacy}`,
        );
      }
    }
  });
  if (narration.cues.find(({ id }) => id === "select")?.text !== exactSelectCue) {
    errors.push(
      "selection narration must name the two official questions and reject an automated ranking",
    );
  }
  if (narration.cues.find(({ id }) => id === "counterevidence")?.text !==
      exactCounterevidenceCue) {
    errors.push(
      "counterevidence narration must bind three scenes, two shots, and corner 261095314",
    );
  }
  const narrationCopy = narration.cues.map(({ text }) => text).join("\n");
  for (const required of requiredNarrationBoundaries) {
    if (!narrationCopy.includes(required)) {
      errors.push(`narration is missing required boundary language: ${required}`);
    }
  }
  const expectedSrt = narration.cues
    .map((cue, index) =>
      `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.caption_end)}\n` +
      `${cue.caption ?? cue.text}`)
    .join("\n\n");
  if (captions.trim() !== expectedSrt) {
    errors.push("Korean SRT captions drifted from the narration contract");
  }
  return errors;
}

export function validateEditorialTreatment(treatment) {
  const errors = [];
  if (treatment?.schema_version !== 2 ||
      treatment?.status !==
        "editorial-overlay-not-product-ui-or-human-evidence" ||
      treatment?.label !== "[편집 요약]" ||
      treatment?.transition_ms !== 160) {
    errors.push(
      "demo editorial treatment lost its explicit non-product boundary or transition contract",
    );
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
    team_trait_inference: boundary.team_trait_inference,
  }).some((value) => value !== false)) {
    errors.push(
      "demo editorial treatment must reject product-UI, human, causal, predictive, ranking, and team-trait claims",
    );
  }
  const allCopy = treatment.chapters
    .map(({ kicker, title, detail }) => `${kicker} ${title} ${detail}`)
    .join("\n");
  for (const unsafe of [
    ...broadUnsafeNarrationTerms,
    ...legacyNarrativeTerms,
  ]) {
    if (allCopy.includes(unsafe)) {
      errors.push(`demo editorial treatment contains unsafe or superseded copy: ${unsafe}`);
    }
  }
  for (const required of [
    "토너먼트 단계 코너 160개 검증",
    "포르투갈 3/3경기",
    "포르투갈 보정 상위 구역 9/10",
    "3장면",
    "슈팅 기록 2장면",
    "corner 261095314",
    "다음 회의",
  ]) {
    if (!allCopy.includes(required)) {
      errors.push(`demo editorial treatment lacks canonical proof: ${required}`);
    }
  }
  return errors;
}

export function validateLocalPolicyDemoEvidence(storyBytes, story, evidence) {
  const errors = [];
  const bytesFor = (key) => evidence.bytes.get(story.evidence?.[key]?.path);
  for (const key of [
    "release_manifest",
    "visual_manifest",
    "narration_manifest",
    "visual_video",
    "narrated_video",
  ]) {
    if (!bytesFor(key)) {
      errors.push(`canonical local demo artifact is missing: ${key}`);
    }
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
      visual?.release_manifest?.sha256 !==
        (releaseBytes ? sha256(releaseBytes) : null) ||
      visual?.video?.path !== story.evidence.visual_video.path ||
      visual?.video?.sha256 !==
        (visualBytes ? sha256(visualBytes) : null) ||
      visual?.video?.bytes !== visualBytes?.length) {
    errors.push(
      "visual rehearsal lost its local boundary or story/release/video binding",
    );
  }
  if (!Array.isArray(visual?.actions) ||
      visual.actions.length !== story.video.interaction.timed_events ||
      visual?.interaction_contract?.activations !==
        story.video.interaction.activations ||
      visual?.interaction_contract?.question_selection_activations !==
        story.video.interaction.question_selection_activations ||
      visual?.interaction_contract?.question_locks !==
        story.video.interaction.question_locks ||
      visual?.interaction_contract?.explicit_scrolls !==
        story.video.interaction.explicit_scrolls ||
      !visual?.final_frame?.questions?.includes(
        "선택 · 선택 밖 · 선택 · 선택 밖 · 선택 밖",
      ) ||
      !visual?.final_frame?.held_out?.includes("5 · 2 · 0 · 0 · 3") ||
      !visual?.final_frame?.shots?.includes("2 · 0 · 0 · 0 · 2") ||
      !visual?.final_frame?.counterevidence?.includes(
        "그 밖의 전개 뒤 · 수비팀 먼저 기록",
      ) ||
      !visual?.final_frame?.counterevidence?.includes(
        "10초 안 포르투갈 슈팅 기록이 2장면",
      ) ||
      !visual?.final_frame?.counterevidence?.includes("261095314") ||
      !visual?.final_frame?.boundary?.includes("10개 중 4개") ||
      !visual?.final_frame?.boundary?.includes("알 수 없습니다") ||
      !visual?.final_frame?.meeting_note?.includes(
        "다음 회의에서 영상 검토 안건 다시 선택",
      ) ||
      !visual?.final_frame?.meeting_note?.includes(
        "잠근 두 안건과 공개된 경기 기록을 바꾸지 않습니다",
      )) {
    errors.push(
      "visual rehearsal question, held-out, counterevidence, or immutable-memo proof drifted",
    );
  }
  if (!Number.isFinite(visual?.video?.duration_seconds) ||
      visual.video.duration_seconds < 59.5 ||
      visual.video.duration_seconds > 61.5) {
    errors.push("visual rehearsal duration drifted");
  }

  if (narrated?.status !==
        "local-narrated-rehearsal-not-youtube-or-human-evidence" ||
      narrated?.submission_story_sha256 !== storyHash ||
      narrated?.visual_source?.manifest_sha256 !==
        (visualManifestBytes ? sha256(visualManifestBytes) : null) ||
      narrated?.visual_source?.video_sha256 !==
        (visualBytes ? sha256(visualBytes) : null) ||
      narrated?.captions?.presentation !== "burned-in" ||
      narrated?.narrated_video?.path !== story.evidence.narrated_video.path ||
      narrated?.narrated_video?.sha256 !==
        (narratedBytes ? sha256(narratedBytes) : null) ||
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
