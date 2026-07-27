import { spawnSync } from "node:child_process";

const reuseVisual = process.argv.slice(2).includes("--reuse-visual");
for (const argument of process.argv.slice(2)) {
  if (argument !== "--reuse-visual") {
    throw new Error(`unsupported local Policy Lab demo flag: ${argument}`);
  }
}

function run(script) {
  const result = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!reuseVisual) run("scripts/record-demo-rehearsal.mjs");
run("scripts/render-demo-narration.mjs");
run("scripts/check-demo-rehearsal.mjs");
run("scripts/check-policy-lab-demo.mjs");
console.log("[PASS] canonical Corner Prep Lab local visual and narrated rehearsal pipeline");
