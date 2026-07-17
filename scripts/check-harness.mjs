import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "AGENTS.md",
  "docs/competition-brief.md",
  "docs/product-thesis.md",
  "docs/decision-registry.md",
  "docs/submission-ledger.md",
  "data/source-manifest.json",
  "src/domain/tactics.ts",
  "tests/e2e/manager-loop.spec.ts",
];
const requiredSkills = [
  "orchestration",
  "product-gate",
  "data-audit",
  "browser-acceptance",
  "submission",
  "retrospective",
  "session-handoff",
];
const errors = [];

for (const path of requiredFiles) {
  try { await access(path); } catch { errors.push(`missing ${path}`); }
}

for (const name of requiredSkills) {
  const path = `.agents/skills/${name}/SKILL.md`;
  try {
    const text = await readFile(path, "utf8");
    if (!text.startsWith("---\n") || !text.includes(`name: ${name}\n`) || !text.includes("description:")) {
      errors.push(`invalid skill frontmatter: ${path}`);
    }
  } catch {
    errors.push(`missing ${path}`);
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(1);
}
console.log(`[PASS] harness: ${requiredFiles.length} surfaces and ${requiredSkills.length} skills`);
