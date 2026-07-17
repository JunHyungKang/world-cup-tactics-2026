import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { execFileSync } from "node:child_process";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const phase = args.get("--phase");
const failures = [];
const passes = [];

const check = (ok, name, detail) => (ok ? passes : failures).push(`${name}: ${detail}`);
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "dist", "playwright-report", "test-results"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await walk(path) : [path]));
  }
  return files;
}

check(phase === "plan" || phase === "final", "phase", phase ?? "missing --phase");

if (phase === "plan") {
  const pdfPath = args.get("--planning-pdf");
  try {
    const pdf = await readFile(pdfPath);
    check(extname(pdfPath).toLowerCase() === ".pdf" && pdf.subarray(0, 5).toString() === "%PDF-", "planning PDF", `${pdfPath} sha256=${sha256(pdf)}`);
  } catch (error) {
    check(false, "planning PDF", error.message);
  }
}

if (phase === "final") {
  for (const [flag, label] of [["--deployed-url", "deployment"], ["--github-url", "GitHub"], ["--youtube-url", "YouTube"]]) {
    const value = args.get(flag);
    check(Boolean(value?.startsWith("https://")), label, value ?? `missing ${flag}`);
  }
  try { await access("dist/index.html"); check(true, "production build", "dist/index.html present"); }
  catch { check(false, "production build", "run pnpm build"); }

  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  check(status === "", "Git freeze", status || "clean working tree");
  const commitEpoch = Number(execFileSync("git", ["log", "-1", "--format=%ct"], { encoding: "utf8" }).trim());
  const deadlineEpoch = Date.parse("2026-08-03T10:00:00+09:00") / 1000;
  check(commitEpoch <= deadlineEpoch, "commit deadline", new Date(commitEpoch * 1000).toISOString());
}

const secretPatterns = [/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/, /"(?:token|api_key|secret)"\s*:\s*"[^"\r\n]{12,}"/i];
const secretFindings = [];
for (const path of await walk(".")) {
  try {
    const content = await readFile(path);
    if (content.length <= 1_000_000 && secretPatterns.some((pattern) => pattern.test(content.toString("utf8")))) secretFindings.push(path);
  } catch { /* unreadable generated files are outside the submission source scan */ }
}
check(secretFindings.length === 0, "secret scan", secretFindings.join(", ") || "clear");

passes.forEach((message) => console.log(`[PASS] ${message}`));
failures.forEach((message) => console.error(`[FAIL] ${message}`));
process.exit(failures.length ? 1 : 0);
