import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.FINAL_DEPLOYED_URL;
const releaseCommit = process.env.FINAL_RELEASE_COMMIT;
const buildSha256 = process.env.FINAL_BUILD_SHA256;
const testSourceSha256 = process.env.FINAL_TEST_SOURCE_SHA256;
if (!baseURL || !releaseCommit || !buildSha256 || !testSourceSha256) {
  throw new Error("FINAL_DEPLOYED_URL, FINAL_RELEASE_COMMIT, FINAL_BUILD_SHA256, and FINAL_TEST_SOURCE_SHA256 are required");
}
const projectMetadata = { baseURL, releaseCommit, buildSha256, testSourceSha256 };

export default defineConfig({
  testDir: "tests/final-e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["json", { outputFile: "artifacts/final-playwright-report.json" }]],
  webServer: {
    command: `${process.execPath} scripts/serve-invalid-fixture.mjs`,
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
  metadata: { deployedUrl: baseURL, releaseCommit, buildSha256, testSourceSha256 },
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", metadata: projectMetadata, use: { ...devices["Desktop Chrome"], baseURL } },
    { name: "webkit", metadata: projectMetadata, use: { ...devices["iPhone 13"], baseURL } },
    { name: "firefox", metadata: projectMetadata, use: { ...devices["Desktop Firefox"], baseURL } },
    { name: "mobile", metadata: projectMetadata, use: { ...devices["Pixel 7"], baseURL } },
  ],
});
