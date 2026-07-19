import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseStrictRfc3339,
  runEligibilityAcceptanceTests,
  sha256Text,
  validateEligibilityArtifacts,
  validateDeployedProductData,
  validateEligibilityPromotion,
  validateEligibilityState,
  validateEligibilityTrackedArtifacts,
  validateOfficialAnswerLive,
  validateOfficialScopeLive,
} from "./lib/eligibility.mjs";

const [stateText, officialState, organizerQuestion, productThesis, planningSource, manifestText, productSelectionText] = await Promise.all([
  readFile("docs/data-scope-resolution.json", "utf8"),
  readFile("docs/official-state.md", "utf8"),
  readFile("docs/organizer-data-scope-question.md", "utf8"),
  readFile("docs/product-thesis.md", "utf8"),
  readFile("docs/planning-outline.md", "utf8"),
  readFile("data/source-manifest.json", "utf8"),
  readFile("docs/product-selection.json", "utf8"),
]);
const state = JSON.parse(stateText);
const manifest = JSON.parse(manifestText);
const productSelection = JSON.parse(productSelectionText);
const verifiedAt = officialState.match(/^Verified:\s*`([^`]+)`/mu)[1];
const now = new Date(Math.max(
  parseStrictRfc3339(verifiedAt),
  ...manifest.sources
    .map((source) => parseStrictRfc3339(source.acceptance_evidence?.accepted_at))
    .filter(Number.isFinite),
) + 60 * 60 * 1000);
const questionSubject = "2026 월드컵 데이터 범위와 역사적 전술 데이터 병행 사용 가능 여부";
const questionProposition = "2026년 실제 팀·경기 일정 데이터와, `2018 역사적 리허설이며 2026 성향이나 결과 예측이 아님`이라고 명확히 표시한 2018 월드컵 전술 이벤트 데이터를 함께 사용";
const canonicalQuestionMessage = `제목: ${questionSubject}\n\nA 구성: ${questionProposition}\n\nA 구성 허용\nA 구성 불가 — 핵심 전술 근거도 2026 월드컵 경기 데이터 필수\n`;

const canonicalInput = (overrides = {}) => ({
  state, officialState, organizerQuestion, productThesis, planningSource, manifest, productSelection, now,
  raw: { officialState, organizerQuestion, productThesis, planningSource, manifest: manifestText, productSelection: productSelectionText },
  ...overrides,
});

function artifact(path, content, files) {
  files.set(resolve("/repo", path), Buffer.from(content));
  return { path, sha256: sha256Text(content) };
}

function acceptSource(source, files, capabilities = source.capabilities) {
  const id = source.id;
  const rawTestPath = `evidence/${id}/${id}.raw.test.mjs`;
  const releaseTestPath = `evidence/${id}/${id}.release.test.mjs`;
  const testArgv = ["node_modules/vitest/vitest.mjs", "run", releaseTestPath];
  const artifacts = {};
  artifacts.rights = artifact(`evidence/${id}/rights.json`, JSON.stringify({
    schema_version: 1, status: "CLEARED", source_id: id, source_url: source.url, license: source.license,
    evidence_url: source.url, checked_at: "2026-07-17T21:00:00+09:00",
    allowed_uses: ["public_prize_entry", "public_github", "hosted_app", "youtube_demo", "derived_distribution"],
  }), files);
  artifacts.capability = artifact(`evidence/${id}/capability.json`, JSON.stringify({
    schema_version: 1, status: "PASS", source_id: id, capabilities,
    schema_assertions: ["source schema inspected"], reviewer: "independent-reviewer",
    checked_at: "2026-07-17T21:00:00+09:00",
  }), files);
  artifacts.transform = artifact(`evidence/${id}/transform.mjs`, `${id} transform evidence`, files);
  artifacts.raw_transform_test = artifact(rawTestPath, `${id} raw transform test evidence`, files);
  artifacts.raw_transform_receipt = artifact(
    `evidence/${id}/test-receipt.json`,
    JSON.stringify({ schema_version: 1, status: "PASS", source_id: id,
      test_argv: ["node_modules/vitest/vitest.mjs", "run", rawTestPath], completed_at: "2026-07-17T21:00:00+09:00", result: "7/7 passed" }),
    files,
  );
  artifacts.release_test = artifact(releaseTestPath, `${id} release test evidence`, files);
  artifacts.release_test_receipt = artifact(
    `evidence/${id}/release-test-receipt.json`,
    JSON.stringify({ schema_version: 1, status: "PASS", source_id: id, test_argv: testArgv, completed_at: "2026-07-17T21:00:00+09:00" }),
    files,
  );
  artifacts.derived = artifact(`evidence/${id}/derived.json`, JSON.stringify({ provenance: { source_ids: [id] } }), files);
  const ids = Array.from({ length: 42 }, (_, index) => index + 1);
  const semanticReview = artifact(`evidence/${id}/semantic-review.json`, JSON.stringify({
    schema_version: 1, status: "PASS", reviewer: "independent-reviewer", public_json_sha256: artifacts.derived.sha256,
    final_result: { structural_pass: 42, semantic_pass: 42, uncertain: 0, fail: 0 },
    structural_pass_ids: ids, semantic_pass_ids: ids,
  }), files);
  const windowReview = artifact(`evidence/${id}/window-review.csv`, ["id,structural,semantic,note", ...ids.map((value) => `${value},pass,pass,ok`)].join("\n"), files);
  artifacts.semantic_review = semanticReview;
  artifacts.window_review = windowReview;
  artifacts.audit = artifact(`evidence/${id}/audit.json`, JSON.stringify({
    schema_version: 1, status: "PASS", source_id: id, reviewer: "independent-reviewer",
    assertions: ["full source audit passed"], checked_at: "2026-07-17T21:00:00+09:00", public_json_sha256: artifacts.derived.sha256,
    final_result: { structural_pass: 42, semantic_pass: 42, uncertain: 0, fail: 0 },
    semantic_review: semanticReview, window_review: windowReview,
  }), files);
  return {
    ...source,
    status: "accepted",
    rights_status: "cleared",
    capabilities,
    acceptance_evidence: {
      accepted_at: "2026-07-17T21:00:00+09:00",
      implementer: "data-implementer",
      reviewer: "independent-reviewer",
      test_argv: testArgv,
      artifacts,
    },
  };
}

function resolvedFixture(route = "hybrid") {
  const files = new Map();
  const relativeTime = (hoursBeforeNow) => new Date(now - hoursBeforeNow * 60 * 60 * 1000).toISOString().replace(".000Z", "Z");
  const sourceIds = route === "hybrid"
    ? ["openfootball-worldcup-2026", "pappalardo-wyscout-events-wc-2018", "pappalardo-wyscout-matches-wc-2018"]
    : ["rights-cleared-2026-events"];
  let sources = manifest.sources.map((source) => sourceIds.includes(source.id) ? acceptSource(source, files) : source);
  if (route !== "hybrid") {
    sources = [...sources, acceptSource({
      id: sourceIds[0], title: "World Cup 2026 events", url: "https://data.rightsholder.org/2026-events",
      publisher: "Rights holder", retrieved_at_kst: "2026-07-17", license: "Public prize use granted",
      rights_status: "cleared", capabilities: ["tactical_events_2026"], status: "pending",
      product_use: "2026 tactical evidence", coverage: "2026 World Cup", schema_units: "event rows",
    }, files, ["tactical_events_2026"])];
  }
  const resolvedManifest = { ...manifest, sources };
  const scope = route === "hybrid" ? "hybrid-2026-context-plus-historical-tactics" : "2026-tactical-only";
  const productId = route === "hybrid" ? "corner-policy-lab" : "current-match-war-room";
  const productData = artifact("public/data/scenarios.json", JSON.stringify({ provenance: { source_ids: sourceIds }, scenarios: [] }), files);
  const resolvedSelection = {
    schema_version: 1, status: "selected", product_id: productId, data_scope: scope,
    source_ids: sourceIds,
    core_tactical_source_ids: route === "hybrid" ? ["pappalardo-wyscout-events-wc-2018"] : sourceIds,
    data_files: [productData],
  };
  const resolvedThesis = route === "hybrid"
    ? productThesis
      .replace("Product data scope: `official-open-historical-tactics`", `Product data scope: \`${scope}\``)
    : `# Product Thesis\n\nProduct selection ID: \`${productId}\`\n\nProduct data scope: \`${scope}\`\n`;
  const resolvedPlanning = route === "hybrid"
    ? planningSource.replace("Product data scope: `official-open-historical-tactics`", `Product data scope: \`${scope}\``)
    : `# Planning\n\nProduct selection ID: \`${productId}\`\n\nProduct data scope: \`${scope}\`\n`;
  const resolvedQuestion = route === "hybrid"
    ? "# Question\n\nStatus: `ANSWERED`\n"
    : "# Question\n\nStatus: `WITHDRAWN — NOT NEEDED`\n";
  const questionUrl = "https://daker.ai/community/world-cup-data-scope-123";
  const questionCapture = route === "hybrid" ? artifact(
    "evidence/organizer-question.bin",
    `screenshot bytes for ${questionUrl}`,
    files,
  ) : null;
  const postedQuestion = route === "hybrid" ? artifact(
    "evidence/organizer-data-scope-message.txt", canonicalQuestionMessage, files,
  ) : null;
  const questionReview = route === "hybrid" ? artifact(
    "evidence/organizer-question-content-review.json",
    JSON.stringify({
      schema_version: 1, status: "PASS", question_url: questionUrl,
      post_id: "world-cup-data-scope-123", owner: "jhkang",
      capture_sha256: questionCapture.sha256, posted_question_sha256: postedQuestion.sha256,
      proposition_sha256: sha256Text(questionProposition), wording_matches: true,
      reviewed_at: relativeTime(4),
    }),
    files,
  ) : null;
  const resolvedManifestText = JSON.stringify(resolvedManifest);
  const resolvedSelectionText = JSON.stringify(resolvedSelection);
  const derivedContent = JSON.stringify({
    schema_version: 1, product_id: productId, data_scope: scope, source_ids: sourceIds,
    core_tactical_source_ids: resolvedSelection.core_tactical_source_ids, data_files: resolvedSelection.data_files,
  });
  const derivedBinding = artifact("public/data/product-binding.json", derivedContent, files);
  const answerUrl = `${questionUrl}#answer-9`;
  const quote = "네, 2026 경기 맥락과 명시된 과거 월드컵 전술 근거의 함께 사용이 허용됩니다.";
  const answerCapture = route === "hybrid" ? artifact(
    "evidence/organizer-answer.md",
    `${answerUrl}\n${quote}\nDAKER 운영팀\n대회 운영자\n`,
    files,
  ) : null;
  const semanticReview = route === "hybrid" ? artifact(
    "evidence/organizer-answer-semantic-review.json",
    JSON.stringify({
      schema_version: 1, status: "PASS", route: "hybrid-2026-context-plus-historical-tactics",
      quote_sha256: sha256Text(quote), reviewer_role: "owner",
      explicitly_allows_2026_context: true, explicitly_allows_historical_tactics: true,
      contains_denial_or_2026_only_requirement: false, reviewed_at: relativeTime(1),
    }),
    files,
  ) : null;
  const resolvedState = {
    ...state,
    status: route === "hybrid" ? "confirmed-hybrid" : "resolved-2026-tactical",
    route: scope,
    question_status: route === "hybrid" ? "answered" : "withdrawn-not-needed",
    question_evidence: route === "hybrid" ? {
      question_url: questionUrl, post_id: "world-cup-data-scope-123", owner: "jhkang",
      posted_at: relativeTime(5), capture: questionCapture,
      posted_question: postedQuestion, content_review: questionReview,
    } : null,
    answer_evidence: route === "hybrid" ? {
      disposition: "hybrid-allowed", owner_reviewed: true,
      question_url: questionUrl,
      answer_url: answerUrl, quote, author: "DAKER 운영팀", author_role: "대회 운영자",
      captured_at: relativeTime(3), checked_at: relativeTime(2),
      capture: answerCapture, live_content_sha256: answerCapture.sha256, semantic_review: semanticReview,
    } : null,
    scope_evidence: null,
    evidence_source_ids: sourceIds,
    binding: {
      product_id: productId,
      official_state_sha256: sha256Text(officialState),
      organizer_question_sha256: sha256Text(resolvedQuestion),
      product_thesis_sha256: sha256Text(resolvedThesis),
      planning_source_sha256: sha256Text(resolvedPlanning),
      source_manifest_sha256: sha256Text(resolvedManifestText),
      product_selection_sha256: sha256Text(resolvedSelectionText),
      derived_binding: derivedBinding,
    },
  };
  return {
    files,
    input: {
      state: resolvedState, officialState, organizerQuestion: resolvedQuestion,
      productThesis: resolvedThesis, planningSource: resolvedPlanning, manifest: resolvedManifest,
      productSelection: resolvedSelection, now,
      raw: {
        officialState, organizerQuestion: resolvedQuestion, productThesis: resolvedThesis,
        planningSource: resolvedPlanning, manifest: resolvedManifestText, productSelection: resolvedSelectionText,
      },
    },
  };
}

