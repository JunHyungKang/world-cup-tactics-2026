import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const copyFiles = [
  "src/App.tsx",
  "src/domain/cornerEvidence.ts",
  "docs/submission-story.json",
  "docs/demo-narration.json",
  "docs/demo-script.md",
  "docs/demo-captions.ko.srt",
  "docs/planning-outline.md",
  "scripts/render-planning-draft.py",
  "scripts/render-gallery-first-image.mjs",
  "prototypes/policy-dojo/app.js",
  "docs/policy-lab-product-contract.md",
  "docs/policy-lab-demo-narration.json",
  "docs/policy-lab-demo-60s.md",
  "docs/policy-lab-planning-outline.md",
  "scripts/render-policy-lab-plan.py",
  "scripts/prepare-external-owner-console.mjs",
];

export const rules = [
  { id: "LEGACY-01", severity: "error", pattern: /역할 회수/gu, message: "actual action is a defensive transition, not retrieval" },
  { id: "LEGACY-02", severity: "error", pattern: /설명하지 못한 슈팅 기록/gu, message: "use a natural passive relation: 이 선택으로 설명되지 않는" },
  { id: "SPACE-01", severity: "error", pattern: /우선구역/gu, message: "write 우선 구역 with a space" },
  { id: "MIXED-01", severity: "error", pattern: /(?:출처\s+event|Corner event|outlet band)/giu, message: "remove avoidable English from Korean UI copy" },
  { id: "UI-01", severity: "error", pattern: /(?:이전|다음) 기록/gu, message: "frame controls move between scenes, not records" },
  { id: "A-03", severity: "error", pattern: /에 있어서/gu, message: "replace translationese with 에서 or a direct clause" },
  { id: "A-08", severity: "error", pattern: /(?:되어진|보여진|지게 되어진)/gu, message: "remove double passive construction" },
  { id: "D-02", severity: "error", pattern: /(?:시사하는 바가 크|주목할 만하)/gu, message: "replace formulaic significance claims with concrete evidence" },
  { id: "D-03", severity: "error", pattern: /크게\s+(?:세|두)\s+가지로\s+나눌\s+수\s+있/gu, message: "remove mechanical list introduction" },
  { id: "G-02", severity: "error", pattern: /(?:가능성이\s+있을\s+수\s+있|보여질\s+수\s+있)/gu, message: "collapse stacked hedging" },
  { id: "COPY-01", severity: "error", pattern: /감사된\s+\d+개\s+기록/gu, message: "감사된 is an unnatural translation of audited" },
  { id: "COPY-02", severity: "error", pattern: /표시\s+가정/gu, message: "explain the visual limitation directly" },
  { id: "POLICY-COPY-01", severity: "error", pattern: /짧게 연결/gu, message: "use the project-standard football term 숏 코너" },
  { id: "POLICY-COPY-02", severity: "error", pattern: /박스 밖 변형/gu, message: "other includes more than outside-the-box deliveries; use 그 밖의 전달" },
  { id: "POLICY-COPY-03", severity: "error", pattern: /봉인 감사/gu, message: "avoid the literal audit translation; use 봉인 검증" },
  { id: "POLICY-COPY-04", severity: "error", pattern: /10초 내(?!에)/gu, message: "write 10초 이내" },
  { id: "POLICY-COPY-05", severity: "error", pattern: /(?:감독이 먼저 커밋|P1 후보 레인|미완료이며 통과로 세지)/gu, message: "replace project-management translationese with direct Korean" },
  { id: "DYNAMIC-01", severity: "error", pattern: /<span>\{current\.(?:sub_event_name|event_name)(?:\s*\|\|\s*current\.(?:sub_event_name|event_name))?\}<\/span>/gu, message: "map source taxonomy to Korean before rendering dynamic UI copy" },
];

export function auditText(text, path = "<text>") {
  const findings = [];
  for (const rule of rules) {
    for (const match of text.matchAll(rule.pattern)) {
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ path, line, id: rule.id, severity: rule.severity, span: match[0], message: rule.message });
    }
  }
  return findings;
}

export async function auditFiles(paths = copyFiles) {
  const reports = await Promise.all(paths.map(async (path) => auditText(await readFile(path, "utf8"), path)));
  return reports.flat();
}

async function main() {
  const findings = await auditFiles(process.argv.slice(2).length ? process.argv.slice(2) : copyFiles);
  if (findings.length) {
    for (const finding of findings) {
      console.error(`[${finding.severity.toUpperCase()}] ${finding.path}:${finding.line} ${finding.id} ${JSON.stringify(finding.span)} — ${finding.message}`);
    }
    process.exitCode = findings.some(({ severity }) => severity === "error") ? 1 : 0;
    return;
  }
  console.log(`[PASS] Korean copy audit: ${copyFiles.length} canonical surfaces, 0 high-confidence findings`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
