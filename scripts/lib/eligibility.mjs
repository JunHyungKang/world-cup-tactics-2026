import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat as lstatFs, readFile as readFileFs } from "node:fs/promises";
import { isAbsolute, normalize, relative, resolve } from "node:path";

const canonicalOfficialUrl = "https://daker.ai/public/hackathons/world-cup-manager-tactics-web-challenge";
const canonicalOfficialApiUrl = "https://daker.ai/api/hackathons/world-cup-manager-tactics-web-challenge";
const officialScopeText = "2026 FIFA 월드컵 데이터를 활용";
const officialOpenScopeQuote = "특정 연도·대회·선수 구성에 대한 제한은 없으며, 참가자가 자유롭게 설정할 수 있습니다.";
const officialOpenScopeRoute = "official-open-historical-tactics";
const validStatuses = new Set(["unresolved", "scope-confirmed-open", "resolved-official-open-historical", "confirmed-hybrid", "resolved-2026-tactical"]);
const allowedRightsStatuses = new Set(["cleared", "pending", "unresolved"]);
const acceptanceArtifactKeys = [
  "rights", "capability", "transform", "raw_transform_test", "raw_transform_receipt",
  "release_test", "release_test_receipt", "semantic_review", "window_review", "audit", "derived",
];
const tactical2026Capabilities = new Set(["tactical_events_2026", "tactical_tracking_2026", "tactical_aggregates_2026"]);
const sha256Pattern = /^[a-f0-9]{64}$/u;
const requiredQuestionSubject = "2026 월드컵 데이터 범위와 역사적 전술 데이터 병행 사용 가능 여부";
const requiredQuestionProposition = "2026년 실제 팀·경기 일정 데이터와, `2018 역사적 리허설이며 2026 성향이나 결과 예측이 아님`이라고 명확히 표시한 2018 월드컵 전술 이벤트 데이터를 함께 사용";

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function parseStrictRfc3339(value) {
  if (typeof value !== "string") return Number.NaN;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|([+-])(\d{2}):(\d{2}))$/u);
  if (!match) return Number.NaN;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, sign, offsetHourText, offsetMinuteText] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const localUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const local = new Date(localUtc);
  if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day ||
      local.getUTCHours() !== hour || local.getUTCMinutes() !== minute || local.getUTCSeconds() !== second) return Number.NaN;
  let offsetMinutes = 0;
  if (zone !== "Z") {
    const offsetHour = Number(offsetHourText);
    const offsetMinute = Number(offsetMinuteText);
    if (offsetHour > 23 || offsetMinute > 59) return Number.NaN;
    offsetMinutes = (offsetHour * 60 + offsetMinute) * (sign === "+" ? 1 : -1);
  }
  const epoch = localUtc - offsetMinutes * 60_000;
  return Date.parse(value) === epoch ? epoch : Number.NaN;
}

function isFreshPastTimestamp(value, nowMs, maxAgeMs = Number.POSITIVE_INFINITY) {
  const parsed = parseStrictRfc3339(value);
  return Number.isFinite(parsed) && parsed <= nowMs && nowMs - parsed <= maxAgeMs;
}

function parseOfficialVerifiedAt(officialState) {
  const match = officialState.match(/^Verified:\s*`([^`]+)`\s+against:/mu);
  return match ? parseStrictRfc3339(match[1]) : Number.NaN;
}

export function isOfficialBoardUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && (url.hostname === "daker.ai" || url.hostname.endsWith(".daker.ai")) &&
      segments.length >= 2 && url.href !== canonicalOfficialUrl && !url.pathname.startsWith("/public/hackathons/") &&
      !/^(?:community|board|boards|questions|qna)$/iu.test(segments.at(-1)) && !/example/iu.test(url.href);
  } catch {
    return false;
  }
}

function hasExactStatus(markdown, status) {
  return markdown.match(/^Status: `([^`]+)`$/mu)?.[1] === status;
}

function hasNormalizedText(text, marker) {
  return typeof text === "string" && text.replace(/\s+/gu, " ").includes(marker);
}

function questionEvidenceErrors(evidence, nowMs) {
  const errors = [];
  if (!evidence || !isOfficialBoardUrl(evidence.question_url)) errors.push("posted organizer question requires a non-placeholder official DAKER board URL");
  if (!(evidence?.post_id === null || (typeof evidence?.post_id === "string" && evidence.post_id.trim().length > 0))) {
    errors.push("posted organizer question post_id must be a non-empty string or null when the board shows no ID");
  }
  if (typeof evidence?.owner !== "string" || evidence.owner.trim().length < 2 || /^(?:test|unknown|agent|codex|self)$/iu.test(evidence.owner)) {
    errors.push("posted organizer question requires a real owner identity");
  }
  if (!isFreshPastTimestamp(evidence?.posted_at, nowMs)) errors.push("posted organizer question requires a real non-future posted_at timestamp");
  if (!evidence?.capture || !safeRelativePath(evidence.capture.path) || !sha256Pattern.test(evidence.capture.sha256 ?? "")) {
    errors.push("posted organizer question requires a repo-contained SHA-bound capture");
  }
  for (const [key, label] of [["posted_question", "canonical posted message"], ["content_review", "owner content review"]]) {
    const artifact = evidence?.[key];
    if (!artifact || !safeRelativePath(artifact.path) || !sha256Pattern.test(artifact.sha256 ?? "")) {
      errors.push(`posted organizer question requires a repo-contained SHA-bound ${label}`);
    }
  }
  return errors;
}

function uniqueStrings(values) {
  return Array.isArray(values) && values.every((value) => typeof value === "string" && value.length > 0) &&
    new Set(values).size === values.length;
}

function safeRelativePath(path) {
  return typeof path === "string" && path.length > 0 && !isAbsolute(path) && !path.includes("\\") &&
    normalize(path) === path && !path.split("/").includes("..") && !path.split("/").includes(".");
}

