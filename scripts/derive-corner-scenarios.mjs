import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { auditCsv, deriveCornerData, INPUT_HASHES, NOMINAL_REGIONS, sha256, TRANSFORM_VERSION } from "./lib/corner-transform.mjs";

const eventsPath = "data/raw/pappalardo/events_World_Cup.json";
const matchesPath = "data/raw/pappalardo/matches_World_Cup.json";
const eventsZip = "data/raw/pappalardo/events.zip";
const matchesZip = "data/raw/pappalardo/matches.zip";

const [eventBytes, matchBytes, eventZipBytes, matchZipBytes, semanticReviewBytes] = await Promise.all([
  readFile(eventsPath), readFile(matchesPath), readFile(eventsZip), readFile(matchesZip),
  readFile("data/audit/brazil-corner-semantic-review.json"),
]);
for (const [label, bytes, expected] of [
  ["events ZIP", eventZipBytes, INPUT_HASHES.eventsZip], ["events", eventBytes, INPUT_HASHES.events],
  ["matches ZIP", matchZipBytes, INPUT_HASHES.matchesZip], ["matches", matchBytes, INPUT_HASHES.matches],
]) {
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`${label} input SHA-256 mismatch: ${actual}`);
}
for (const [zip, entry, extracted] of [[eventsZip, "events_World_Cup.json", eventBytes], [matchesZip, "matches_World_Cup.json", matchBytes]]) {
  const result = spawnSync("unzip", ["-p", zip, entry], { maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`failed to read ${entry} from ${zip}`);
  if (!result.stdout.equals(extracted)) throw new Error(`${entry} bytes differ from extracted input`);
}

const { windows, summary } = deriveCornerData(JSON.parse(eventBytes), JSON.parse(matchBytes));
const publicData = {
  schema_version: 1,
  product_id: "corner-war-room",
  data_scope: "official-open-historical-tactics",
  transform_version: TRANSFORM_VERSION,
  provenance: {
    source_ids: ["pappalardo-wyscout-events-wc-2018", "pappalardo-wyscout-matches-wc-2018"],
    source_dois: ["10.6084/m9.figshare.7770599.v1", "10.6084/m9.figshare.7770422.v1"],
    license: "CC BY 4.0",
    license_url: "https://creativecommons.org/licenses/by/4.0/",
    input_sha256: INPUT_HASHES,
    attribution: "Luca Pappalardo and Emanuele Massucco, Soccer Match Event Dataset; transformed and coordinate-normalized by this project; no author, Wyscout, FIFA, or team endorsement implied.",
  },
  limitations: [
    "2018 historical recorded windows; not a 2026 team tendency or prediction",
    "event endpoints are not continuous ball or player tracking",
    "eligible Pass/Clearance segments are straight-line rendering assumptions between two recorded endpoints",
    "project-defined regions are not learned zones or player reach",
    "recorded contact does not prove prevention, success, or an alternative result",
  ],
  window_seconds: 10,
  regions: NOMINAL_REGIONS,
  summary,
  windows,
};
const publicBytes = Buffer.from(`${JSON.stringify(publicData, null, 2)}\n`);
const semanticReview = JSON.parse(semanticReviewBytes);
const expectedIds = windows.map((window) => window.corner_event_id).sort((a, b) => a - b);
for (const key of ["structural_pass_ids", "semantic_pass_ids"]) {
  const ids = [...(semanticReview[key] ?? [])].sort((a, b) => a - b);
  if (semanticReview.schema_version !== 1 || semanticReview.status !== "PASS" || semanticReview.reviewer === "corner-transform-implementer" ||
      JSON.stringify(ids) !== JSON.stringify(expectedIds)) throw new Error(`semantic review ${key} does not cover exactly 42 derived windows`);
}
if (semanticReview.public_json_sha256 !== sha256(publicBytes)) throw new Error("semantic review is not bound to the generated public JSON");

await Promise.all([mkdir("public/data", { recursive: true }), mkdir("data/audit", { recursive: true })]);
await Promise.all([
  writeFile("public/data/corner-scenarios.json", publicBytes),
  writeFile("data/audit/brazil-corner-window-review.csv", auditCsv(windows, semanticReview)),
]);
console.log(JSON.stringify({ status: "PASS", summary }, null, 2));
