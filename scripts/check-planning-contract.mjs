import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { validatePlanningContract } from "./lib/planning-contract.mjs";

const sourcePath = process.argv[2] ?? "docs/planning-outline.md";
const officialStatePath = process.argv[3] ?? "docs/official-state.md";

const [source, officialState, manifestText, freezeText, ledger, submittedPdf] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(officialStatePath, "utf8"),
  readFile("data/source-manifest.json", "utf8"),
  readFile("docs/planning-submission-freeze.json", "utf8"),
  readFile("docs/submission-ledger.md", "utf8"),
  readFile("output/pdf/corner-policy-lab-planning.pdf"),
]);
const freeze = JSON.parse(freezeText);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const planningDeadline = Date.parse("2026-07-27T10:00:00+09:00");
const submittedAt = Date.parse(freeze.submitted_at);
const submittedPdfSha256 = sha256(submittedPdf);
const planningSourceSha256 = sha256(source);
const expectedReceipt = `| ${freeze.submitted_at} | plan-submitted | ${freeze.artifact?.path} | pdf=${freeze.artifact?.sha256} | owner-confirmation PASS | submitted | owner=JHKang confirmation=${freeze.submission_id} |`;
const freezeErrors = [];
if (freeze.schema_version !== 1 || freeze.status !== "submitted-immutable") freezeErrors.push("planning submission freeze status is invalid");
if (!Number.isFinite(submittedAt) || submittedAt > planningDeadline) freezeErrors.push("planning submission freeze timestamp is invalid or late");
if (!/^[a-f0-9-]{36}$/u.test(freeze.submission_id ?? "")) freezeErrors.push("planning submission ID is invalid");
if (freeze.artifact?.path !== "output/pdf/corner-policy-lab-planning.pdf" ||
    freeze.artifact?.pages !== 8 || freeze.artifact?.sha256 !== submittedPdfSha256) {
  freezeErrors.push("planning submission freeze does not bind the immutable PDF");
}
if (freeze.planning_source?.path !== sourcePath || freeze.planning_source?.sha256 !== planningSourceSha256) {
  freezeErrors.push("planning submission freeze does not bind the canonical planning source");
}
if (!ledger.includes(expectedReceipt)) freezeErrors.push("submission ledger lacks the freeze-bound planning receipt");

const errors = validatePlanningContract({
  source,
  officialState,
  manifest: JSON.parse(manifestText),
  planningSubmitted: freezeErrors.length === 0,
});
errors.push(...freezeErrors);

if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] planning contract: ${error}`));
  process.exit(1);
}

console.log("[PASS] planning source structural lint: page-scoped markers and current evidence-state boundaries");