function safePublicDataPath(path) {
  return safeRelativePath(path) && path.startsWith("public/data/") && path.length > "public/data/".length;
}

function sourceById(manifest, id) {
  return manifest.sources.find((source) => source.id === id);
}

function acceptanceEvidenceErrors(source, nowMs) {
  const errors = [];
  const evidence = source?.acceptance_evidence;
  if (!evidence || typeof evidence !== "object") return ["missing acceptance_evidence"];
  if (!isFreshPastTimestamp(evidence.accepted_at, nowMs)) errors.push("accepted_at must be a real non-future RFC3339 timestamp");
  for (const field of ["implementer", "reviewer"]) {
    if (typeof evidence[field] !== "string" || evidence[field].trim().length < 3) errors.push(`missing ${field}`);
  }
  if (evidence.implementer === evidence.reviewer || /^(?:self|test|unknown|codex)$/iu.test(evidence.reviewer ?? "")) {
    errors.push("reviewer must be independently named and differ from implementer");
  }
  if (!evidence.artifacts || typeof evidence.artifacts !== "object") return [...errors, "missing artifacts"];
  for (const key of acceptanceArtifactKeys) {
    const artifact = evidence.artifacts[key];
    if (!artifact || typeof artifact.path !== "string" || !sha256Pattern.test(artifact.sha256 ?? "")) {
      errors.push(`invalid ${key} artifact binding`);
    }
  }
  if (!Array.isArray(evidence.test_argv) || evidence.test_argv.length !== 3 ||
      evidence.test_argv[0] !== "node_modules/vitest/vitest.mjs" || evidence.test_argv[1] !== "run" ||
      evidence.test_argv[2] !== evidence.artifacts.release_test?.path) {
    errors.push("test_argv must run the bound raw-free release test artifact through Vitest without a shell");
  }
  return errors;
}

function manifestContractErrors(manifest, nowMs) {
  const errors = [];
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.sources)) return ["source manifest schema is invalid"];
  const ids = manifest.sources.map((source) => source.id);
  if (!uniqueStrings(ids)) errors.push("source manifest IDs must be non-empty and unique");
  const urls = manifest.sources.map((source) => source.url);
  if (!uniqueStrings(urls)) errors.push("source manifest URLs must be non-empty and unique");
  for (const source of manifest.sources) {
    if (!allowedRightsStatuses.has(source.rights_status)) errors.push(`source ${source.id} has invalid rights_status`);
    if (!uniqueStrings(source.capabilities)) errors.push(`source ${source.id} capabilities must be unique strings`);
    if (/openfootball/iu.test(`${source.id} ${source.title} ${source.publisher} ${source.url}`) &&
        source.capabilities.some((capability) => tactical2026Capabilities.has(capability))) {
      errors.push(`OpenFootball fixture data cannot declare a tactical 2026 capability: ${source.id}`);
    }
    if (source.status === "accepted") {
      if (source.rights_status !== "cleared") errors.push(`accepted source lacks cleared rights: ${source.id}`);
      for (const error of acceptanceEvidenceErrors(source, nowMs)) errors.push(`accepted source ${source.id}: ${error}`);
    }
  }
  return errors;
}

function rawHashMatches(binding, field, raw, errors) {
  if (!sha256Pattern.test(binding?.[field] ?? "")) errors.push(`eligibility binding requires ${field}`);
  else if (typeof raw !== "string" || sha256Text(raw) !== binding[field]) errors.push(`eligibility binding hash mismatch: ${field}`);
}