const readFixture = (files) => async (path) => {
  if (!files.has(path)) throw new Error("missing");
  return files.get(path);
};
const lstatFixture = async () => ({ isSymbolicLink: () => false });

describe("competition data-scope eligibility contract", () => {
  it("accepts and promotes the admitted official open historical route", async () => {
    expect(validateEligibilityState(canonicalInput())).toEqual([]);
    expect(validateEligibilityPromotion(canonicalInput())).toEqual([]);
    const liveRecord = {
      id: "ae1d9c81-9328-4733-902c-b093561b566c",
      slug: "world-cup-manager-tactics-web-challenge",
      tagline: "2026 FIFA 월드컵 데이터를 활용해 내가 감독이 되어 전술을 짜고 선수를 배치하는 동적 웹서비스를 만드는 해커톤",
      dataDescription: "<p><strong>선수·팀·경기 데이터는 더미 데이터를 직접 구성하여 사용하는 것을 권장합니다.<br></strong>실제 선수 이름, 포지션, 국가 등의 정보를 참고하여 직접 하드 코딩하거나 JSON 형태로 구성할 수 있습니다.<br>특정 연도·대회·선수 구성에 대한 제한은 없으며, 참가자가 자유롭게 설정할 수 있습니다.<br><strong>외부 API 사용을 원할 경우, 상업적 이용이 허용된 무료 플랜인지 라이선스를 반드시 확인 후 활용해야 합니다.</strong></p>",
      updatedAt: "2026-07-13T04:47:47.898Z",
    };
    const fetchImpl = async () => ({ ok: true, status: 200, url: state.scope_evidence.api_url, json: async () => liveRecord });
    expect(await validateOfficialScopeLive({ state, fetchImpl })).toEqual([]);
    expect(await validateOfficialScopeLive({
      state,
      fetchImpl: async () => ({ ...await fetchImpl(), json: async () => ({ ...liveRecord, dataDescription: "changed" }) }),
    })).toContain("official Data-tab stable fields changed since scope admission");
  });

  it("accepts a SHA-bound posted-awaiting-answer state but still blocks promotion", async () => {
    const files = new Map();
    const questionUrl = "https://daker.ai/community/world-cup-data-scope-456";
    const capture = artifact("evidence/organizer-question.bin", `screenshot bytes for ${questionUrl}`, files);
    const postedQuestion = artifact("evidence/organizer-data-scope-message.txt", canonicalQuestionMessage, files);
    const contentReview = artifact("evidence/organizer-question-content-review.json", JSON.stringify({
      schema_version: 1, status: "PASS", question_url: questionUrl,
      post_id: "world-cup-data-scope-456", owner: "jhkang",
      capture_sha256: capture.sha256, posted_question_sha256: postedQuestion.sha256,
      proposition_sha256: sha256Text(questionProposition), wording_matches: true,
      reviewed_at: "2026-07-18T00:15:00+09:00",
    }), files);
    const postedState = {
      ...state,
      status: "unresolved",
      route: null,
      question_status: "posted-awaiting-answer",
      question_evidence: {
        question_url: questionUrl, post_id: "world-cup-data-scope-456", owner: "jhkang",
        posted_at: "2026-07-18T00:10:00+09:00", capture, posted_question: postedQuestion,
        content_review: contentReview,
      },
      scope_evidence: null,
      evidence_source_ids: [],
      binding: null,
    };
    const postedMarkdown = "# Organizer Data-Scope Question\n\nStatus: `POSTED — AWAITING ANSWER`\n";
  const unresolvedThesis = productThesis
      .replace("Product data scope: `official-open-historical-tactics`", "Product data scope: `unresolved-hybrid`")
      .replace("Product selection status: `PASS`", "Product selection status: `REVISE — conditional selection`");
    const unresolvedSelection = {
      ...productSelection,
      status: "conditional",
      data_scope: "unresolved-hybrid",
      source_ids: [],
      core_tactical_source_ids: [],
      data_files: [],
    };
    const input = canonicalInput({
      state: postedState, organizerQuestion: postedMarkdown,
      productThesis: unresolvedThesis, productSelection: unresolvedSelection,
    });
    expect(validateEligibilityState(input)).toEqual([]);
    expect(validateEligibilityPromotion(input)).toContain("submission promotion blocked: organizer data scope is unresolved");
    expect(await validateEligibilityArtifacts({ ...input, root: "/repo", readFile: readFixture(files), lstat: lstatFixture })).toEqual([]);

    expect(validateEligibilityState({ ...input, state: { ...postedState, question_evidence: null } }))
      .toContain("posted organizer question requires a non-placeholder official DAKER board URL");
    expect(validateEligibilityState({
      ...input, state: { ...postedState, question_evidence: { ...postedState.question_evidence, question_url: "https://daker.ai/community" } },
    })).toContain("posted organizer question requires a non-placeholder official DAKER board URL");
    expect(await validateEligibilityArtifacts({
      ...input, state: { ...postedState, question_evidence: { ...postedState.question_evidence, capture: { ...capture, sha256: "a".repeat(64) } } },
      root: "/repo", readFile: readFixture(files), lstat: lstatFixture,
    })).toContain("organizer question capture SHA-256 mismatch");
    expect(await validateEligibilityArtifacts({
      ...input, root: "/repo", readFile: async () => { throw new Error("missing"); }, lstat: lstatFixture,
    })).toContain(`organizer question capture path is missing: ${capture.path}`);
    expect(validateEligibilityTrackedArtifacts({ ...input, tracker: () => false }))
      .toContain(`eligibility artifact is not tracked by Git: ${capture.path}`);

    const unrelatedFiles = new Map(files);
    const unrelated = Buffer.from("an unrelated tracked file with no organizer question");
    unrelatedFiles.set(resolve("/repo", postedQuestion.path), unrelated);
    expect(await validateEligibilityArtifacts({
      ...input,
      state: {
        ...postedState,
        question_evidence: {
          ...postedState.question_evidence,
          posted_question: { ...postedQuestion, sha256: sha256Text(unrelated) },
        },
      },
      root: "/repo", readFile: readFixture(unrelatedFiles), lstat: lstatFixture,
    })).toContain(`canonical posted question missing exact marker: ${questionSubject}`);

    const badReviewFiles = new Map(files);
    const alteredReview = JSON.stringify({
      schema_version: 1, status: "PASS", question_url: questionUrl,
      post_id: "world-cup-data-scope-456", owner: "jhkang",
      capture_sha256: capture.sha256, posted_question_sha256: postedQuestion.sha256,
      proposition_sha256: sha256Text("altered A wording"), wording_matches: true,
      reviewed_at: "2026-07-18T00:15:00+09:00",
    });
    badReviewFiles.set(resolve("/repo", contentReview.path), Buffer.from(alteredReview));
    expect(await validateEligibilityArtifacts({
      ...input,
      state: {
        ...postedState,
        question_evidence: {
          ...postedState.question_evidence,
          content_review: { ...contentReview, sha256: sha256Text(alteredReview) },
        },
      },
      root: "/repo", readFile: readFixture(badReviewFiles), lstat: lstatFixture,
    })).toContain("organizer question owner content review does not bind the exact visible post to the canonical A proposition");
  });

  it("accepts both evidenced routes and verifies every bound artifact", async () => {
    for (const route of ["hybrid", "2026-only"]) {
      const fixture = resolvedFixture(route);
      expect(validateEligibilityPromotion(fixture.input)).toEqual([]);
      expect(await validateEligibilityArtifacts({ ...fixture.input, root: "/repo", readFile: readFixture(fixture.files), lstat: lstatFixture })).toEqual([]);
      expect(runEligibilityAcceptanceTests({ ...fixture.input, root: "/repo", runner: () => ({ status: 0 }) })).toEqual([]);
      const selectedData = fixture.input.productSelection.data_files[0];
      const deployedBytes = fixture.files.get(resolve("/repo", selectedData.path));
      expect(await validateDeployedProductData({
        productSelection: fixture.input.productSelection,
        distRoot: "/dist",
        readFile: async (path) => {
          if (path !== resolve("/dist", selectedData.path.slice("public/".length))) throw new Error("missing");
          return deployedBytes;
        },
      })).toEqual([]);
      expect(await validateDeployedProductData({
        productSelection: fixture.input.productSelection, distRoot: "/dist", readFile: async () => { throw new Error("missing"); },
      })).toContain(`${selectedData.path} is absent from dist`);
      if (route === "hybrid") {
        const answer = fixture.input.state.answer_evidence;
        const liveBytes = fixture.files.get(resolve("/repo", answer.capture.path));
        expect(await validateOfficialAnswerLive({
          state: fixture.input.state,
          fetchImpl: async () => ({ ok: true, status: 200, url: answer.answer_url, arrayBuffer: async () => liveBytes }),
        })).toEqual([]);
      }
    }
  });

  it("rejects the competition page, denied disposition, invalid dates, and missing capture bytes", async () => {
    const fixture = resolvedFixture("hybrid");
    expect(validateEligibilityPromotion({
      ...fixture.input,
      state: { ...fixture.input.state, answer_evidence: { ...fixture.input.state.answer_evidence, answer_url: state.official_url } },
    })).toContain("hybrid route requires non-placeholder official DAKER board URLs");
    expect(validateEligibilityPromotion({
      ...fixture.input,
      state: { ...fixture.input.state, answer_evidence: { ...fixture.input.state.answer_evidence, disposition: "hybrid-denied" } },
    })).toContain("hybrid route requires an owner-reviewed hybrid-allowed answer disposition");
    for (const deniedQuote of [
      "2026 경기 맥락과 2018 과거 전술 근거의 함께 사용은 허용되지 않습니다.",
      "2026 경기 맥락과 2018 과거 전술 근거의 함께 사용은 허용할 수 없습니다.",
      "2026 and historical 2018 data are not eligible together.",
    ]) {
      expect(validateEligibilityPromotion({
        ...fixture.input,
        state: { ...fixture.input.state, answer_evidence: { ...fixture.input.state.answer_evidence, quote: deniedQuote } },
      })).toContain("hybrid answer quote must explicitly and positively authorize the 2026-plus-historical route");
    }
    expect(Number.isNaN(parseStrictRfc3339("2099-02-31T10:00:00+09:00"))).toBe(true);
    const emptyFiles = new Map(fixture.files);
    emptyFiles.delete(resolve("/repo", fixture.input.state.answer_evidence.capture.path));
    expect(await validateEligibilityArtifacts({ ...fixture.input, root: "/repo", readFile: readFixture(emptyFiles), lstat: lstatFixture })).toContain(
      `organizer answer capture path is missing: ${fixture.input.state.answer_evidence.capture.path}`,
    );
    expect(await validateOfficialAnswerLive({
      state: fixture.input.state,
      fetchImpl: async () => ({ ok: true, status: 200, url: fixture.input.state.answer_evidence.answer_url, arrayBuffer: async () => Buffer.from("different live page") }),
    })).toContain("official answer live bytes do not match the captured SHA-256");
  });

  it("rejects accepted-status laundering, artifact hash drift, and self review", async () => {
    const fixture = resolvedFixture("hybrid");
    const firstId = fixture.input.state.evidence_source_ids[0];
    const statusOnlyManifest = {
      ...manifest,
      sources: manifest.sources.map((source) => source.id === firstId ? { ...source, status: "accepted" } : source),
    };
    expect(validateEligibilityPromotion({ ...fixture.input, manifest: statusOnlyManifest })).toContain(
      `accepted source ${firstId}: missing acceptance_evidence`,
    );
    const source = fixture.input.manifest.sources.find((record) => record.id === firstId);
    const badSource = {
      ...source,
      acceptance_evidence: { ...source.acceptance_evidence, reviewer: source.acceptance_evidence.implementer },
    };
    const badManifest = { ...fixture.input.manifest, sources: fixture.input.manifest.sources.map((record) => record.id === firstId ? badSource : record) };
    expect(validateEligibilityPromotion({ ...fixture.input, manifest: badManifest })).toContain(
      `accepted source ${firstId}: reviewer must be independently named and differ from implementer`,
    );
    const driftedFiles = new Map(fixture.files);
    const transform = source.acceptance_evidence.artifacts.transform;
    driftedFiles.set(resolve("/repo", transform.path), Buffer.from("tampered"));
    expect(await validateEligibilityArtifacts({ ...fixture.input, root: "/repo", readFile: readFixture(driftedFiles), lstat: lstatFixture })).toContain(`${firstId} transform SHA-256 mismatch`);
    expect(runEligibilityAcceptanceTests({ ...fixture.input, root: "/repo", runner: () => ({ status: 1 }) })).toContain(
      `${firstId} acceptance test failed: ${source.acceptance_evidence.test_argv.join(" ")}`,
    );
  });

  it("rejects fixture aliases and a 2026-only marker pasted onto the historical plan", () => {
    const fixture = resolvedFixture("2026-only");
    const id = fixture.input.state.evidence_source_ids[0];
    const aliasManifest = {
      ...fixture.input.manifest,
      sources: fixture.input.manifest.sources.map((source) => source.id === id ? { ...source, capabilities: ["fixture_context_2026"] } : source),
    };
    expect(validateEligibilityPromotion({ ...fixture.input, manifest: aliasManifest })).toContain("2026 tactical route lacks an accepted tactical 2026 capability");
    const openFootballLaundered = {
      ...manifest,
      sources: manifest.sources.map((source) => source.id === "openfootball-worldcup-2026" ? { ...source, capabilities: ["tactical_events_2026"] } : source),
    };
    expect(validateEligibilityState(canonicalInput({ manifest: openFootballLaundered }))).toContain(
      "OpenFootball fixture data cannot declare a tactical 2026 capability: openfootball-worldcup-2026",
    );
    expect(validateEligibilityPromotion({
      ...fixture.input,
      productThesis: `${productThesis}\nProduct data scope: \`2026-tactical-only\``,
      planningSource: `${planningSource}\nProduct data scope: \`2026-tactical-only\``,
    })).toContain("2026 tactical-only route still contains historical core evidence");
    expect(validateEligibilityPromotion({
      ...fixture.input,
      productSelection: {
        ...fixture.input.productSelection,
        data_files: [{ path: "public/data/../../package.json", sha256: "a".repeat(64) }],
      },
    })).toContain("selected product requires unique SHA-bound public data files");
    expect(validateEligibilityPromotion({
      ...fixture.input,
      state: {
        ...fixture.input.state,
        binding: { ...fixture.input.state.binding, derived_binding: { path: "public/data/../../package.json", sha256: "a".repeat(64) } },
      },
    })).toContain("resolved eligibility requires a normalized public/data derived product binding");
  });
});
