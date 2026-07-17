import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve("data/source-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const required = ["id", "title", "url", "publisher", "retrieved_at_kst", "license", "status", "product_use"];
const allowedStatuses = new Set(["pending", "accepted", "rejected"]);
const errors = [];

if (manifest.schema_version !== 1 || !Array.isArray(manifest.sources)) {
  errors.push("schema_version must be 1 and sources must be an array");
}

for (const [index, source] of (manifest.sources ?? []).entries()) {
  const missing = required.filter((field) => !source[field]);
  if (missing.length) errors.push(`source ${index} missing: ${missing.join(", ")}`);
  if (source.status && !allowedStatuses.has(source.status)) errors.push(`source ${index} has invalid status`);
  if (source.url && !source.url.startsWith("https://")) errors.push(`source ${index} URL must use HTTPS`);
}

if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}

const accepted = manifest.sources.filter((source) => source.status === "accepted").length;
console.log(`[PASS] data manifest schema: ${manifest.sources.length} source(s), ${accepted} accepted`);
if (accepted === 0) console.log("[PENDING] product output must remain labeled prototype logic");