export function validateEligibilityState({
  state, officialState, organizerQuestion, productThesis, manifest, productSelection,
  planningSource, raw = {}, now = new Date(), promotion = false,
}) {
  const errors = [];
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (state.schema_version !== 3) errors.push("eligibility state schema_version must be 3");
  if (state.official_scope_text !== officialScopeText) errors.push(`eligibility state must pin official scope text: ${officialScopeText}`);
  if (state.official_url !== canonicalOfficialUrl) errors.push("eligibility state must pin the canonical official URL");
  if (!validStatuses.has(state.status)) errors.push(`invalid eligibility status: ${state.status}`);
  if (!officialState.includes(officialScopeText)) errors.push("official state must preserve the exact 2026 FIFA World Cup scope wording");
  if (!officialState.includes(canonicalOfficialUrl)) errors.push("official state must preserve the canonical competition URL");
  const verifiedAt = parseOfficialVerifiedAt(officialState);
  if (!Number.isFinite(verifiedAt) || verifiedAt > nowMs || nowMs - verifiedAt > 24 * 60 * 60 * 1000) {
    errors.push("official state verification must be a real, non-future timestamp within 24 hours");
  }
  errors.push(...manifestContractErrors(manifest, nowMs));

  if (state.status === "scope-confirmed-open") {
    if (state.route !== officialOpenScopeRoute) errors.push("scope-confirmed-open must select the official open historical route");
    if (state.question_status !== "withdrawn-not-needed" || state.question_evidence !== null || state.answer_evidence !== null ||
        !hasExactStatus(organizerQuestion, "WITHDRAWN — NOT NEEDED")) {
      errors.push("official open-scope route must preserve the unsent question as WITHDRAWN — NOT NEEDED");
    }
    if (state.binding !== null) errors.push("scope-confirmed-open must not claim final product bindings before data admission");
    if (!uniqueStrings(state.evidence_source_ids) || state.evidence_source_ids.length !== 0) {
      errors.push("scope-confirmed-open must not claim accepted product sources before data admission");
    }
    const scope = state.scope_evidence;
    if (!scope || scope.api_url !== canonicalOfficialApiUrl || scope.quote !== officialOpenScopeQuote ||
        typeof scope.hackathon_updated_at !== "string" || !sha256Pattern.test(scope.stable_fields_sha256 ?? "") ||
        !isFreshPastTimestamp(scope.checked_at, nowMs, 24 * 60 * 60 * 1000)) {
      errors.push("official open-scope route requires fresh canonical DAKER Data-tab evidence");
    }
    if (!scope?.capture || scope.capture.path !== "docs/official-state.md" || !sha256Pattern.test(scope.capture.sha256 ?? "")) {
      errors.push("official open-scope route requires a SHA-bound canonical official-state capture");
    }
    const review = scope?.independent_review;
    if (!review || typeof review.reviewer !== "string" || review.reviewer.trim().length < 3 ||
        /^(?:self|test|unknown|codex)$/iu.test(review.reviewer) || review.verdict !== "PASS" ||
        !isFreshPastTimestamp(review.reviewed_at, nowMs)) {
      errors.push("official open-scope route requires an independently named PASS review");
    }
    const scopeMarker = `Product data scope: \`${officialOpenScopeRoute}\``;
    if (!productThesis.includes(scopeMarker) || !(planningSource ?? "").includes(scopeMarker)) {
      errors.push("official open-scope route requires exact scope markers in thesis and planning source");
    }
    if (!hasNormalizedText(productThesis, "must not imply that a 2018 pattern describes a 2026 team")) {
      errors.push("official open-scope thesis must preserve the 2018-not-2026 limitation");
    }
    if (!productSelection || productSelection.schema_version !== 1 || productSelection.status !== "conditional" ||
        productSelection.product_id !== "corner-policy-lab" || productSelection.data_scope !== officialOpenScopeRoute ||
        !uniqueStrings(productSelection.source_ids) || productSelection.source_ids.length !== 0 ||
        !uniqueStrings(productSelection.core_tactical_source_ids) || productSelection.core_tactical_source_ids.length !== 0 ||
        !Array.isArray(productSelection.data_files) || productSelection.data_files.length !== 0) {
      errors.push("scope-confirmed-open requires the canonical conditional product-selection record");
    }
    if (promotion) errors.push("submission promotion blocked: eligible product data is not yet accepted");
    return errors;
  }

  if (state.status === "unresolved") {
    if (state.route !== null || state.answer_evidence !== null || state.binding !== null) errors.push("unresolved eligibility must not claim a route, answer, or binding");
    if (state.question_status === "draft-not-sent") {
      if (!hasExactStatus(organizerQuestion, "DRAFT — NOT SENT")) errors.push("draft organizer question must remain DRAFT — NOT SENT");
      if (state.question_evidence !== null) errors.push("draft organizer question must not claim posting evidence");
    } else if (state.question_status === "posted-awaiting-answer") {
      if (!hasExactStatus(organizerQuestion, "POSTED — AWAITING ANSWER")) errors.push("posted organizer question must be marked POSTED — AWAITING ANSWER");
      errors.push(...questionEvidenceErrors(state.question_evidence, nowMs));
    } else {
      errors.push("unresolved eligibility question_status must be draft-not-sent or posted-awaiting-answer");
    }
    if (!uniqueStrings(state.evidence_source_ids) || state.evidence_source_ids.length !== 0) errors.push("unresolved eligibility must not claim evidence sources");
    for (const marker of ["REVISE — conditional selection", "2018 only as a labeled historical evidence lens", "must not imply that a 2018 pattern describes a 2026 team"]) {
      if (!hasNormalizedText(productThesis, marker)) errors.push(`conditional thesis missing scope boundary: ${marker}`);
    }
    if (!productSelection || productSelection.schema_version !== 1 || productSelection.status !== "conditional" ||
        productSelection.product_id !== "corner-policy-lab" || productSelection.data_scope !== "unresolved-hybrid" ||
        !uniqueStrings(productSelection.source_ids) || productSelection.source_ids.length !== 0 ||
        !uniqueStrings(productSelection.core_tactical_source_ids) || productSelection.core_tactical_source_ids.length !== 0 ||
        !Array.isArray(productSelection.data_files) || productSelection.data_files.length !== 0) {
      errors.push("unresolved state requires the canonical conditional product-selection record");
    }
    if (promotion) errors.push("submission promotion blocked: organizer data scope is unresolved");
    return errors;
  }

  if (state.status === "resolved-official-open-historical") {
    if (state.route !== officialOpenScopeRoute) errors.push("resolved official-open state must select the official open historical route");
    if (state.question_status !== "withdrawn-not-needed" || state.question_evidence !== null || state.answer_evidence !== null ||
        !hasExactStatus(organizerQuestion, "WITHDRAWN — NOT NEEDED")) {
      errors.push("resolved official-open route must preserve the unsent question as WITHDRAWN — NOT NEEDED");
    }
    const scope = state.scope_evidence;
    if (!scope || scope.api_url !== canonicalOfficialApiUrl || scope.quote !== officialOpenScopeQuote ||
        typeof scope.hackathon_updated_at !== "string" || !sha256Pattern.test(scope.stable_fields_sha256 ?? "") ||
        !isFreshPastTimestamp(scope.checked_at, nowMs, 24 * 60 * 60 * 1000) ||
        !scope.capture || scope.capture.path !== "docs/official-state.md" || !sha256Pattern.test(scope.capture.sha256 ?? "")) {
      errors.push("resolved official-open route requires fresh canonical DAKER Data-tab evidence");
    }
    const review = scope?.independent_review;
    if (!review || typeof review.reviewer !== "string" || review.reviewer.trim().length < 3 ||
        /^(?:self|test|unknown|codex)$/iu.test(review.reviewer) || review.verdict !== "PASS" ||
        !isFreshPastTimestamp(review.reviewed_at, nowMs)) {
      errors.push("resolved official-open route requires an independently named PASS scope review");
    }
    const expectedIds = ["pappalardo-wyscout-events-wc-2018", "pappalardo-wyscout-matches-wc-2018"];
    if (JSON.stringify(state.evidence_source_ids) !== JSON.stringify(expectedIds)) {
      errors.push("resolved official-open route must bind exactly the admitted Figshare Events and Matches sources");
    }
    const scopeMarker = `Product data scope: \`${officialOpenScopeRoute}\``;
    if (!productThesis.includes(scopeMarker) || !(planningSource ?? "").includes(scopeMarker) ||
        !hasNormalizedText(productThesis, "must not imply that a 2018 pattern describes a 2026 team")) {
      errors.push("resolved official-open route is missing its historical-data scope boundaries");
    }
  }

  if (!uniqueStrings(state.evidence_source_ids) || state.evidence_source_ids.length === 0) errors.push("resolved eligibility requires unique evidence_source_ids");
  for (const id of state.evidence_source_ids ?? []) {
    const source = sourceById(manifest, id);
    if (!source) errors.push(`eligibility evidence source is absent from manifest: ${id}`);
    else {
      if (source.status !== "accepted") errors.push(`eligibility evidence source is not accepted: ${id}`);
      if (source.status === "accepted" && acceptanceEvidenceErrors(source, nowMs).length) errors.push(`eligibility evidence source lacks valid acceptance evidence: ${id}`);
    }
  }

  if (state.status === "confirmed-hybrid") {
    if (state.route !== "hybrid-2026-context-plus-historical-tactics") errors.push("confirmed-hybrid must select the hybrid route");
    if (state.question_status !== "answered" || !hasExactStatus(organizerQuestion, "ANSWERED")) errors.push("hybrid route requires the organizer question marked ANSWERED");
    errors.push(...questionEvidenceErrors(state.question_evidence, nowMs));
    const answer = state.answer_evidence;
    if (!answer || answer.disposition !== "hybrid-allowed" || answer.owner_reviewed !== true) errors.push("hybrid route requires an owner-reviewed hybrid-allowed answer disposition");
    if (!isOfficialBoardUrl(answer?.question_url) || !isOfficialBoardUrl(answer?.answer_url)) errors.push("hybrid route requires non-placeholder official DAKER board URLs");
    if (state.question_evidence?.question_url !== answer?.question_url) errors.push("hybrid answer must bind the admitted organizer question URL");
    if (typeof answer?.quote !== "string" || answer.quote.trim().length < 10) errors.push("hybrid route requires an exact answer quote");
    else if (!/2026/u.test(answer.quote) || !/2018|과거|historical/iu.test(answer.quote) ||
        !/허용|가능|eligible|allowed/iu.test(answer.quote) || /불가|금지|거부|허용(?:되지|하지)|가능하지|않습니다|아닙니다|없습니다|할\s*수\s*없|ineligible|not\s+eligible|not\s+allowed|cannot|may\s+not|only\s+2026|2026\s*(?:only|만)/iu.test(answer.quote)) {
      errors.push("hybrid answer quote must explicitly and positively authorize the 2026-plus-historical route");
    }
    if (typeof answer?.author !== "string" || answer.author.trim().length < 2 || typeof answer?.author_role !== "string" || !/운영|organizer|admin/iu.test(answer.author_role)) errors.push("hybrid route requires an identified organizer author and role");
    if (!isFreshPastTimestamp(answer?.captured_at, nowMs) || !isFreshPastTimestamp(answer?.checked_at, nowMs, 24 * 60 * 60 * 1000)) errors.push("hybrid answer timestamps must be real, non-future, and checked within 24 hours");
    if (parseStrictRfc3339(answer?.checked_at) < parseStrictRfc3339(answer?.captured_at)) errors.push("hybrid answer checked_at cannot predate captured_at");
    if (!answer?.capture || typeof answer.capture.path !== "string" || !sha256Pattern.test(answer.capture.sha256 ?? "") ||
        !sha256Pattern.test(answer.live_content_sha256 ?? "") || answer.capture.sha256 !== answer.live_content_sha256) {
      errors.push("hybrid route requires one live-content SHA bound to the answer capture");
    }
    if (!answer?.semantic_review || !safeRelativePath(answer.semantic_review.path) || !sha256Pattern.test(answer.semantic_review.sha256 ?? "")) {
      errors.push("hybrid route requires a SHA-bound human semantic review receipt");
    }
    for (const requiredId of ["openfootball-worldcup-2026", "pappalardo-wyscout-events-wc-2018", "pappalardo-wyscout-matches-wc-2018"]) {
      if (!state.evidence_source_ids?.includes(requiredId)) errors.push(`hybrid route missing required source: ${requiredId}`);
    }
    if (!sourceById(manifest, "openfootball-worldcup-2026")?.capabilities?.includes("fixture_context_2026")) errors.push("hybrid route requires fixture_context_2026 capability");
    if (!sourceById(manifest, "pappalardo-wyscout-events-wc-2018")?.capabilities?.includes("historical_tactical_events_2018")) errors.push("hybrid route requires historical_tactical_events_2018 capability");
    for (const marker of ["2018 only as a labeled historical evidence lens", "must not imply that a 2018 pattern describes a 2026 team"]) {
      if (!hasNormalizedText(productThesis, marker)) errors.push(`hybrid thesis missing scope boundary: ${marker}`);
    }
  }

  if (state.status === "resolved-2026-tactical") {
    if (state.route !== "2026-tactical-only") errors.push("resolved-2026-tactical must select the 2026-tactical-only route");
    if (state.question_status !== "withdrawn-not-needed" || state.answer_evidence !== null || !hasExactStatus(organizerQuestion, "WITHDRAWN — NOT NEEDED")) errors.push("2026 tactical route must withdraw the unanswered scope question");
    const tacticalIds = (state.evidence_source_ids ?? []).filter((id) => sourceById(manifest, id)?.capabilities?.some((capability) => tactical2026Capabilities.has(capability)));
    if (tacticalIds.length === 0) errors.push("2026 tactical route lacks an accepted tactical 2026 capability");
    if ((state.evidence_source_ids ?? []).some((id) => sourceById(manifest, id)?.capabilities?.some((capability) => capability.includes("2018") || capability === "fixture_context_2026"))) {
      errors.push("2026 tactical-only route cannot use historical or fixture-only evidence as its tactical core");
    }
    for (const text of [productThesis, planningSource ?? ""]) {
      if (!text.includes("Product data scope: `2026-tactical-only`")) errors.push("2026 tactical route requires exact scope markers in thesis and planning source");
      if (/Pappalardo|Figshare|2018 historical|pappalardo-wyscout/iu.test(text)) errors.push("2026 tactical-only route still contains historical core evidence");
    }
  }

  if (promotion) {
    if (!productSelection || productSelection.schema_version !== 1 || productSelection.status !== "selected") errors.push("promotion requires a selected canonical product-selection record");
    if (productSelection?.product_id !== state.binding?.product_id) errors.push("product selection ID does not match eligibility binding");
    const expectedScope = state.route;
    if (productSelection?.data_scope !== expectedScope) errors.push("product selection data_scope does not match eligibility route");
    if (JSON.stringify(productSelection?.source_ids) !== JSON.stringify(state.evidence_source_ids)) errors.push("product selection source_ids do not match eligibility evidence sources");
    if (!uniqueStrings(productSelection?.core_tactical_source_ids) || productSelection.core_tactical_source_ids.length === 0 ||
        productSelection.core_tactical_source_ids.some((id) => !productSelection.source_ids.includes(id))) {
      errors.push("product selection requires unique core tactical source IDs drawn from source_ids");
    }
    if (state.status === "confirmed-hybrid" && JSON.stringify(productSelection?.core_tactical_source_ids) !== JSON.stringify(["pappalardo-wyscout-events-wc-2018"])) {
      errors.push("hybrid product core must bind exactly the admitted 2018 tactical event source");
    }
    if (state.status === "resolved-official-open-historical" && JSON.stringify(productSelection?.core_tactical_source_ids) !== JSON.stringify(["pappalardo-wyscout-events-wc-2018"])) {
      errors.push("official-open historical product core must bind exactly the admitted 2018 tactical event source");
    }
    if (state.status === "resolved-2026-tactical" && productSelection?.core_tactical_source_ids?.some((id) =>
      !sourceById(manifest, id)?.capabilities?.some((capability) => tactical2026Capabilities.has(capability)))) {
      errors.push("2026-only core source IDs must all own tactical 2026 capabilities");
    }
    if (!Array.isArray(productSelection?.data_files) || productSelection.data_files.length === 0 ||
        productSelection.data_files.some((artifact) => !safePublicDataPath(artifact?.path) || !sha256Pattern.test(artifact.sha256 ?? "")) ||
        new Set(productSelection.data_files.map((artifact) => artifact.path)).size !== productSelection.data_files.length) {
      errors.push("selected product requires unique SHA-bound public data files");
    }
    if (!state.binding || typeof state.binding !== "object") errors.push("resolved eligibility requires canonical content bindings");
    else {
      rawHashMatches(state.binding, "official_state_sha256", raw.officialState, errors);
      rawHashMatches(state.binding, "organizer_question_sha256", raw.organizerQuestion, errors);
      rawHashMatches(state.binding, "product_thesis_sha256", raw.productThesis, errors);
      rawHashMatches(state.binding, "planning_source_sha256", raw.planningSource, errors);
      rawHashMatches(state.binding, "source_manifest_sha256", raw.manifest, errors);
      rawHashMatches(state.binding, "product_selection_sha256", raw.productSelection, errors);
      if (!state.binding.derived_binding || !safePublicDataPath(state.binding.derived_binding.path) || !sha256Pattern.test(state.binding.derived_binding.sha256 ?? "")) errors.push("resolved eligibility requires a normalized public/data derived product binding");
    }
    const selectionIdMarker = `Product selection ID: \`${productSelection?.product_id}\``;
    const scopeMarker = `Product data scope: \`${productSelection?.data_scope}\``;
    for (const [name, text] of [["product thesis", productThesis], ["planning source", planningSource ?? ""]]) {
      if (!text.includes(selectionIdMarker) || !text.includes(scopeMarker)) errors.push(`${name} is not bound to the canonical product selection`);
    }
  }
  return errors;
}

