import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { buildPolicyLabRelease } from "./lib/policy-lab-release.mjs";

const root = "tmp/invalid-policy-lab-dist";
await buildPolicyLabRelease({ outputRoot: root });
await writeFile(`${root}/data/policy-lab-spike.json`, '{"status":"PASS","policy_campaign":null}\n', "utf8");

const preview = spawn(process.execPath, [
  "scripts/serve-policy-release.mjs", "--root", root, "--port", "4174",
], { stdio: "inherit" });
const stop = () => preview.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
preview.on("exit", (code) => process.exit(code ?? 0));
