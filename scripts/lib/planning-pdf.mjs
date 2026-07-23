import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requiredPdfPageMarkers, requiredPlanningPages } from "./planning-contract.mjs";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const inspectorPath = join(moduleDirectory, "..", "inspect-planning-pdf.py");

export function findPdfPython() {
  const candidates = [
    process.env.PDF_PYTHON,
    join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "bin", "python3"),
    "python3",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["-c", "import pypdf"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }
  throw new Error("pypdf unavailable; set PDF_PYTHON to a Python with pypdf installed");
}

function normalizeText(text) {
  return text.replace(/\s+/gu, " ").trim();
}

export async function inspectPlanningPdf(pdfPath, { render = true } = {}) {
  const errors = [];
  const pdfStat = await stat(pdfPath);
  const pdf = await readFile(pdfPath);
  const pdfSha256 = createHash("sha256").update(pdf).digest("hex");
  if (pdf.subarray(0, 5).toString() !== "%PDF-") errors.push("file header is not PDF");

  let pages = [];
  try {
    const output = execFileSync(findPdfPython(), [inspectorPath, pdfPath], { encoding: "utf8" });
    pages = JSON.parse(output).pages;
  } catch (error) {
    errors.push(`PDF text inspection failed: ${error.message}`);
  }

  if (pages.length !== requiredPlanningPages.length) {
    errors.push(`expected 8 PDF pages, found ${pages.length}`);
  }
  requiredPlanningPages.forEach((title, index) => {
    const text = normalizeText(pages[index]?.text ?? "");
    if (text.length < 100) errors.push(`PDF page ${index + 1} has insufficient extractable text`);
    if (!text.includes(title)) errors.push(`PDF page ${index + 1} missing source title: ${title}`);
    if (!text.includes(requiredPdfPageMarkers[index])) {
      errors.push(`PDF page ${index + 1} missing scoped content marker: ${requiredPdfPageMarkers[index]}`);
    }
    const width = pages[index]?.width ?? 0;
    const height = pages[index]?.height ?? 0;
    if (!(width > 0 && height > 0)) errors.push(`PDF page ${index + 1} has invalid media box`);
  });

  let renderedPages = 0;
  if (render && pages.length) {
    const renderDirectory = await mkdtemp(join(tmpdir(), "world-cup-plan-render-"));
    try {
      const fontCacheHome = process.env.PDF_FONT_CACHE_HOME ?? join(process.cwd(), "tmp", "pdfs");
      await mkdir(fontCacheHome, { recursive: true });
      const bundledFontConfig = join(
        homedir(),
        ".cache",
        "codex-runtimes",
        "codex-primary-runtime",
        "dependencies",
        "native",
        "poppler",
        "poppler",
        "etc",
        "fonts",
        "fonts.conf",
      );
      execFileSync("pdftoppm", ["-png", "-r", "72", pdfPath, join(renderDirectory, "page")], {
        stdio: "ignore",
        timeout: 60_000,
        env: {
          ...process.env,
          FONTCONFIG_FILE: process.env.FONTCONFIG_FILE ?? bundledFontConfig,
          XDG_CACHE_HOME: fontCacheHome,
        },
      });
      const images = (await readdir(renderDirectory)).filter((name) => /^page-\d+\.png$/u.test(name));
      renderedPages = images.length;
      if (renderedPages !== pages.length) errors.push(`rendered ${renderedPages}/${pages.length} PDF pages`);
      for (const image of images) {
        if ((await stat(join(renderDirectory, image))).size < 1_000) {
          errors.push(`rendered page is unexpectedly small: ${image}`);
        }
      }
    } catch (error) {
      errors.push(`PDF rendering failed: ${error.message}`);
    } finally {
      await rm(renderDirectory, { recursive: true, force: true });
    }
  }

  return { errors, pageCount: pages.length, renderedPages, pdfSha256, modifiedAtMs: pdfStat.mtimeMs, pages };
}