function safeRepoPath(root, path) {
  if (!safeRelativePath(path)) return null;
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  return rel === "" || rel.startsWith("..") || isAbsolute(rel) ? null : absolute;
}

async function verifyArtifact(root, artifact, readFile, lstat, label, errors) {
  const absolute = safeRepoPath(root, artifact?.path);
  if (!absolute) {
    errors.push(`${label} path must be repo-relative and contained`);
    return null;
  }
  try {
    if ((await lstat(absolute)).isSymbolicLink()) {
      errors.push(`${label} must not be a symbolic link`);
      return null;
    }
    const bytes = await readFile(absolute);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== artifact.sha256) errors.push(`${label} SHA-256 mismatch`);
    return bytes;
  } catch {
    errors.push(`${label} path is missing: ${artifact.path}`);
    return null;
  }
}

function parseBoundJson(bytes, label, errors) {
  if (!bytes) return null;
  try { return JSON.parse(bytes.toString("utf8")); }
  catch { errors.push(`${label} is not valid JSON`); return null; }
}

export async function validateEligibilityArtifacts({ state, manifest, productSelection, root = process.cwd(), readFile = readFileFs, lstat = lstatFs, now = new Date() }) {
  const errors = [];
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (["scope-confirmed-open", "resolved-official-open-historical"].includes(state.status) && state.scope_evidence?.capture) {
    const capture = await verifyArtifact(root, state.scope_evidence.capture, readFile, lstat, "official Data-tab scope capture", errors);
    const text = capture?.toString("utf8") ?? "";
    for (const marker of [canonicalOfficialApiUrl, officialOpenScopeQuote, state.scope_evidence.stable_fields_sha256]) {
      if (capture && !hasNormalizedText(text, marker)) errors.push(`official Data-tab scope capture missing bound marker: ${marker}`);
    }
  }
  if (state.question_evidence?.capture) {
    const evidence = state.question_evidence;
    await verifyArtifact(root, evidence.capture, readFile, lstat, "organizer question capture", errors);
    const messageBytes = await verifyArtifact(root, evidence.posted_question, readFile, lstat, "canonical posted question", errors);
    const normalizedMessage = messageBytes?.toString("utf8").replace(/\s+/gu, " ").trim();
    for (const marker of [requiredQuestionSubject, requiredQuestionProposition, "A 구성 허용", "A 구성 불가 — 핵심 전술 근거도 2026 월드컵 경기 데이터 필수"]) {
      if (normalizedMessage && !normalizedMessage.includes(marker)) errors.push(`canonical posted question missing exact marker: ${marker}`);
    }
    const reviewBytes = await verifyArtifact(root, evidence.content_review, readFile, lstat, "organizer question owner content review", errors);
    const review = parseBoundJson(reviewBytes, "organizer question owner content review", errors);
    if (review && (review.schema_version !== 1 || review.status !== "PASS" || review.question_url !== evidence.question_url ||
        review.post_id !== evidence.post_id || review.owner !== evidence.owner || review.capture_sha256 !== evidence.capture.sha256 ||
        review.posted_question_sha256 !== evidence.posted_question.sha256 || review.proposition_sha256 !== sha256Text(requiredQuestionProposition) ||
        review.wording_matches !== true || !isFreshPastTimestamp(review.reviewed_at, nowMs) ||
        parseStrictRfc3339(review.reviewed_at) < parseStrictRfc3339(evidence.posted_at))) {
      errors.push("organizer question owner content review does not bind the exact visible post to the canonical A proposition");
    }
  }
  if (state.status === "confirmed-hybrid" && state.answer_evidence?.capture) {
    const capture = await verifyArtifact(root, state.answer_evidence.capture, readFile, lstat, "organizer answer capture", errors);
    if (capture) {
      const text = capture.toString("utf8");
      for (const marker of [state.answer_evidence.answer_url, state.answer_evidence.quote, state.answer_evidence.author, state.answer_evidence.author_role]) {
        if (!text.includes(marker)) errors.push(`organizer answer capture missing bound marker: ${marker}`);
      }
    }
    const reviewBytes = await verifyArtifact(root, state.answer_evidence.semantic_review, readFile, lstat, "organizer answer semantic review", errors);
    const review = parseBoundJson(reviewBytes, "organizer answer semantic review", errors);
    if (review && (review.schema_version !== 1 || review.status !== "PASS" || review.route !== "hybrid-2026-context-plus-historical-tactics" ||
        review.quote_sha256 !== sha256Text(state.answer_evidence.quote) || review.reviewer_role !== "owner" ||
        review.explicitly_allows_2026_context !== true || review.explicitly_allows_historical_tactics !== true ||
        review.contains_denial_or_2026_only_requirement !== false || !isFreshPastTimestamp(review.reviewed_at, nowMs, 24 * 60 * 60 * 1000))) {
      errors.push("organizer answer semantic review does not explicitly approve the hybrid route");
    }
  }
  for (const id of state.evidence_source_ids ?? []) {
    const source = sourceById(manifest, id);
    if (source?.status !== "accepted" || !source.acceptance_evidence?.artifacts) continue;
    const isCornerHistoricalSource = id === "pappalardo-wyscout-events-wc-2018" || id === "pappalardo-wyscout-matches-wc-2018";
    const bound = {};
    for (const key of acceptanceArtifactKeys) {
      bound[key] = await verifyArtifact(root, source.acceptance_evidence.artifacts[key], readFile, lstat, `${id} ${key}`, errors);
    }
    const rights = parseBoundJson(bound.rights, `${id} rights evidence`, errors);
    const requiredUses = ["public_prize_entry", "public_github", "hosted_app", "youtube_demo", "derived_distribution"];
    if (rights && (rights.schema_version !== 1 || rights.status !== "CLEARED" || rights.source_id !== id ||
        rights.source_url !== source.url || rights.license !== source.license || !/^https:\/\//u.test(rights.evidence_url ?? "") || /example|\.invalid(?:\/|$)/iu.test(rights.evidence_url ?? "") ||
        !uniqueStrings(rights.allowed_uses) || requiredUses.some((use) => !rights.allowed_uses.includes(use)) ||
        !isFreshPastTimestamp(rights.checked_at, nowMs))) {
      errors.push(`${id} rights evidence does not clear every public submission use`);
    }
    const capability = parseBoundJson(bound.capability, `${id} capability evidence`, errors);
    if (capability && (capability.schema_version !== 1 || capability.status !== "PASS" || capability.source_id !== id ||
        JSON.stringify(capability.capabilities) !== JSON.stringify(source.capabilities) ||
        !Array.isArray(capability.schema_assertions) || capability.schema_assertions.length === 0 ||
        capability.reviewer !== source.acceptance_evidence.reviewer || !isFreshPastTimestamp(capability.checked_at, nowMs))) {
      errors.push(`${id} capability evidence does not bind the admitted schema and reviewer`);
    }
    const audit = parseBoundJson(bound.audit, `${id} audit evidence`, errors);
    const historicalAuditInvalid = isCornerHistoricalSource && audit && (
      audit.public_json_sha256 !== source.acceptance_evidence.artifacts.derived.sha256 ||
      JSON.stringify(audit.final_result) !== JSON.stringify({ structural_pass: 42, semantic_pass: 42, uncertain: 0, fail: 0 }) ||
      JSON.stringify(audit.semantic_review) !== JSON.stringify(source.acceptance_evidence.artifacts.semantic_review) ||
      JSON.stringify(audit.window_review) !== JSON.stringify(source.acceptance_evidence.artifacts.window_review)
    );
    if (audit && (audit.schema_version !== 1 || audit.status !== "PASS" || audit.source_id !== id ||
        audit.reviewer !== source.acceptance_evidence.reviewer || !Array.isArray(audit.assertions) || audit.assertions.length === 0 ||
        !isFreshPastTimestamp(audit.checked_at, nowMs) || historicalAuditInvalid)) {
      errors.push(`${id} audit evidence is not a current independent PASS`);
    }
    if (audit && isCornerHistoricalSource) {
      const semanticReviewBytes = await verifyArtifact(root, audit.semantic_review, readFile, lstat, `${id} semantic review`, errors);
      const windowReviewBytes = await verifyArtifact(root, audit.window_review, readFile, lstat, `${id} window review`, errors);
      const semanticReview = parseBoundJson(semanticReviewBytes, `${id} semantic review`, errors);
      if (semanticReview && (semanticReview.schema_version !== 1 || semanticReview.status !== "PASS" ||
          semanticReview.reviewer !== source.acceptance_evidence.reviewer || semanticReview.public_json_sha256 !== audit.public_json_sha256 ||
          JSON.stringify(semanticReview.final_result) !== JSON.stringify(audit.final_result) ||
          !Array.isArray(semanticReview.structural_pass_ids) || semanticReview.structural_pass_ids.length !== 42 ||
          new Set(semanticReview.structural_pass_ids).size !== 42 ||
          JSON.stringify(semanticReview.semantic_pass_ids) !== JSON.stringify(semanticReview.structural_pass_ids))) {
        errors.push(`${id} semantic review does not bind the independent 42/42 PASS`);
      }
      if (windowReviewBytes && (windowReviewBytes.toString("utf8").trim().split("\n").length !== 43 ||
          (windowReviewBytes.toString("utf8").match(/,pass,pass,/gu) ?? []).length !== 42)) {
        errors.push(`${id} window review does not contain exactly 42 structural and semantic PASS rows`);
      }
    }
    const rawReceipt = parseBoundJson(bound.raw_transform_receipt, `${id} raw transform receipt`, errors);
    const rawArgv = ["node_modules/vitest/vitest.mjs", "run", source.acceptance_evidence.artifacts.raw_transform_test.path];
    if (rawReceipt && (rawReceipt.schema_version !== 1 || rawReceipt.status !== "PASS" || rawReceipt.source_id !== id ||
        JSON.stringify(rawReceipt.test_argv) !== JSON.stringify(rawArgv) || rawReceipt.result !== "7/7 passed" ||
        !isFreshPastTimestamp(rawReceipt.completed_at, nowMs))) {
      errors.push(`${id} raw transform receipt does not preserve the admitted 7/7 reproduction command`);
    }
    const releaseReceipt = parseBoundJson(bound.release_test_receipt, `${id} release test receipt`, errors);
    if (releaseReceipt && (releaseReceipt.schema_version !== 1 || releaseReceipt.status !== "PASS" || releaseReceipt.source_id !== id ||
        JSON.stringify(releaseReceipt.test_argv) !== JSON.stringify(source.acceptance_evidence.test_argv) ||
        !isFreshPastTimestamp(releaseReceipt.completed_at, nowMs))) {
      errors.push(`${id} release test receipt does not bind the admitted raw-free test command`);
    }
    const derived = parseBoundJson(bound.derived, `${id} derived evidence`, errors);
    if (derived && (!uniqueStrings(derived.provenance?.source_ids) || !derived.provenance.source_ids.includes(id))) {
      errors.push(`${id} derived evidence is not source-bound`);
    }
  }
  if (state.status !== "unresolved" && state.binding?.derived_binding) {
    const bytes = await verifyArtifact(root, state.binding.derived_binding, readFile, lstat, "derived product binding", errors);
    const derived = parseBoundJson(bytes, "derived product binding", errors);
    if (derived && (derived.schema_version !== 1 || derived.product_id !== state.binding.product_id || derived.data_scope !== state.route ||
        JSON.stringify(derived.source_ids) !== JSON.stringify(state.evidence_source_ids) ||
        JSON.stringify(derived.core_tactical_source_ids) !== JSON.stringify(productSelection.core_tactical_source_ids) ||
        JSON.stringify(derived.data_files) !== JSON.stringify(productSelection.data_files))) {
      errors.push("derived product binding does not match the eligibility route, sources, and public data files");
    }
  }
  const lineageIds = new Set();
  for (const artifact of productSelection?.data_files ?? []) {
    const bytes = await verifyArtifact(root, artifact, readFile, lstat, `product data ${artifact.path}`, errors);
    const data = parseBoundJson(bytes, `product data ${artifact.path}`, errors);
    if (data && (!uniqueStrings(data.provenance?.source_ids) || data.provenance.source_ids.some((id) => !productSelection.source_ids.includes(id)))) {
      errors.push(`product data ${artifact.path} has invalid source lineage`);
    } else for (const id of data?.provenance?.source_ids ?? []) lineageIds.add(id);
  }
  if (state.status !== "unresolved" && JSON.stringify([...lineageIds]) !== JSON.stringify(productSelection.source_ids)) {
    errors.push("public product data lineage does not exactly cover the selected sources");
  }
  return errors;
}

