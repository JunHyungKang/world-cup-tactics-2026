import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { buildPolicyLabRelease } from "./lib/policy-lab-release.mjs";

const root = "tmp/invalid-policy-lab-dist";
await buildPolicyLabRelease({ outputRoot: root });
const invalidReport = JSON.parse(await readFile(`${root}/data/policy-lab-spike.json`, "utf8"));
invalidReport.team_scouting.matchup_challenger.status = "PASS";
await writeFile(`${root}/data/policy-lab-spike.json`, `${JSON.stringify(invalidReport, null, 2)}\n`, "utf8");

const preview = spawn(process.execPath, [
  "scripts/serve-policy-release.mjs", "--root", root, "--port", "4174",
], { stdio: "inherit" });
const stop = () => preview.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
preview.on("exit", (code) => process.exit(code ?? 0));
