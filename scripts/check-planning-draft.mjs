import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { inspectPlanningPdf, validatePlanningCandidateBindings } from "./lib/planning-pdf.mjs";

const pdfPath = process.argv[2] ?? "output/pdf/corner-policy-lab-planning.pdf";
const result = await inspectPlanningPdf(pdfPath);
const errors = [];
const sourceSha256 = createHash("sha256").update(await readFile("docs/planning-outline.md")).digest("hex");
const screenshotManifestSha256 = createHash("sha256").update(await readFile("docs/assets/policy-lab-planning/manifest.json")).digest("hex");
errors.push(...validatePlanningCandidateBindings(result.pages, { sourceSha256, screenshotManifestSha256 }));
result.errors.push(...errors);
if (result.errors.length) {
  result.errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}
console.log(`[PASS] planning package structure/render: ${result.pageCount} pages sha256=${result.pdfSha256}`);
console.log("[PENDING] automated render is not independent-human plan-visual-qa and does not authorize submission");
