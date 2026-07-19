import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildPolicyLabSpike } from "./lib/policy-lab-spike.mjs";

const [events, matches] = await Promise.all([
  readFile("data/raw/pappalardo/events_World_Cup.json", "utf8").then(JSON.parse),
  readFile("data/raw/pappalardo/matches_World_Cup.json", "utf8").then(JSON.parse),
]);

const report = buildPolicyLabSpike(events, matches);
const serialized = `${JSON.stringify(report, null, 2)}\n`;
await Promise.all([
  mkdir("data/audit", { recursive: true }),
  mkdir("public/data", { recursive: true }),
]);
await Promise.all([
  writeFile("data/audit/policy-lab-spike.json", serialized, { flag: "w" }),
  writeFile("public/data/policy-lab-spike.json", serialized, { flag: "w" }),
]);
console.log(`Policy Lab spike: ${report.status}`);
console.log(JSON.stringify({ gates: report.gates, ten_second_summary: report.ten_second_summary }, null, 2));
