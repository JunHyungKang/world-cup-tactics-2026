import { spawnSync } from "node:child_process";
import { findPdfPython } from "./lib/planning-pdf.mjs";

const outputIndex = process.argv.indexOf("--output");
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : "output/pdf/corner-policy-lab-planning.pdf";
const result = spawnSync(findPdfPython(), ["scripts/render-policy-lab-plan.py", "--output", output], { stdio: "inherit" });
process.exit(result.status ?? 1);
