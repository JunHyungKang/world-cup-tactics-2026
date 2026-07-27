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

async function add(page, name, count) {
  for (let index = 0; index < count; index += 1) {
    await page.getByRole("button", { name }).click();
  }
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
  await page.getByRole("heading", { name: /포르투갈 코너 상황 3유형/u }).waitFor();

  const evidenceDetail = page.locator(
    '[data-routine-card="short-recorded-endpoint"] .evidence-detail',
  );
  await evidenceDetail.locator("summary").click();
  await evidenceDetail.evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
  });
  artifacts.push(await capture(
    page,
    "01-evidence-detail",
    "14/14와 5/6을 분리하고 선수·팀 역할·후속 이벤트를 연다",
  ));
  await evidenceDetail.locator("summary").click();

  await add(page, "숏 구역 전달 훈련 1회 추가", 5);
  await add(page, "비숏 · 공중 후속 기록 훈련 1회 추가", 4);
  await add(page, "비숏 · 기타 후속 기록 훈련 1회 추가", 1);
  await page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" }).click();
  await page.locator(".commit").evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
  });
  artifacts.push(await capture(
    page,
    "02-locked-allocation",
    "단순 환산한 5/4/1을 맞대결 기록 공개 전에 잠근다",
  ));

  await page.getByRole("button", { name: "가려 둔 맞대결 첫 전개 보기" }).click();
  await page.getByLabel("다음 회의에서 훈련 비중 재배분").check();
  await page.getByRole("textbox", { name: /이유/u }).fill(
    "비숏 전달 뒤 기타 후속 기록이 예상보다 2회 많아 재배분을 검토",
  );
  await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();
  await page.locator(".difference-grid").evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
  });
  artifacts.push(await capture(
    page,
    "03-held-out-review",
    "실제 5/2/3과 원시 차이를 보고 다음 회의 메모를 별도로 저장한다",
  ));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

const manifest = {
  schema_version: 2,
  status: "current-candidate-gallery-source-not-public-or-human-evidence",
  release_manifest_sha256: release.manifestSha256,
  story: "14/14·5/6 → evidence → 5/4/1 non-optimal → lock → 5/2/3 → raw difference → memo",
  artifacts,
};
await writeFile(
  `${outputDirectory}/manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `[PASS] final Corner Prep Lab gallery states: ${artifacts.length} release=${release.manifestSha256}`,
);