export function validatePlanningCandidateBindings(pages, { sourceSha256, screenshotManifestSha256 }) {
  const errors = [];
  const sourcePrefix = sourceSha256.slice(0, 12);
  const screenshotPrefix = screenshotManifestSha256.slice(0, 12);
  for (const [index, page] of pages.entries()) {
    const text = normalizeText(page.text ?? "");
    if (!text.includes("DAKER · 기획서")) errors.push(`PDF page ${index + 1} lacks the DAKER planning ribbon`);
    if (!text.includes("인간 연구 없음")) errors.push(`PDF page ${index + 1} lacks human-evidence boundary`);
    if (!text.includes(`기획 ${sourcePrefix}`)) errors.push(`PDF page ${index + 1} is not bound to current planning source`);
    if (!text.includes(`캡처 ${screenshotPrefix}`)) errors.push(`PDF page ${index + 1} is not bound to current screenshots`);
    if (!text.includes("인과 추천 REJECT") || !text.includes("경험적 캠페인 REVISE")) {
      errors.push(`PDF page ${index + 1} lacks empirical/causal claim boundaries`);
    }
  }
  const allText = pages.map(({ text }) => normalizeText(text ?? "")).join("\n");
  for (const marker of ["48경기", "603", "397/436", "WOULD_PREVENT", "정책 변경 0회", "12/12", "다음 미팅", "제출팀 60%", "2026-07-27 10:00 KST", "인간 연구 없음"]) {
    if (!allText.includes(marker)) errors.push(`planning candidate lacks official/current marker: ${marker}`);
  }
  if (allText.includes("98 / 100") || allText.includes("공식 후보로 승격")) {
    errors.push("planning candidate must not contain self-awarded scoring or internal promotion language");
  }
  for (const stale of [/DATA AUDIT PENDING/iu, /implementation pending/iu, /transform\/full audit pending/iu, /Touchline Lab/iu, /4\/5 fresh users/iu]) {
    if (stale.test(allText)) errors.push(`planning candidate contains stale marker: ${stale.source}`);
  }
  return errors;
}

export function validateAgentVisualReview(review, {
  artifactPath, pdfSha256, sourceSha256, packetPath, packetSha256, renderer,
  artifactCreatedAtMs, packetManifest, now = Date.now(),
}) {
  const errors = [];
  const reviewedAt = Date.parse(review?.reviewed_at);
  const expectedCriteria = ["clipping", "overlap", "glyphs", "table_legibility", "page_numbers", "headers_footers", "citations", "claim_boundaries"];
  if (review?.schema_version !== 1) errors.push("agent visual review schema must be 1");
  if (review?.status !== "PASS") errors.push("agent visual review status must be PASS");
  if (review?.scope !== "independent-agent-document-qa-not-human-participant-usability-preference-evidence") {
    errors.push("agent visual review scope boundary is missing or unsafe");
  }
  if (!/^\/root\/[a-z0-9_]+$/u.test(review?.reviewer?.task ?? "") || review?.reviewer?.task === "/root" ||
      review?.reviewer?.role !== "independent-agent" || review?.reviewer?.artifact_creator !== false) {
    errors.push("agent visual review requires a distinct non-creator subagent task");
  }
  if (!Number.isFinite(reviewedAt) || reviewedAt > now ||
      (Number.isFinite(artifactCreatedAtMs) && reviewedAt < Math.floor(artifactCreatedAtMs / 1000) * 1000)) {
    errors.push("agent visual review timestamp is invalid, future, or predates the PDF");
  }
  if (review?.artifact?.path !== artifactPath || review?.artifact?.sha256 !== pdfSha256 || review?.artifact?.pages !== packetManifest?.artifact?.pages) {
    errors.push("agent visual review artifact binding mismatch");
  }
  if (review?.planning_source?.sha256 !== sourceSha256) errors.push("agent visual review planning-source binding mismatch");
  if (review?.review_packet?.path !== packetPath || review?.review_packet?.sha256 !== packetSha256 || review?.review_packet?.renderer !== renderer) {
    errors.push("agent visual review packet binding mismatch");
  }
  if (JSON.stringify(review?.criteria) !== JSON.stringify(expectedCriteria)) errors.push("agent visual review criteria drifted");
  const expectedPages = packetManifest?.rendered_pages ?? [];
  if (!Array.isArray(review?.pages) || review.pages.length !== expectedPages.length) {
    errors.push("agent visual review must cover every rendered page exactly once");
  } else {
    review.pages.forEach((page, index) => {
      const expected = expectedPages[index];
      const checks = page?.checks ?? {};
      if (page?.page !== expected?.page || page?.path !== expected?.path || page?.sha256 !== expected?.sha256 || page?.bytes !== expected?.bytes ||
          page?.width !== 1404 || page?.height !== 993 || JSON.stringify(Object.keys(checks)) !== JSON.stringify(expectedCriteria) ||
          expectedCriteria.some((criterion) => checks[criterion] !== true) || !Array.isArray(page?.findings) || page.findings.length !== 0) {
        errors.push(`agent visual review page ${index + 1} is incomplete or drifts from the packet`);
      }
    });
  }
  if (review?.summary?.pages_passed !== expectedPages.length || review?.summary?.blocker !== 0 || review?.summary?.major !== 0 ||
      review?.summary?.minor !== 0 || review?.summary?.finding_count !== 0) {
    errors.push("agent visual review summary is not an all-pages zero-finding PASS");
  }
  return errors;
}

