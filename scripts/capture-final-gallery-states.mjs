import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { buildPolicyLabRelease } from "./lib/policy-lab-release.mjs";

const outputDirectory = "docs/assets/final-release";
const releaseDirectory = "tmp/final-gallery-release";
const baseUrl = "http://127.0.0.1:4176/";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

await mkdir(outputDirectory, { recursive: true });
const release = await buildPolicyLabRelease({ outputRoot: releaseDirectory });
const server = spawn(
  process.execPath,
  ["scripts/serve-policy-release.mjs", "--root", releaseDirectory, "--port", "4176"],
  { stdio: "ignore" },
);

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("final gallery release server did not start");
}

async function capture(page, id, proof) {
  const path = `${outputDirectory}/${id}.png`;
  await page.screenshot({ path, animations: "disabled" });
  const bytes = await readFile(path);
  return {
    id,
    proof,
    path,
    bytes: bytes.length,
    sha256: sha256(bytes),
    viewport: "1440x900",
  };
}

const artifacts = [];
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto(baseUrl);
  await page.getByRole("heading", {
    name: /포르투갈이 반복한 코너 전개.*우루과이는 이미 겪어봤을까요/u,
  }).waitFor();

  const evidenceDetail = page.locator(
    '[data-question-card="short-attacking-first"] .evidence-detail',
  );
  await evidenceDetail.locator("summary").click();
  await evidenceDetail.evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
  });
  artifacts.push(await capture(
    page,
    "01-matchup-analysis",
    "포르투갈의 반복 전개와 우루과이가 겪은 같은 장면을 원본 이벤트까지 대조한다",
  ));
  await evidenceDetail.locator("summary").click();

  await page.locator('[data-select="aerial-defending-first"]').click();
  await page.locator('[data-select="short-attacking-first"]').click();
  await page.getByRole("button", {
    name: "선택한 훈련 질문 2개를 맞대결 공개 전에 잠그기",
  }).click();
  await page.locator(".commit").evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
  });
  artifacts.push(await capture(
    page,
    "02-locked-questions",
    "우루과이의 사전 관찰 공백과 양 팀 공통 전개에서 두 질문을 골라 결과 전에 잠근다",
  ));

  await page.getByRole("button", {
    name: "가려 둔 우루과이–포르투갈 코너 기록 보기",
  }).click();
  await page.getByLabel("다음 회의에서 훈련 질문 다시 선택").check();
  await page.getByRole("textbox", { name: /이유/u }).fill(
    "선택하지 않은 그 밖의 전개가 3장면 나와 다음 회의에서 포함 여부를 검토",
  );
  await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();
  await page.getByTestId("counterevidence").evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
  });
  artifacts.push(await capture(
    page,
    "03-counterevidence",
    "선택 밖 3장면·10초 안 슈팅 2장면과 원본 corner 261095314를 다음 질문으로 남긴다",
  ));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

const manifest = {
  schema_version: 3,
  status: "current-candidate-gallery-source-not-public-or-human-evidence",
  release_manifest_sha256: release.manifestSha256,
  story: "Portugal sequences × Uruguay exposure → choose two questions → lock → hidden matchup → unselected counterevidence → memo",
  artifacts,
};
await writeFile(
  `${outputDirectory}/manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `[PASS] final Corner Prep Lab gallery states: ${artifacts.length} release=${release.manifestSha256}`,
);
