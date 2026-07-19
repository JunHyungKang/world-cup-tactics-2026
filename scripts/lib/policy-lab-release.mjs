import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SOURCE_PATHS = Object.freeze([
  "prototypes/policy-dojo/index.html",
  "prototypes/policy-dojo/app.js",
  "prototypes/policy-dojo/styles.css",
  "public/data/policy-lab-spike.json",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function buildPolicyLabRelease({ outputRoot = "dist-policy-lab" } = {}) {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const sourceBytes = Object.fromEntries(await Promise.all(SOURCE_PATHS.map(async (path) => [path, await readFile(path)])));
  const html = sourceBytes["prototypes/policy-dojo/index.html"].toString("utf8")
    .replace('content="../../data/audit/policy-lab-spike.json"', 'content="./data/policy-lab-spike.json"');
  const outputs = {
    "index.html": Buffer.from(html),
    "app.js": sourceBytes["prototypes/policy-dojo/app.js"],
    "styles.css": sourceBytes["prototypes/policy-dojo/styles.css"],
    "data/policy-lab-spike.json": sourceBytes["public/data/policy-lab-spike.json"],
  };
  for (const [path, bytes] of Object.entries(outputs)) {
    await mkdir(dirname(join(outputRoot, path)), { recursive: true });
    await writeFile(join(outputRoot, path), bytes);
  }
  const manifest = {
    schema_version: 1,
    product_id: "corner-policy-lab",
    release_status: "candidate-not-public",
    product_selection_status: "PASS",
    causal_recommendation_status: "REJECT",
    empirical_campaign_status: "REVISE",
    entrypoint: "index.html",
    source_binding: Object.fromEntries(SOURCE_PATHS.map((path) => [path, sha256(sourceBytes[path])])),
    files: Object.entries(outputs).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })),
  };
  await writeFile(join(outputRoot, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { outputRoot, manifest, manifestSha256: sha256(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)) };
}
