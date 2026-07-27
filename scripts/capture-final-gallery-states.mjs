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

async function capture(page, id) {
  const path = `${outputDirectory}/${id}.png`;
  await page.screenshot({ path, animations: "disabled" });
  const bytes = await readFile(path);
  return { id, path, bytes: bytes.length, sha256: sha256(bytes), viewport: "1440x900" };
}

const artifacts = [];
try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(baseUrl);
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="central-far"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 60% 선택" }).click();
  artifacts.push(await capture(page, "01-two-role-decision"));

  await page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" }).click();
  await page.getByRole("button", { name: "16강 8경기 결과 보기" }).click();
  await page.getByTestId("opponent-result").evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  artifacts.push(await capture(page, "02-round-of-16-audit"));

  await page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }).click();
  artifacts.push(await capture(page, "03-final-audit"));
  await browser.close();
} finally {
  server.kill("SIGTERM");
}

const manifest = {
  schema_version: 1,
  status: "current-candidate-gallery-source-not-public-or-human-evidence",
  release_manifest_sha256: release.manifestSha256,
  artifacts,
};
await writeFile(`${outputDirectory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[PASS] final gallery states: ${artifacts.length} release=${release.manifestSha256}`);
