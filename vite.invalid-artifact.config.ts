import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [{
    name: "invalid-corner-artifact-fixture",
    resolveId(id: string) {
      return id === "virtual:corner-scenarios" ? "\0virtual:corner-scenarios" : null;
    },
    load(id: string) {
      if (id !== "\0virtual:corner-scenarios") return null;
      const raw = readFileSync(new URL("./tests/fixtures/invalid-corner-scenarios.json", import.meta.url), "utf8");
      return `export default ${JSON.stringify(JSON.parse(raw))};`;
    },
  }, react()],
  build: { outDir: "tmp/invalid-dist", emptyOutDir: true },
});
