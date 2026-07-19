import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requiredPdfPageMarkers, requiredPlanningPages } from "./lib/planning-contract.mjs";
import { findPdfPython, inspectPlanningPdf, validateAgentVisualReview, validatePlanningCandidateBindings, validatePlanSubmissionReceipt, validateVisualQaLedger } from "./lib/planning-pdf.mjs";
import { preparePlanReview } from "./lib/plan-review.mjs";
import { preparePlanOwnerHandoff } from "./lib/plan-owner-handoff.mjs";

let directory;
let validPdf;
let onePagePdf;
let python;

function kstTimestamp(ms) {
  return new Date(Math.floor(ms / 1000) * 1000 + (9 * 60 * 60 * 1000))
    .toISOString()
    .replace(".000Z", "+09:00");
}

function visualQaRow({ timestamp, artifact, pdfSha256, sourceSha256, checks = "visual 8/8 PASS", status = "local", notes = `reviewer=mira-kim role=independent-human renderer=pdftoppm/25.06 packet=${"a".repeat(64)}` }) {
  return `| ${timestamp} | plan-visual-qa | ${artifact} | pdf=${pdfSha256} source=${sourceSha256} | ${checks} | ${status} | ${notes} |`;
}

const generator = String.raw`
import json
import sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

output = sys.argv[1]
pages = json.loads(sys.argv[2])
binding = json.loads(sys.argv[3])
pdfmetrics.registerFont(TTFont("PlanTest", "docs/assets/fonts/D2Coding-Ver1.3.2-20180524.ttf"))
c = canvas.Canvas(output, pagesize=A4)
for index, page in enumerate(pages, 1):
    title = page["title"]
    marker = page["marker"]
    c.setFont("PlanTest", 18)
    c.drawString(48, 790, title)
    c.setFont("PlanTest", 10)
    body = marker + ". " + (("Planning evidence page %d. This page contains scoped service, interaction, data, "
            "flow, reliability, and limitation notes for deterministic review. " % index) * 4
    )
    text = c.beginText(48, 750)
    text.textLine(binding)
    for offset in range(0, len(body), 90):
        text.textLine(body[offset:offset + 90])
    c.drawText(text)
    c.showPage()
c.save()
`;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "planning-pdf-test-"));
  validPdf = join(directory, "valid.pdf");
  onePagePdf = join(directory, "one-page.pdf");
  python = findPdfPython();
  const sourceSha256 = createHash("sha256").update(await readFile("docs/planning-outline.md")).digest("hex");
  const screenshotManifestSha256 = createHash("sha256").update(await readFile("docs/assets/policy-lab-planning/manifest.json")).digest("hex");
  const binding = `POLICY LAB · 후보 기획서 인간 연구 없음 인과 추천 REJECT 경험적 캠페인 REVISE 기획 ${sourceSha256.slice(0, 12)} 캡처 ${screenshotManifestSha256.slice(0, 12)} 48경기 603 397/436 WOULD_PREVENT 정책 변경 0회 12/12 98 / 100 제출팀 60% 2026-07-27 10:00 KST 인간 연구는 없으며`;
  const pages = requiredPlanningPages.map((title, index) => ({ title, marker: requiredPdfPageMarkers[index] }));
  execFileSync(python, ["-c", generator, validPdf, JSON.stringify(pages), JSON.stringify(binding)]);
  execFileSync(python, ["-c", generator, onePagePdf, JSON.stringify([pages[0]]), JSON.stringify(binding)]);
}, 30_000);

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("rendered planning PDF preflight", () => {
  it("extracts and renders every expected page", async () => {
    const result = await inspectPlanningPdf(validPdf);
    expect(result.errors).toEqual([]);
    expect(result.pageCount).toBe(8);
    expect(result.renderedPages).toBe(8);
  }, 60_000);

  it("rejects an unrelated or incomplete PDF", async () => {
    const result = await inspectPlanningPdf(onePagePdf, { render: false });
    expect(result.errors).toContain("expected 8 PDF pages, found 1");
    expect(result.errors).toContain(`PDF page 2 missing source title: ${requiredPlanningPages[1]}`);
  });

  it("rejects a planning PDF bound to stale source or screenshot hashes", async () => {
    const inspection = await inspectPlanningPdf(validPdf, { render: false });
    const sourceSha256 = createHash("sha256").update(await readFile("docs/planning-outline.md")).digest("hex");
    const screenshotManifestSha256 = createHash("sha256").update(await readFile("docs/assets/policy-lab-planning/manifest.json")).digest("hex");
    expect(validatePlanningCandidateBindings(inspection.pages, { sourceSha256, screenshotManifestSha256 })).toEqual([]);
    expect(validatePlanningCandidateBindings(inspection.pages, {
      sourceSha256: "0".repeat(64), screenshotManifestSha256,
    })).toContain("PDF page 1 is not bound to current planning source");
  });

  it("binds human visual QA to both PDF and source hashes", async () => {
    const inspection = await inspectPlanningPdf(validPdf, { render: false });
    const source = await readFile("docs/planning-outline.md");
    const sourceSha256 = createHash("sha256").update(source).digest("hex");
    const timestamp = kstTimestamp(inspection.modifiedAtMs);
    const options = {
      pdfSha256: inspection.pdfSha256,
      sourceSha256,
      packetSha256: "a".repeat(64),
      renderer: "pdftoppm/25.06",
      pageCount: 8,
      artifactPath: validPdf,
      artifactCreatedAtMs: inspection.modifiedAtMs,
      now: inspection.modifiedAtMs + 60_000,
    };
    const ledger = visualQaRow({ timestamp, artifact: validPdf, pdfSha256: inspection.pdfSha256, sourceSha256 });
    expect(validateVisualQaLedger(ledger, options)).toEqual([]);
    expect(validateVisualQaLedger(ledger.replace("visual 8/8 PASS", "rendered"), {
      ...options,
    })).toContain("plan-visual-qa Checks cell must exactly equal 'visual 8/8 PASS'");
  });

  it("accepts a distinct subagent document review without relabeling it human evidence", async () => {
    const inspection = await inspectPlanningPdf(validPdf, { render: false });
    const sourceSha256 = createHash("sha256").update(await readFile("docs/planning-outline.md")).digest("hex");
    const review = await preparePlanReview({ pdfPath: validPdf, outputRoot: join(directory, "agent-review-packet") });
    const criteria = ["clipping", "overlap", "glyphs", "table_legibility", "page_numbers", "headers_footers", "citations", "claim_boundaries"];
    const record = {
      schema_version: 1,
      status: "PASS",
      scope: "independent-agent-document-qa-not-human-participant-usability-preference-evidence",
      reviewed_at: kstTimestamp(inspection.modifiedAtMs + 60_000),
      reviewer: { task: "/root/plan_pdf_agent_reviewer", role: "independent-agent", artifact_creator: false },
      artifact: { path: validPdf, sha256: inspection.pdfSha256, pages: 8 },
      planning_source: { path: "docs/planning-outline.md", sha256: sourceSha256 },
      review_packet: { path: join(review.packetDirectory, "review-manifest.json"), sha256: review.packetSha256, renderer: review.manifest.renderer },
      criteria,
      pages: review.manifest.rendered_pages.map((page) => ({
        ...page, width: 1404, height: 993,
        checks: Object.fromEntries(criteria.map((criterion) => [criterion, true])), findings: [],
      })),
      summary: { pages_passed: 8, blocker: 0, major: 0, minor: 0, finding_count: 0 },
    };
    const options = {
      artifactPath: validPdf, pdfSha256: inspection.pdfSha256, sourceSha256,
      packetPath: record.review_packet.path, packetSha256: review.packetSha256,
      renderer: review.manifest.renderer, artifactCreatedAtMs: inspection.modifiedAtMs,
      packetManifest: review.manifest, now: inspection.modifiedAtMs + 120_000,
    };
    expect(validateAgentVisualReview(record, options)).toEqual([]);
    const agentReviewSha256 = createHash("sha256").update(JSON.stringify(record)).digest("hex");
    const row = visualQaRow({
      timestamp: record.reviewed_at, artifact: validPdf, pdfSha256: inspection.pdfSha256, sourceSha256,
      notes: `reviewer=/root/plan_pdf_agent_reviewer role=independent-agent renderer=${review.manifest.renderer} packet=${review.packetSha256} review=${agentReviewSha256}`,
    });
    expect(validateVisualQaLedger(row, {
      ...options, pageCount: 8, artifactCreatedAtMs: inspection.modifiedAtMs, agentReviewSha256,
    })).toEqual([]);
    expect(validateAgentVisualReview({ ...record, reviewer: { ...record.reviewer, task: "/root" } }, options))
      .toContain("agent visual review requires a distinct non-creator subagent task");
    const tampered = structuredClone(record);
    tampered.pages[0].sha256 = "0".repeat(64);
    expect(validateAgentVisualReview(tampered, options))
      .toContain("agent visual review page 1 is incomplete or drifts from the packet");
    expect(validateVisualQaLedger(row.replace(agentReviewSha256, "0".repeat(64)), {
      ...options, pageCount: 8, artifactCreatedAtMs: inspection.modifiedAtMs, agentReviewSha256,
    })).toContain("plan-visual-qa agent review SHA-256 does not bind the validated review artifact");
  }, 60_000);

  it("rejects duplicate, future, pre-artifact, malformed, and anonymous visual QA evidence", async () => {
    const inspection = await inspectPlanningPdf(validPdf, { render: false });
    const source = await readFile("docs/planning-outline.md");
    const sourceSha256 = createHash("sha256").update(source).digest("hex");
    const timestamp = kstTimestamp(inspection.modifiedAtMs);
    const options = {
      pdfSha256: inspection.pdfSha256,
      sourceSha256,
      packetSha256: "a".repeat(64),
      renderer: "pdftoppm/25.06",
      pageCount: 8,
      artifactPath: validPdf,
      artifactCreatedAtMs: inspection.modifiedAtMs,
      now: inspection.modifiedAtMs + 60_000,
    };
    const valid = visualQaRow({ timestamp, artifact: validPdf, pdfSha256: inspection.pdfSha256, sourceSha256 });
    const cases = [
      { ledger: `${valid}\n${valid}`, error: "submission ledger contains duplicate plan-visual-qa rows" },
      { ledger: valid.replace(timestamp, kstTimestamp(options.now + 60_000)), error: "plan-visual-qa row timestamp is in the future" },
      { ledger: valid.replace(timestamp, kstTimestamp(inspection.modifiedAtMs - 60_000)), error: "plan-visual-qa row predates the planning PDF artifact" },
      { ledger: valid.replace(" | local |", " | public |"), error: "plan-visual-qa external status must be 'local'" },
      { ledger: valid.replace("visual 8/8 PASS", "visual 8/8 PASS PENDING"), error: "plan-visual-qa row contains a forbidden non-pass token" },
      { ledger: valid.replace("reviewer=mira-kim", "reviewer=reviewer"), error: "plan-visual-qa reviewer must be a named independent human, not a placeholder or creator role" },
      { ledger: valid.replace("reviewer=mira-kim", "reviewer=agent1"), error: "plan-visual-qa reviewer must be a named independent human, not a placeholder or creator role" },
      { ledger: valid.replace("reviewer=mira-kim", "reviewer=codex1"), error: "plan-visual-qa reviewer must be a named independent human, not a placeholder or creator role" },
      { ledger: valid.replace("reviewer=mira-kim", "reviewer=x"), error: "plan-visual-qa reviewer must be a named independent human, not a placeholder or creator role" },
      { ledger: valid.replace("renderer=pdftoppm/25.06", "renderer=pdftoppm"), error: "plan-visual-qa Notes must bind either an independent human attestation or an independent-agent review artifact" },
      { ledger: valid.replace("renderer=pdftoppm/25.06", "renderer=fake/9"), error: "plan-visual-qa renderer does not match the bound review packet" },
      { ledger: valid.replace(`packet=${"a".repeat(64)}`, `packet=${"b".repeat(64)}`), error: "plan-visual-qa packet SHA-256 does not bind the inspected page renders" },
      { ledger: valid.replace(" | local |", " | local | extra |"), error: "plan-visual-qa row must contain exactly 7 cells" },
    ];
    for (const { ledger, error } of cases) {
      expect(validateVisualQaLedger(ledger, options), ledger).toContain(error);
    }
  });

  it("promotes a visually reviewed PDF after canonical data admission", async () => {
    const inspection = await inspectPlanningPdf(validPdf, { render: false });
    const source = await readFile("docs/planning-outline.md");
    const sourceSha256 = createHash("sha256").update(source).digest("hex");
    const ledgerPath = join(directory, "ledger.md");
    const timestamp = kstTimestamp(inspection.modifiedAtMs);
    const review = await preparePlanReview({ pdfPath: validPdf, outputRoot: join(directory, "preflight-review") });
    await writeFile(
      ledgerPath,
      `${visualQaRow({ timestamp, artifact: validPdf, pdfSha256: inspection.pdfSha256, sourceSha256, notes: `reviewer=mira-kim role=independent-human renderer=${review.manifest.renderer} packet=${review.packetSha256}` })}\n`,
    );
    const handoff = await preparePlanOwnerHandoff({
      pdfPath: validPdf,
      reviewManifestPath: join(review.packetDirectory, "review-manifest.json"),
      ledgerPath,
      outputRoot: join(directory, "ready-owner-handoff"),
    });
    expect(handoff.manifest.ready_for_owner_upload).toBe(true);
    const handoffHtml = await readFile(handoff.htmlPath, "utf8");
    expect(handoffHtml).toContain("READY FOR OWNER UPLOAD");
    expect(handoffHtml).toContain("Open exact PDF for upload");
    expect(handoffHtml).toContain("Copy plan-submitted receipt row");
    expect(handoffHtml).toContain("agent\\d*");
    expect(handoffHtml).toContain("codex(?:[-_.].*)?");
    expect(handoffHtml).toContain("qa(?:[-_.].*)?");
    const result = spawnSync(
      process.execPath,
      [
        "scripts/preflight-submission.mjs", "--phase", "plan",
        "--planning-pdf", validPdf,
        "--submission-ledger", ledgerPath,
        "--plan-review-manifest", join(review.packetDirectory, "review-manifest.json"),
      ],
      { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, PDF_PYTHON: python } },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("[PASS] planning PDF content/render");
    expect(result.stdout).toContain("[PASS] planning visual QA ledger");
    expect(result.stdout).toContain("[PASS] competition data-scope eligibility");
  }, 60_000);

  it("validates an optional owner-observed planning submission receipt", async () => {
    const inspection = await inspectPlanningPdf(validPdf, { render: false });
    const timestamp = kstTimestamp(inspection.modifiedAtMs);
    const valid = `| ${timestamp} | plan-submitted | ${validPdf} | pdf=${inspection.pdfSha256} | owner-confirmation PASS | submitted | owner=jhkang confirmation=DAKER-PLAN-123 |`;
    const options = {
      artifactPath: validPdf, pdfSha256: inspection.pdfSha256,
      artifactCreatedAtMs: inspection.modifiedAtMs, now: inspection.modifiedAtMs + 60_000,
    };
    expect(validatePlanSubmissionReceipt("", options)).toEqual([]);
    expect(validatePlanSubmissionReceipt(valid, options)).toEqual([]);
    expect(validatePlanSubmissionReceipt(valid.replace("DAKER-PLAN-123", "PENDING"), options))
      .toContain("plan-submitted row contains a forbidden non-pass token");
    for (const placeholder of ["codex-reviewer", "reviewer", "human", "qa", "agent1"]) {
      expect(validatePlanSubmissionReceipt(valid.replace("owner=jhkang", `owner=${placeholder}`), options), placeholder)
        .toContain("plan-submitted owner must be a real owner identity, not a placeholder");
    }
  });

  it("rejects fabricated eligibility path overrides in production preflight", () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/preflight-submission.mjs", "--phase", "plan",
        "--planning-pdf", validPdf,
        "--eligibility-state", join(directory, "fabricated.json"),
      ],
      { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, PDF_PYTHON: python } },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[FAIL] canonical eligibility inputs: forbidden overrides: --eligibility-state");
  }, 60_000);
});