export async function validateOfficialAnswerLive({ state, fetchImpl = fetch }) {
  if (state.status !== "confirmed-hybrid") return [];
  const errors = [];
  try {
    const requested = new URL(state.answer_evidence.answer_url); requested.hash = "";
    const response = await fetchImpl(requested, { cache: "no-store", redirect: "follow" });
    if (!response.ok || !isOfficialBoardUrl(response.url)) errors.push(`official answer live fetch failed: ${response.status} ${response.url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== state.answer_evidence.live_content_sha256) errors.push("official answer live bytes do not match the captured SHA-256");
    const text = bytes.toString("utf8");
    for (const marker of [state.answer_evidence.quote, state.answer_evidence.author, state.answer_evidence.author_role]) {
      if (!text.includes(marker)) errors.push(`official answer live content missing marker: ${marker}`);
    }
  } catch (error) {
    errors.push(`official answer live fetch failed: ${error.message}`);
  }
  return errors;
}

export async function validateOfficialScopeLive({ state, fetchImpl = fetch }) {
  if (!["scope-confirmed-open", "resolved-official-open-historical"].includes(state.status)) return [];
  const errors = [];
  try {
    const response = await fetchImpl(canonicalOfficialApiUrl, { cache: "no-store", redirect: "follow" });
    if (!response.ok || response.url !== canonicalOfficialApiUrl) {
      errors.push(`official Data-tab live fetch failed: ${response.status} ${response.url}`);
      return errors;
    }
    const record = await response.json();
    const stable = {
      id: record.id,
      slug: record.slug,
      tagline: record.tagline,
      dataDescription: record.dataDescription,
      updatedAt: record.updatedAt,
    };
    if (sha256Text(JSON.stringify(stable)) !== state.scope_evidence.stable_fields_sha256) {
      errors.push("official Data-tab stable fields changed since scope admission");
    }
    if (record.updatedAt !== state.scope_evidence.hackathon_updated_at ||
        typeof record.dataDescription !== "string" || !record.dataDescription.includes(officialOpenScopeQuote)) {
      errors.push("official Data-tab no longer contains the admitted no-year-restriction rule");
    }
  } catch (error) {
    errors.push(`official Data-tab live fetch failed: ${error.message}`);
  }
  return errors;
}

export function runEligibilityAcceptanceTests({ state, manifest, root = process.cwd(), runner = spawnSync }) {
  const errors = [];
  const seen = new Set();
  for (const id of state.evidence_source_ids ?? []) {
    const source = sourceById(manifest, id);
    const argv = source?.acceptance_evidence?.test_argv;
    if (!Array.isArray(argv)) continue;
    const key = JSON.stringify(argv); if (seen.has(key)) continue; seen.add(key);
    const result = runner(process.execPath, argv, { cwd: root, encoding: "utf8", timeout: 120_000, env: process.env });
    if (result.status !== 0) errors.push(`${id} acceptance test failed: ${argv.join(" ")}`);
  }
  return errors;
}

export async function validateDeployedProductData({ productSelection, distRoot = resolve(process.cwd(), "dist"), readFile = readFileFs }) {
  const errors = [];
  if (!Array.isArray(productSelection?.data_files) || productSelection.data_files.length === 0) return ["selected product has no deployed data files"];
  for (const artifact of productSelection.data_files) {
    if (!safePublicDataPath(artifact.path)) {
      errors.push(`invalid selected data path: ${artifact.path}`);
      continue;
    }
    const deployedPath = resolve(distRoot, artifact.path.slice("public/".length));
    try {
      const digest = createHash("sha256").update(await readFile(deployedPath)).digest("hex");
      if (digest !== artifact.sha256) errors.push(`${artifact.path} deployed SHA-256 mismatch`);
    } catch {
      errors.push(`${artifact.path} is absent from dist`);
    }
  }
  return errors;
}

export function collectEligibilityArtifactPaths(state, manifest, productSelection) {
  const paths = [];
  if (state.scope_evidence?.capture?.path) paths.push(state.scope_evidence.capture.path);
  if (state.question_evidence?.capture?.path) paths.push(state.question_evidence.capture.path);
  if (state.question_evidence?.posted_question?.path) paths.push(state.question_evidence.posted_question.path);
  if (state.question_evidence?.content_review?.path) paths.push(state.question_evidence.content_review.path);
  if (state.answer_evidence?.capture?.path) paths.push(state.answer_evidence.capture.path);
  if (state.answer_evidence?.semantic_review?.path) paths.push(state.answer_evidence.semantic_review.path);
  if (state.binding?.derived_binding?.path) paths.push(state.binding.derived_binding.path);
  for (const id of state.evidence_source_ids ?? []) {
    const source = sourceById(manifest, id);
    for (const key of acceptanceArtifactKeys) {
      const path = source?.acceptance_evidence?.artifacts?.[key]?.path;
      if (path) paths.push(path);
    }
  }
  for (const artifact of productSelection?.data_files ?? []) if (artifact.path) paths.push(artifact.path);
  return [...new Set(paths)];
}

export function validateEligibilityTrackedArtifacts({
  state, manifest, productSelection,
  tracker = (path) => spawnSync("git", ["ls-files", "--error-unmatch", "--", path], { stdio: "ignore" }).status === 0,
}) {
  const errors = [];
  for (const path of collectEligibilityArtifactPaths(state, manifest, productSelection)) {
    if (!tracker(path)) errors.push(`eligibility artifact is not tracked by Git: ${path}`);
  }
  return errors;
}

export function validateEligibilityPromotion(input) {
  return validateEligibilityState({ ...input, promotion: true });
}

export const eligibilityConstants = {
  canonicalOfficialUrl, canonicalOfficialApiUrl, officialScopeText, officialOpenScopeQuote, officialOpenScopeRoute, acceptanceArtifactKeys,
  requiredQuestionSubject, requiredQuestionProposition,
};
