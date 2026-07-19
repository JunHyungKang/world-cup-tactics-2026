import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { eligibilityConstants, parseStrictRfc3339, runEligibilityAcceptanceTests, validateEligibilityArtifacts } from "./lib/eligibility.mjs";

const manifestPath = resolve("data/source-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const required = ["id", "title", "url", "publisher", "retrieved_at_kst", "license", "rights_status", "capabilities", "status", "product_use"];
const allowedStatuses = new Set(["pending", "accepted", "rejected"]);
const allowedRightsStatuses = new Set(["cleared", "pending", "unresolved"]);
const errors = [];

if (manifest.schema_version !== 1 || !Array.isArray(manifest.sources)) {
  errors.push("schema_version must be 1 and sources must be an array");
}
const sourceIds = (manifest.sources ?? []).map((source) => source.id);
if (sourceIds.some((id) => typeof id !== "string" || id.length === 0) || new Set(sourceIds).size !== sourceIds.length) {
  errors.push("source IDs must be non-empty and unique");
}

for (const [index, source] of (manifest.sources ?? []).entries()) {
  const missing = required.filter((field) => !source[field]);
  if (missing.length) errors.push(`source ${index} missing: ${missing.join(", ")}`);
  if (source.status && !allowedStatuses.has(source.status)) errors.push(`source ${index} has invalid status`);
  if (source.url && !source.url.startsWith("https://")) errors.push(`source ${index} URL must use HTTPS`);
  if (!allowedRightsStatuses.has(source.rights_status)) errors.push(`source ${index} has invalid rights_status`);
  if (!Array.isArray(source.capabilities) || source.capabilities.some((capability) => typeof capability !== "string" || !capability) ||
      new Set(source.capabilities ?? []).size !== (source.capabilities ?? []).length) errors.push(`source ${index} capabilities must be unique strings`);
  if (source.status === "accepted") {
    const evidence = source.acceptance_evidence;
    if (!evidence || typeof evidence !== "object") {
      errors.push(`source ${index} accepted without acceptance_evidence`);
      continue;
    }
    const acceptedAt = parseStrictRfc3339(evidence.accepted_at);
    if (!Number.isFinite(acceptedAt) || acceptedAt > Date.now()) errors.push(`source ${index} accepted_at must be real and non-future`);
    if (source.rights_status !== "cleared") errors.push(`source ${index} cannot be accepted without cleared rights`);
    if (typeof evidence.implementer !== "string" || typeof evidence.reviewer !== "string" ||
        evidence.implementer === evidence.reviewer || /^(?:self|test|unknown|codex)$/iu.test(evidence.reviewer ?? "")) {
      errors.push(`source ${index} requires an independently named reviewer`);
    }
    if (!Array.isArray(evidence.test_argv) || evidence.test_argv.length !== 3 || evidence.test_argv[0] !== "node_modules/vitest/vitest.mjs" ||
        evidence.test_argv[1] !== "run" || evidence.test_argv[2] !== evidence.artifacts?.release_test?.path) {
      errors.push(`source ${index} acceptance_evidence has invalid test_argv`);
    }
    for (const key of eligibilityConstants.acceptanceArtifactKeys) {
      const artifact = evidence.artifacts?.[key];
      if (!artifact || typeof artifact.path !== "string" || !/^[a-f0-9]{64}$/u.test(artifact.sha256 ?? "")) {
        errors.push(`source ${index} invalid ${key} artifact binding`);
        continue;
      }
      const absolute = resolve(artifact.path);
      const rel = relative(process.cwd(), absolute);
      if (isAbsolute(artifact.path) || rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
        errors.push(`source ${index} ${key} path must be repo-relative and contained`);
        continue;
      }
      try {
        const bytes = await readFile(absolute);
        const digest = createHash("sha256").update(bytes).digest("hex");
        if (digest !== artifact.sha256) errors.push(`source ${index} ${key} SHA-256 mismatch`);
        try { execFileSync("git", ["ls-files", "--error-unmatch", "--", artifact.path], { stdio: "ignore" }); }
        catch { errors.push(`source ${index} ${key} artifact is not tracked by Git: ${artifact.path}`); }
      } catch {
        errors.push(`source ${index} ${key} path missing: ${artifact.path}`);
      }
    }
  }
}

const acceptedIds = manifest.sources.filter((source) => source.status === "accepted").map((source) => source.id);
if (acceptedIds.length) {
  errors.push(...await validateEligibilityArtifacts({
    state: { status: "unresolved", evidence_source_ids: acceptedIds },
    manifest,
    productSelection: { data_files: [] },
  }));
  errors.push(...runEligibilityAcceptanceTests({ state: { evidence_source_ids: acceptedIds }, manifest }));
}

if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}

const accepted = acceptedIds.length;
console.log(`[PASS] data manifest schema: ${manifest.sources.length} source(s), ${accepted} accepted`);
if (accepted === 0) console.log("[PENDING] product output must remain labeled prototype logic");
