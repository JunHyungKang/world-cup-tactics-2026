import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

const virtualCornerId = "virtual:corner-scenarios";
const resolvedVirtualCornerId = `\0${virtualCornerId}`;

function cornerArtifactPlugin() {
  return {
    name: "corner-artifact-build-binding",
    resolveId(id: string) {
      return id === virtualCornerId ? resolvedVirtualCornerId : null;
    },
    load(id: string) {
      if (id !== resolvedVirtualCornerId) return null;
      const raw = readFileSync(new URL("./public/data/corner-scenarios.json", import.meta.url), "utf8");
      return `export default ${JSON.stringify(JSON.parse(raw))};`;
    },
  };
}

export default defineConfig({
  // Keep the frozen build portable across root and repository-subpath static hosts.
  // Public-release parity is still proven separately by BG-12 and final preflight.
  base: "./",
  plugins: [cornerArtifactPlugin(), react()],
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    // Raw archives are intentionally ignored. Exact raw -> derivative reproduction is
    // an explicit local evidence lane; the public-clone suite checks committed bytes.
    exclude: ["scripts/derive-corner-scenarios.test.mjs"],
  },
});
