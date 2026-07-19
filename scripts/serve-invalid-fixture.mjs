import { spawn, spawnSync } from "node:child_process";

const build = spawnSync(process.execPath, [
  "node_modules/vite/bin/vite.js", "build", "--config", "vite.invalid-artifact.config.ts",
], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const preview = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js", "preview", "--config", "vite.invalid-artifact.config.ts",
  "--host", "127.0.0.1", "--port", "4174", "--strictPort",
], { stdio: "inherit" });
const stop = () => preview.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
preview.on("exit", (code) => process.exit(code ?? 0));