export async function validatePlanningScreenshotManifest(manifest, { now = Date.now() } = {}) {
  const errors = [];
  const shaPattern = /^[a-f0-9]{64}$/u;
  const safePath = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
  if (manifest?.schema_version !== 1) errors.push("planning screenshot manifest schema must be 1");
  if (manifest?.viewport_contract?.desktop !== "1440x900" || manifest?.viewport_contract?.mobile !== "390x844") {
    errors.push("planning screenshot viewport contract drifted");
  }
  const capturedAt = Date.parse(manifest?.captured_at);
  if (!Number.isFinite(capturedAt) || capturedAt > now) errors.push("planning screenshot capture timestamp is invalid or future");

  const sourcePaths = manifest?.source_binding?.paths;
  if (!Array.isArray(sourcePaths) || !sourcePaths.length || sourcePaths.some((path) => !safePath.test(path))) {
    errors.push("planning screenshot source paths are missing or unsafe");
  } else {
    try {
      const hash = createHash("sha256");
      for (const path of [...sourcePaths].sort()) {
        hash.update(path); hash.update("\0"); hash.update(await readFile(path)); hash.update("\0");
      }
      if (hash.digest("hex") !== manifest.source_binding.sha256) errors.push("planning screenshot source binding SHA-256 mismatch");
    } catch (error) {
      errors.push(`planning screenshot source binding unreadable: ${error.message}`);
    }
  }
  const build = manifest?.build_binding;
  if (!shaPattern.test(build?.sha256 ?? "") || !Number.isInteger(build?.file_count) || build.file_count <= 0 ||
      !Array.isArray(build?.files) || build.files.length !== build.file_count ||
      build.files.some((file) => !safePath.test(file.path ?? "") || !Number.isInteger(file.bytes) || file.bytes <= 0 || !shaPattern.test(file.sha256 ?? ""))) {
    errors.push("planning screenshot build binding is incomplete");
  }
  if (!Array.isArray(manifest?.artifacts) || manifest.artifacts.length !== 6) {
    errors.push("planning screenshot manifest must bind six artifacts");
  } else {
    for (const artifact of manifest.artifacts) {
      if (!safePath.test(artifact.path ?? "") || !shaPattern.test(artifact.sha256 ?? "") || !Number.isInteger(artifact.bytes)) {
        errors.push(`planning screenshot artifact binding is malformed: ${artifact.path ?? "unknown"}`);
        continue;
      }
      try {
        const bytes = await readFile(artifact.path);
        if (bytes.length !== artifact.bytes || createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) {
          errors.push(`planning screenshot artifact SHA-256 mismatch: ${artifact.path}`);
        }
      } catch (error) {
        errors.push(`planning screenshot artifact unreadable: ${artifact.path}: ${error.message}`);
      }
    }
  }
  return errors;
}

