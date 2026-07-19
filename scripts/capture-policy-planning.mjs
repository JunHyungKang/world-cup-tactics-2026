import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { buildPolicyLabRelease } from "./lib/policy-lab-release.mjs";

const output = "docs/assets/policy-lab-planning";
const baseUrl = "http://127.0.0.1:4175/";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digestPaths = async (paths) => {
  const hash = createHash("sha256");
  for (const path of [...paths].sort()) {
    hash.update(path); hash.update("\0"); hash.update(await readFile(path)); hash.update("\0");
  }
  return hash.digest("hex");
};
await mkdir(output, { recursive: true });
const release = await buildPolicyLabRelease();
const server = spawn(process.execPath, ["scripts/serve-policy-release.mjs"], { stdio: "ignore" });

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(baseUrl)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Policy Lab release server did not start");
}

const artifacts = [];
async function capture(page, name, fullPage = true) {
  const path = `${output}/${name}.png`;
  await page.screenshot({ path, fullPage, animations: "disabled" });
  const bytes = await readFile(path);
  artifacts.push({ name, path, bytes: bytes.length, sha256: sha256(bytes) });
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(baseUrl);
  await capture(page, "01-initial");
  await page.getByRole("button", { name: "숏 코너에 주의 토큰 배치" }).click();
  await page.getByRole("button", { name: "니어포스트에 주의 토큰 배치" }).click();
  await capture(page, "02-policy-selected");
  await page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" }).click();
  await page.getByRole("button", { name: "16강 8경기 평가 요약 공개" }).click();
  await capture(page, "03-heldout-result");
  await page.locator(".event-ledger summary").click();
  await capture(page, "04-contradiction");
  await page.getByRole("button", { name: "같은 정책으로 봉인 검증 8경기 공개" }).click();
  await capture(page, "05-final-verification");
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(baseUrl);
  await capture(mobile, "06-mobile-initial", false);
  await browser.close();
  const sourcePaths = Object.keys(release.manifest.source_binding);
  const manifest = {
    schema_version: 1,
    product_id: "corner-policy-lab",
    captured_at: new Date().toISOString(),
    release_manifest_sha256: release.manifestSha256,
    viewport_contract: { desktop: "1440x900", mobile: "390x844" },
    source_binding: { paths: sourcePaths, sha256: await digestPaths(sourcePaths) },
    build_binding: {
      sha256: release.manifestSha256,
      file_count: release.manifest.files.length,
      files: release.manifest.files,
    },
    artifacts,
  };
  await writeFile(`${output}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[PASS] Policy Lab planning captures: ${artifacts.length}`);
} finally {
  server.kill("SIGTERM");
}
