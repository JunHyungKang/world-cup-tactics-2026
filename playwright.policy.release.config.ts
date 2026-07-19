import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/policy-release",
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:4175", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/build-policy-lab.mjs && node scripts/serve-policy-release.mjs",
    url: "http://127.0.0.1:4175/",
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
