import { spawn, spawnSync } from "node:child_process";

const node = process.execPath;
const baseUrl = "http://127.0.0.1:4173/";
const releaseRoot = "tmp/pre-release-policy-lab-dist";

function run(argv) {
  const result = spawnSync(node, argv, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function waitForServer(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`preview did not become ready: ${url}`);
}

run(["scripts/build-policy-lab.mjs", "--output", releaseRoot]);
const preview = spawn(node, [
  "scripts/serve-policy-release.mjs", "--root", releaseRoot, "--port", "4173",
], { stdio: "inherit" });
let stopped = false;
const stop = () => {
  if (!stopped) {
    stopped = true;
    preview.kill("SIGTERM");
  }
};
process.on("SIGINT", () => { stop(); process.exit(130); });
process.on("SIGTERM", () => { stop(); process.exit(143); });

try {
  await waitForServer(baseUrl);
  const result = spawnSync(node, [
    "node_modules/@playwright/test/cli.js", "test", "--config=playwright.final.config.ts",
    "--workers=1",
    "--grep-invert", "BG-12 production marker binds the Policy Lab release and admitted data",
  ], {
    stdio: "inherit",
    env: {
      ...process.env,
      FINAL_DEPLOYED_URL: baseUrl,
      FINAL_RELEASE_COMMIT: "0".repeat(40),
      FINAL_BUILD_SHA256: "0".repeat(64),
      FINAL_TEST_SOURCE_SHA256: "0".repeat(64),
    },
  });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else console.log("[PASS] pre-release browser contract: BG-01–11 and BG-13–15 across all configured projects; BG-12 deferred to stamped deployment");
} finally {
  stop();
}
