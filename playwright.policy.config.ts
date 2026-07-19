import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/prototypes",
  use: { baseURL: "http://127.0.0.1:4174", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/serve-policy-dojo.mjs",
    url: "http://127.0.0.1:4174/prototypes/policy-dojo/",
    reuseExistingServer: true,
  },
});