const PLAN_DEADLINE_MS = Date.parse("2026-07-27T10:00:00+09:00");
const KST_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/u;

function ledgerCells(line) {
  if (!line.trim().startsWith("|") || !line.trim().endsWith("|")) return [];
  return line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/gu, ""));
}

export function validateVisualQaLedger(ledger, {
  pdfSha256, sourceSha256, packetSha256, renderer, agentReviewSha256, pageCount, artifactPath, artifactCreatedAtMs,
  now = Date.now(), planDeadlineMs = PLAN_DEADLINE_MS,
}) {
  const errors = [];
  const rows = ledger.split(/\r?\n/u)
    .map((line) => ({ line, cells: ledgerCells(line) }))
    .filter(({ cells }) => cells[1] === "plan-visual-qa");
  if (rows.length === 0) return ["submission ledger lacks a plan-visual-qa row"];
  if (rows.length > 1) errors.push("submission ledger contains duplicate plan-visual-qa rows");
  const { line, cells } = rows[0];
  if (cells.length !== 7) errors.push("plan-visual-qa row must contain exactly 7 cells");
  const [timestamp, phase, artifact, shaCell, checksCell, externalStatus, notes] = cells;
  if (phase !== "plan-visual-qa") errors.push("plan-visual-qa phase cell must be exact");
  if (!KST_TIMESTAMP.test(timestamp ?? "") || !Number.isFinite(Date.parse(timestamp))) {
    errors.push("plan-visual-qa ledger row requires an RFC3339 KST timestamp");
  } else {
    const timestampMs = Date.parse(timestamp);
    if (timestampMs > now) errors.push("plan-visual-qa row timestamp is in the future");
    if (timestampMs > planDeadlineMs) errors.push("plan-visual-qa row timestamp is after the planning deadline");
    if (Number.isFinite(artifactCreatedAtMs) && timestampMs < Math.floor(artifactCreatedAtMs / 1000) * 1000) {
      errors.push("plan-visual-qa row predates the planning PDF artifact");
    }
  }
  if (artifactPath !== undefined && artifact !== artifactPath) {
    errors.push("plan-visual-qa row is not bound to the expected PDF path");
  }
  const expectedSha = `pdf=${pdfSha256} source=${sourceSha256}`;
  if (shaCell !== expectedSha) errors.push("plan-visual-qa SHA cell must exactly bind PDF and source SHA-256");
  const expectedChecks = `visual ${pageCount}/${pageCount} PASS`;
  if (checksCell !== expectedChecks) errors.push(`plan-visual-qa Checks cell must exactly equal '${expectedChecks}'`);
  if (externalStatus !== "local") errors.push("plan-visual-qa external status must be 'local'");
  if (/\b(?:FAIL|PENDING|SKIP|N\/A)\b/iu.test(line)) errors.push("plan-visual-qa row contains a forbidden non-pass token");
  const humanMatch = /^reviewer=([^\s|]+) role=independent-human renderer=([^\s|]+\/[^\s|]+) packet=([a-f0-9]{64})$/u.exec(notes ?? "");
  const agentMatch = /^reviewer=(\/root\/[a-z0-9_]+) role=independent-agent renderer=([^\s|]+\/[^\s|]+) packet=([a-f0-9]{64}) review=([a-f0-9]{64})$/u.exec(notes ?? "");
  if (!humanMatch && !agentMatch) {
    errors.push("plan-visual-qa Notes must bind either an independent human attestation or an independent-agent review artifact");
  } else if (humanMatch) {
    if (!/^[^\s|]{2,64}$/u.test(humanMatch[1]) ||
        /(?:^|[-_.])(?:test|unknown|agent\d*|codex\d*|creator|implementer|self|reviewer|human|qa\d*)(?:$|[-_.])/iu.test(humanMatch[1])) {
      errors.push("plan-visual-qa reviewer must be a named independent human, not a placeholder or creator role");
    }
    if (renderer !== undefined && humanMatch[2] !== renderer) {
      errors.push("plan-visual-qa renderer does not match the bound review packet");
    }
    if (packetSha256 !== undefined && humanMatch[3] !== packetSha256) {
      errors.push("plan-visual-qa packet SHA-256 does not bind the inspected page renders");
    }
  } else if (agentMatch) {
    if (agentMatch[1] === "/root" || /(?:creator|implementer|codex)/iu.test(agentMatch[1])) {
      errors.push("plan-visual-qa independent agent must be a distinct non-creator subagent task");
    }
    if (renderer !== undefined && agentMatch[2] !== renderer) errors.push("plan-visual-qa renderer does not match the bound review packet");
    if (packetSha256 !== undefined && agentMatch[3] !== packetSha256) errors.push("plan-visual-qa packet SHA-256 does not bind the inspected page renders");
    if (agentReviewSha256 === undefined || agentMatch[4] !== agentReviewSha256) {
      errors.push("plan-visual-qa agent review SHA-256 does not bind the validated review artifact");
    }
  }
  return errors;
}

