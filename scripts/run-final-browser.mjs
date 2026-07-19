import { spawnSync } from "node:child_process";
import { computeEvidenceSourceDigest, parseDeploymentUrl } from "./lib/final-submission.mjs";
import { parsePairedFlags } from "./lib/cli.mjs";

const args = parsePairedFlags(process.argv.slice(2));
const deployedUrl = parseDeploymentUrl(args.get("--deployed-url"));
const releaseCommit = args.get("--release-commit");
const buildSha256 = args.get("--build-sha256");
if (!/^[0-9a-f]{40}$/u.test(releaseCommit ?? "")) throw new Error("--release-commit requires a full Git SHA");
if (!/^[0-9a-f]{64}$/u.test(buildSha256 ?? "")) throw new Error("--build-sha256 requires the stamped build digest");

const sourcePaths = [
  "playwright.final.config.ts",
  "tests/final-e2e/final-manager-loop.spec.ts",
  "vite.invalid-artifact.config.ts",
  "scripts/serve-invalid-fixture.mjs",
  "tests/fixtures/invalid-corner-scenarios.json",
];
const testSourceSha256 = await computeEvidenceSourceDigest(sourcePaths);
const result = spawnSync(process.execPath, [
  "node_modules/@playwright/test/cli.js", "test", "--config=playwright.final.config.ts",
], {
  stdio: "inherit",
  env: {
    ...process.env,
    FINAL_DEPLOYED_URL: deployedUrl,
    FINAL_RELEASE_COMMIT: releaseCommit,
    FINAL_BUILD_SHA256: buildSha256,
    FINAL_TEST_SOURCE_SHA256: testSourceSha256,
  },
});
process.exit(result.status ?? 1);
