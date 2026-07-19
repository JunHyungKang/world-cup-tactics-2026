import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { computeBuildDigest, computeEvidenceSourceDigest } from "./lib/final-submission.mjs";

const node = process.execPath;
const baseURL = "http://127.0.0.1:4183";
const outputDirectory = "docs/assets/planning";

function run(argv) {
  const result = spawnSync(node, argv, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(baseURL, { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`planning preview did not become ready: ${baseURL}`);
}

async function capture(page, name) {
  const path = `${outputDirectory}/${name}.png`;
  await page.screenshot({ path, animations: "disabled" });
  const bytes = await readFile(path);
  return { path, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
}

run(["node_modules/vite/bin/vite.js", "build"]);
const sourcePaths = [
  "package.json", "pnpm-lock.yaml", "vite.config.ts", "index.html", "src/App.tsx", "src/styles.css",
  "src/domain/cornerEvidence.ts", "public/data/corner-scenarios.json", "public/data/product-binding.json",
];
const [build, sourceSha256] = await Promise.all([
  computeBuildDigest("dist"),
  computeEvidenceSourceDigest(sourcePaths),
]);
await mkdir(outputDirectory, { recursive: true });
const preview = spawn(node, [
  "node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4183", "--strictPort",
], { stdio: "inherit" });

try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await desktop.goto(baseURL);
    const artifacts = [await capture(desktop, "desktop-initial")];
    await desktop.getByRole("button", { name: "세컨드볼 대비", exact: true }).click();
    artifacts.push(await capture(desktop, "desktop-selected"));
    await desktop.getByRole("button", { name: /반례 보기/u }).click();
    artifacts.push(await capture(desktop, "desktop-counterexample"));

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await mobile.goto(baseURL);
    artifacts.push(await capture(mobile, "mobile-initial"));
    await mobile.getByRole("button", { name: "세컨드볼 대비", exact: true }).click();
    artifacts.push(await capture(mobile, "mobile-selected"));
    await mobile.getByRole("button", { name: /반례 보기/u }).click();
    artifacts.push(await capture(mobile, "mobile-counterexample"));

    const manifest = {
      schema_version: 1,
      source: "current production build rendered locally",
      captured_at: new Date().toISOString(),
      base_url: baseURL,
      source_binding: { paths: sourcePaths, sha256: sourceSha256 },
      build_binding: { sha256: build.buildSha256, file_count: build.fileCount, files: build.files },
      viewport_contract: { desktop: "1440x900", mobile: "390x844" },
      artifacts,
    };
    await writeFile(`${outputDirectory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`[PASS] planning screenshots: ${artifacts.length} artifact(s)`);
  } finally {
    await browser.close();
  }
} finally {
  preview.kill("SIGTERM");
}
