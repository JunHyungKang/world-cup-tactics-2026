import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findPdfPython, inspectPlanningPdf, validatePlanningScreenshotManifest } from "./lib/planning-pdf.mjs";
import { computeEvidenceSourceDigest } from "./lib/final-submission.mjs";
import { inspectPlanReviewManifest, preparePlanReview } from "./lib/plan-review.mjs";
import { preparePlanOwnerHandoff } from "./lib/plan-owner-handoff.mjs";

let directory;
let pdfPath;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "planning-candidate-test-"));
  pdfPath = join(directory, "candidate.pdf");
  const result = spawnSync(findPdfPython(), ["scripts/render-planning-draft.py", "--output", pdfPath], { cwd: process.cwd(), encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
}, 30_000);

afterAll(async () => rm(directory, { recursive: true, force: true }));

describe("planning candidate PDF", () => {
  it("generates eight current-build pages bound to source and screenshots", async () => {
    const result = await inspectPlanningPdf(pdfPath, { render: false });
    expect(result.errors).toEqual([]);
    expect(result.pageCount).toBe(8);
    const sourceSha = createHash("sha256").update(await readFile("docs/planning-outline.md")).digest("hex").slice(0, 16);
    const screenshotSha = createHash("sha256").update(await readFile("docs/assets/policy-lab-planning/manifest.json")).digest("hex").slice(0, 12);
    for (const page of result.pages) {
      expect(page.text).toContain("DAKER · 기획서");
      expect(page.text).not.toContain("NOT SUBMITTED");
      expect(page.text).toContain(`기획 ${sourceSha.slice(0, 12)}`);
      expect(page.text).toContain(`캡처 ${screenshotSha}`);
      expect(page.text).toContain("인간 연구 없음");
    }
  });

  it("contains official rubric/current proof and rejects old pending language", async () => {
    const result = await inspectPlanningPdf(pdfPath, { render: false });
    const text = result.pages.map((page) => page.text).join("\n");
    for (const marker of ["제출팀 60%", "603", "397/436", "WOULD_PREVENT", "정책 변경 0회", "12/12", "다음 미팅"]) expect(text).toContain(marker);
    expect(text).not.toContain("98 / 100");
    expect(text).not.toContain("공식 후보로 승격");
    for (const stale of ["DATA AUDIT PENDING", "implementation pending", "transform/full audit pending", "Touchline Lab"]) expect(text).not.toContain(stale);
  });

  it("pins OFL D2Coding and does not embed AppleGothic", async () => {
    const expected = new Map([
      ["docs/assets/fonts/D2Coding-Ver1.3.2-20180524.ttf", "8b1b23e5de4dff652fb0b938528150d2f531edfda281d3944618b655711aba84"],
      ["docs/assets/fonts/D2CodingBold-Ver1.3.2-20180524.ttf", "dde75df435f061eaa0f6db84b1c30866aaa442d7038aaa62ea3c2be92f15d87d"],
      ["docs/assets/fonts/D2Coding-OFL-1.1.md", "2c7430445cce97d8403c363be9543a68ed601904b94dc2817453dee39e336324"],
    ]);
    for (const [path, digest] of expected) {
      expect(createHash("sha256").update(await readFile(path)).digest("hex"), path).toBe(digest);
    }
    const result = await inspectPlanningPdf(pdfPath, { render: false });
    const fonts = new Set(result.pages.flatMap((page) => page.fonts));
    expect([...fonts].some((font) => font.includes("D2Coding"))).toBe(true);
    expect([...fonts].some((font) => font.includes("AppleGothic"))).toBe(false);
  });

  it("binds every planning screenshot to the exact current build inputs", async () => {
    const manifest = JSON.parse(await readFile("docs/assets/policy-lab-planning/manifest.json", "utf8"));
    expect(await validatePlanningScreenshotManifest(manifest)).toEqual([]);
    expect(manifest.viewport_contract).toEqual({ desktop: "1440x900", mobile: "390x844" });
    expect(Date.parse(manifest.captured_at)).toBeGreaterThanOrEqual(Date.parse("2026-07-18T00:00:00Z"));
    expect(manifest.source_binding.sha256).toBe(await computeEvidenceSourceDigest(manifest.source_binding.paths));
    expect(manifest.build_binding.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(manifest.build_binding.file_count).toBe(manifest.build_binding.files.length);
    for (const artifact of manifest.artifacts) {
      const bytes = await readFile(artifact.path);
      expect(bytes.length, artifact.path).toBe(artifact.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), artifact.path).toBe(artifact.sha256);
    }
  });

  it("prepares an exact-artifact packet that starts unapproved", async () => {
    const result = await preparePlanReview({ pdfPath, outputRoot: join(directory, "review") });
    expect(result.manifest.status).toBe("review-packet-not-human-evidence");
    expect(result.manifest.artifact.pages).toBe(8);
    expect(result.manifest.rendered_pages).toHaveLength(8);
    expect(result.manifest.review_html).toMatchObject({
      path: "review.html",
      normalization: "replace-exact-packet-manifest-sha256-with-64-P-placeholder",
    });
    expect(result.manifest.review_html.normalized_sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.manifest.renderer).toMatch(/^pdftoppm\/\d+(?:\.\d+)+$/u);
    expect(result.packetSha256).toMatch(/^[a-f0-9]{64}$/u);
    for (const page of result.manifest.rendered_pages) {
      expect(page.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(page.bytes).toBeGreaterThan(1_000);
      expect((await readFile(join(result.packetDirectory, page.path))).length).toBe(page.bytes);
    }
    const html = await readFile(result.htmlPath, "utf8");
    expect(html.match(/class="page-check" type="checkbox"/gu)).toHaveLength(8);
    expect(html).toContain("No PASS row exists until every condition is complete.");
    expect(html).toContain("not a product study");
    expect(html).toContain("The artifact creator, Codex, agents, and synthetic personas cannot approve this gate.");
    expect(html).toContain("copy.disabled=!ready");
    expect(html).toContain("packet='+config.packetSha256");
    expect(html).toContain("agent\\d*");
    const inspection = await inspectPlanReviewManifest(join(result.packetDirectory, "review-manifest.json"), {
      artifactPath: pdfPath,
      pdfSha256: result.manifest.artifact.sha256,
      sourceSha256: result.manifest.planning_source.sha256,
      screenshotManifestSha256: result.manifest.screenshot_manifest.sha256,
      pageCount: 8,
    });
    expect(inspection.errors).toEqual([]);
    expect(inspection.packetSha256).toBe(result.packetSha256);

    await writeFile(result.htmlPath, html.replace("copy.disabled=!ready", "copy.disabled=false"));
    const tamperedHtml = await inspectPlanReviewManifest(join(result.packetDirectory, "review-manifest.json"), {
      artifactPath: pdfPath,
      pdfSha256: result.manifest.artifact.sha256,
      sourceSha256: result.manifest.planning_source.sha256,
      screenshotManifestSha256: result.manifest.screenshot_manifest.sha256,
      pageCount: 8,
    });
    expect(tamperedHtml.errors).toContain("plan review HTML normalized digest mismatch");
    await writeFile(result.htmlPath, html);

    const manifestPath = join(result.packetDirectory, "review-manifest.json");
    const originalManifestBytes = await readFile(manifestPath);
    const packetPlaceholder = "P".repeat(64);
    const weakenedHtmlTemplate = html
      .replace(result.packetSha256, packetPlaceholder)
      .replace("copy.disabled=!ready", "copy.disabled=false");
    const resignedManifest = JSON.parse(originalManifestBytes.toString("utf8"));
    resignedManifest.review_html.normalized_sha256 = createHash("sha256").update(weakenedHtmlTemplate).digest("hex");
    resignedManifest.review_html.bytes = Buffer.byteLength(weakenedHtmlTemplate);
    const resignedManifestBytes = Buffer.from(`${JSON.stringify(resignedManifest, null, 2)}\n`);
    const resignedPacketSha256 = createHash("sha256").update(resignedManifestBytes).digest("hex");
    await writeFile(manifestPath, resignedManifestBytes);
    await writeFile(result.htmlPath, weakenedHtmlTemplate.replace(packetPlaceholder, resignedPacketSha256));
    const resignedAttack = await inspectPlanReviewManifest(manifestPath, {
      artifactPath: pdfPath,
      pdfSha256: result.manifest.artifact.sha256,
      sourceSha256: result.manifest.planning_source.sha256,
      screenshotManifestSha256: result.manifest.screenshot_manifest.sha256,
      pageCount: 8,
    });
    expect(resignedAttack.errors).toContain("plan review HTML canonical contract mismatch");
    await writeFile(manifestPath, originalManifestBytes);
    await writeFile(result.htmlPath, html);

    const emptyLedger = join(directory, "empty-submission-ledger.md");
    await writeFile(emptyLedger, "# Empty test ledger\n");
    const handoff = await preparePlanOwnerHandoff({
      pdfPath,
      reviewManifestPath: join(result.packetDirectory, "review-manifest.json"),
      ledgerPath: emptyLedger,
      outputRoot: join(directory, "owner-handoff"),
    });
    expect(handoff.manifest.ready_for_owner_upload).toBe(false);
    expect(handoff.manifest.ledger.visual_qa_errors).toContain("submission ledger lacks a plan-visual-qa row");
    const handoffHtml = await readFile(handoff.htmlPath, "utf8");
    expect(handoffHtml).toContain("LOCKED — VISUAL QA PENDING");
    expect(handoffHtml).toContain("Locked until green preflight");
    expect(handoffHtml).not.toContain("Open exact PDF for upload");
    expect(handoffHtml).not.toContain("Copy plan-submitted receipt row");

    const firstPage = join(result.packetDirectory, "pages/page-1.png");
    await writeFile(firstPage, Buffer.from("tampered"));
    const tampered = await inspectPlanReviewManifest(join(result.packetDirectory, "review-manifest.json"), {
      artifactPath: pdfPath,
      pdfSha256: result.manifest.artifact.sha256,
      sourceSha256: result.manifest.planning_source.sha256,
      pageCount: 8,
    });
    expect(tampered.errors).toContain("plan review page 1 digest mismatch");
  }, 60_000);

  it("rejects a review packet when the planning source drifts from the PDF", async () => {
    const driftedSource = join(directory, "drifted-planning-outline.md");
    await writeFile(driftedSource, `${await readFile("docs/planning-outline.md", "utf8")}\nsource drift\n`);
    await expect(preparePlanReview({
      pdfPath,
      outputRoot: join(directory, "drifted-review"),
      sourcePath: driftedSource,
    })).rejects.toThrow("not bound to current planning source");
  });
});