export function validatePlanSubmissionReceipt(ledger, {
  artifactPath, pdfSha256, artifactCreatedAtMs, now = Date.now(), planDeadlineMs = PLAN_DEADLINE_MS,
}) {
  const rows = ledger.split(/\r?\n/u)
    .map((line) => ({ line, cells: ledgerCells(line) }))
    .filter(({ cells }) => cells[1] === "plan-submitted");
  if (rows.length === 0) return [];
  const errors = [];
  if (rows.length > 1) errors.push("submission ledger contains duplicate plan-submitted rows");
  const { line, cells } = rows[0];
  if (cells.length !== 7) errors.push("plan-submitted row must contain exactly 7 cells");
  const [timestamp,, artifact, shaCell, checksCell, externalStatus, notes] = cells;
  if (!KST_TIMESTAMP.test(timestamp ?? "") || !Number.isFinite(Date.parse(timestamp))) {
    errors.push("plan-submitted row requires an RFC3339 KST timestamp");
  } else {
    const timestampMs = Date.parse(timestamp);
    if (timestampMs > now) errors.push("plan-submitted row timestamp is in the future");
    if (timestampMs > planDeadlineMs) errors.push("plan-submitted row timestamp is after the planning deadline");
    if (Number.isFinite(artifactCreatedAtMs) && timestampMs < Math.floor(artifactCreatedAtMs / 1000) * 1000) {
      errors.push("plan-submitted row predates the planning PDF artifact");
    }
  }
  if (artifact !== artifactPath) errors.push("plan-submitted row is not bound to the expected PDF path");
  if (shaCell !== `pdf=${pdfSha256}`) errors.push("plan-submitted SHA cell must exactly bind the submitted PDF SHA-256");
  if (checksCell !== "owner-confirmation PASS") errors.push("plan-submitted Checks cell must exactly equal 'owner-confirmation PASS'");
  if (externalStatus !== "submitted") errors.push("plan-submitted external status must be 'submitted'");
  if (/\b(?:FAIL|PENDING|SKIP|N\/A)\b/iu.test(line)) errors.push("plan-submitted row contains a forbidden non-pass token");
  const noteMatch = /^owner=([^\s|]+) confirmation=([^\s|]+)$/u.exec(notes ?? "");
  if (!noteMatch) errors.push("plan-submitted Notes must exactly identify owner=<name> confirmation=<official-id-or-url-or-screenshot-sha256>");
  else if (/^(?:test|unknown|agent\d*|codex(?:[-_.].*)?|self|reviewer|human|qa(?:[-_.].*)?)$/iu.test(noteMatch[1])) errors.push("plan-submitted owner must be a real owner identity, not a placeholder");
  return errors;
}
