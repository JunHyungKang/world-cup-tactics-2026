import { preparePlanReview } from "./lib/plan-review.mjs";
import { parsePairedFlags } from "./lib/cli.mjs";

let args;
try {
  args = parsePairedFlags(process.argv.slice(2));
  const result = await preparePlanReview({
    pdfPath: args.get("--planning-pdf") ?? "output/pdf/corner-policy-lab-planning.pdf",
    outputRoot: args.get("--output") ?? "output/plan-review",
  });
  console.log(`[PASS] independent-human review packet prepared: ${result.htmlPath}`);
  console.log(`[BOUND] pdf=${result.manifest.artifact.sha256} source=${result.manifest.planning_source.sha256} packet=${result.packetSha256} renderer=${result.manifest.renderer}`);
  console.log("[PENDING] packet generation is not human evidence; an independent human must inspect 8/8 pages");
} catch (error) {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
}
