import { readFile } from "node:fs/promises";
import { validatePrimaryStudy } from "./lib/user-study.mjs";

const path = process.argv[2] ?? "evidence/user-studies/primary-wave-1.json";
const study = JSON.parse(await readFile(path, "utf8"));
const errors = validatePrimaryStudy(study);
if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] user study: ${error}`));
  process.exit(1);
}
console.log(study.status === "pending"
  ? `[PENDING] user study contract ready: ${path}`
  : `[PASS] primary user study: ${JSON.stringify(study.summary)}`);
