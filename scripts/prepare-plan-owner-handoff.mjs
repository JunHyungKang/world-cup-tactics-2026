import { parsePairedFlags } from "./lib/cli.mjs";
import { preparePlanOwnerHandoff } from "./lib/plan-owner-handoff.mjs";

try {
  const args = parsePairedFlags(process.argv.slice(2));
  const result = await preparePlanOwnerHandoff({
    pdfPath: args.get("--planning-pdf") ?? "output/pdf/corner-policy-lab-planning.pdf",
    reviewManifestPath: args.get("--review-manifest"),
    ledgerPath: args.get("--submission-ledger") ?? "docs/submission-ledger.md",
    outputRoot: args.get("--output") ?? "output/plan-owner-handoff",
  });
  console.log(`[PASS] planning owner handoff prepared: ${result.htmlPath}`);
  console.log(result.manifest.ready_for_owner_upload
    ? "[READY] independent document visual QA is bound; owner upload sequence is unlocked"
    : `[LOCKED] ${result.manifest.ledger.visual_qa_errors.join("; ")}`);
  console.log("[BOUNDARY] this packet does not upload, submit, approve, or confirm anything");
} catch (error) {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
}
