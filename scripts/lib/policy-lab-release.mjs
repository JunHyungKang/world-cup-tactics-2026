import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SOURCE_PATHS = Object.freeze([
  "prototypes/opponent-scouting/index.html",
  "prototypes/opponent-scouting/app.js",
  "prototypes/opponent-scouting/styles.css",
  "public/data/policy-lab-spike.json",
]);
const SOURCE_MANIFEST_PATH = "data/source-manifest.json";
const REQUIRED_SOURCE_IDS = Object.freeze([
  "pappalardo-wyscout-events-wc-2018",
  "pappalardo-wyscout-matches-wc-2018",
  "pappalardo-wyscout-players",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function buildPolicyLabRelease({ outputRoot = "dist-policy-lab", releaseStatus = "candidate-public" } = {}) {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const sourceBytes = Object.fromEntries(await Promise.all(
    [...SOURCE_PATHS, SOURCE_MANIFEST_PATH].map(async (path) => [path, await readFile(path)]),
  ));
  const sourceManifest = JSON.parse(sourceBytes[SOURCE_MANIFEST_PATH].toString("utf8"));
  for (const sourceId of REQUIRED_SOURCE_IDS) {
    const source = sourceManifest.sources?.find((candidate) => candidate.id === sourceId);
    if (source?.status !== "accepted" || source?.rights_status !== "cleared") {
      throw new Error(`release requires accepted, rights-cleared source ${sourceId}`);
    }
  }
  const empiricalReport = JSON.parse(sourceBytes["public/data/policy-lab-spike.json"].toString("utf8"));
  if (empiricalReport.team_scouting?.corner_situation_rehearsal?.status !== "PASS") {
    throw new Error("release requires a PASS team-situation rehearsal artifact");
  }
  const html = sourceBytes["prototypes/opponent-scouting/index.html"].toString("utf8")
    .replace('content="../../data/audit/policy-lab-spike.json"', 'content="./data/policy-lab-spike.json"');
  const outputs = {
    "index.html": Buffer.from(html),
    "app.js": sourceBytes["prototypes/opponent-scouting/app.js"],
    "styles.css": sourceBytes["prototypes/opponent-scouting/styles.css"],
    "data/policy-lab-spike.json": sourceBytes["public/data/policy-lab-spike.json"],
  };
  for (const [path, bytes] of Object.entries(outputs)) {
    await mkdir(dirname(join(outputRoot, path)), { recursive: true });
    await writeFile(join(outputRoot, path), bytes);
  }
  const manifest = {
    schema_version: 1,
    product_id: "corner-policy-lab",
    release_status: releaseStatus,
    product_selection_status: "PASS",
    implementation_refinement_status: "PASS",
    manager_loop: "team-situation-rehearsal",
    causal_recommendation_status: "REJECT",
    empirical_campaign_status: "REVISE",
    entrypoint: "index.html",
    admitted_source_manifest: {
      path: SOURCE_MANIFEST_PATH,
      sha256: sha256(sourceBytes[SOURCE_MANIFEST_PATH]),
      source_ids: REQUIRED_SOURCE_IDS,
    },
    source_binding: Object.fromEntries(SOURCE_PATHS.map((path) => [path, sha256(sourceBytes[path])])),
    files: Object.entries(outputs).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })),
  };
  await writeFile(join(outputRoot, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { outputRoot, manifest, manifestSha256: sha256(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)) };
}
