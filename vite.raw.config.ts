import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/derive-corner-scenarios.test.mjs"],
  },
});
