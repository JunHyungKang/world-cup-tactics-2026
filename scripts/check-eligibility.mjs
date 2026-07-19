import { readFile } from "node:fs/promises";
import { runEligibilityAcceptanceTests, validateEligibilityArtifacts, validateEligibilityPromotion, validateEligibilityState, validateEligibilityTrackedArtifacts, validateOfficialAnswerLive, validateOfficialScopeLive } from "./lib/eligibility.mjs";

const promotion = process.argv.includes("--promotion");
const [stateText, officialState, organizerQuestion, productThesis, planningSource, manifestText, productSelectionText] = await Promise.all([
  readFile("docs/data-scope-resolution.json", "utf8"),
  readFile("docs/official-state.md", "utf8"),
  readFile("docs/organizer-data-scope-question.md", "utf8"),
  readFile("docs/product-thesis.md", "utf8"),
  readFile("docs/planning-outline.md", "utf8"),
  readFile("data/source-manifest.json", "utf8"),
  readFile("docs/product-selection.json", "utf8"),
]);
const input = {
  state: JSON.parse(stateText),
  officialState,
  organizerQuestion,
  productThesis,
  planningSource,
  manifest: JSON.parse(manifestText),
  productSelection: JSON.parse(productSelectionText),
  raw: { officialState, organizerQuestion, productThesis, planningSource, manifest: manifestText, productSelection: productSelectionText },
};
const errors = promotion ? validateEligibilityPromotion(input) : validateEligibilityState(input);
if (!promotion && errors.length === 0) {
  errors.push(...await validateEligibilityArtifacts(input));
  errors.push(...validateEligibilityTrackedArtifacts(input));
  errors.push(...await validateOfficialScopeLive({ state: input.state }));
}
if (promotion && errors.length === 0) {
  errors.push(...await validateEligibilityArtifacts(input));
  errors.push(...await validateOfficialAnswerLive({ state: input.state }));
  errors.push(...await validateOfficialScopeLive({ state: input.state }));
  errors.push(...runEligibilityAcceptanceTests(input));
}
if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] eligibility: ${error}`));
  process.exit(1);
}
console.log(`[PASS] eligibility state contract: ${input.state.status}`);
if (input.state.status === "unresolved") {
  console.log("[PENDING] plan/final promotion remains blocked until an allowed data-scope route is evidenced");
} else if (input.state.status === "scope-confirmed-open") {
  console.log("[PASS] competition year scope resolved by the official DAKER Data-tab rule");
  console.log("[PENDING] plan/final promotion remains blocked on source admission and derived-data evidence");
} else if (input.state.status === "resolved-official-open-historical") {
  console.log("[PASS] official historical route and product data admitted");
}
