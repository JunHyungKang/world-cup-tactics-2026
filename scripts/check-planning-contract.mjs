import { readFile } from "node:fs/promises";
import { validatePlanningContract } from "./lib/planning-contract.mjs";

const sourcePath = process.argv[2] ?? "docs/planning-outline.md";
const officialStatePath = process.argv[3] ?? "docs/official-state.md";

const [source, officialState, manifestText] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(officialStatePath, "utf8"),
  readFile("data/source-manifest.json", "utf8"),
]);
const errors = validatePlanningContract({
  source,
  officialState,
  manifest: JSON.parse(manifestText),
});

if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] planning contract: ${error}`));
  process.exit(1);
}

console.log("[PASS] planning source structural lint: page-scoped markers and current evidence-state boundaries");
