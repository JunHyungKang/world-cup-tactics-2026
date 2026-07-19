import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const outputDirectory = "docs/assets/gallery";
const outputPath = `${outputDirectory}/corner-policy-lab-first-image.png`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const escapeHtml = (value) => value.replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const storyBytes = await readFile("docs/submission-story.json");
const story = JSON.parse(storyBytes);
const sourcePaths = story.gallery.source_images;
const [fontBytes, ...sourceBytes] = await Promise.all([
  readFile("docs/assets/fonts/D2CodingBold-Ver1.3.2-20180524.ttf"),
  ...sourcePaths.map((path) => readFile(path)),
]);
const images = sourceBytes.map((bytes) => `data:image/png;base64,${bytes.toString("base64")}`);
const font = `data:font/ttf;base64,${fontBytes.toString("base64")}`;
const cards = [
  ["1 · 참고", "48경기에서 두 구역 선택", images[0], "#79D5A5"],
  ["2 · 중간 평가", "16강 8경기 · 대표 반례", images[1], "#F1C84B"],
  ["3 · 봉인 검증", "같은 정책 · 변경 0회", images[2], "#F0A56A"],
];
const cardHtml = cards.map(([step, caption, image, color], index) => `
  <article class="card" style="--accent:${color}">
    <div class="step">${escapeHtml(step)}</div>
    <img src="${image}" alt="" />
    <div class="caption">${escapeHtml(caption)}</div>
  </article>${index < cards.length - 1 ? '<div class="arrow">→</div>' : ""}
`).join("");

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="ko"><style>
    @font-face{font-family:Plan;src:url('${font}') format('truetype');font-weight:700}
    *{box-sizing:border-box} body{margin:0;width:1440px;height:900px;overflow:hidden;background:#07110d;color:#f4f4ed;font-family:Plan,monospace}
    main{height:100%;padding:42px 64px;position:relative;background:radial-gradient(circle at 50% 40%,#173126 0,#07110d 63%)}
    .eyebrow{color:#e7ea72;font-size:15px;letter-spacing:.14em}.title{margin:10px 0 4px;font-size:45px;line-height:1.15}.sub{color:#aebbb4;font-size:19px}
    .flow{height:610px;margin-top:24px;display:flex;align-items:center;justify-content:center;gap:22px}.card{width:390px;height:570px;padding:12px;border:2px solid var(--accent);border-radius:22px;background:#102019;box-shadow:0 18px 46px #0008;display:flex;flex-direction:column}
    .step{height:36px;color:var(--accent);font-size:16px;display:flex;align-items:center}.card img{width:362px;height:472px;object-fit:cover;object-position:top;border-radius:13px;border:1px solid #53655a}.caption{height:38px;display:flex;align-items:end;justify-content:center;color:#f4f4ed;font-size:15px;text-align:center}
    .arrow{font-size:42px;color:#e7ea72}.boundary{position:absolute;bottom:24px;left:64px;right:64px;display:flex;justify-content:space-between;color:#aebbb4;font-size:14px}.boundary b{color:#f0a76f}
  </style><main>
    <div class="eyebrow">CORNER POLICY LAB · 한 정책을 두 번 반박하는 감독 실험</div>
    <h1 class="title">${escapeHtml(story.gallery.title)}</h1>
    <div class="sub">${escapeHtml(story.gallery.one_line)}</div>
    <section class="flow">${cardHtml}</section>
    <div class="boundary"><span>2018 월드컵 603개 코너 · 경기 단위 48–8–8 분할 · 고정 정책 지문</span><b>위치 겹침만 계산 · 인과 추천 REJECT</b></div>
  </main></html>`);
  await page.screenshot({ path: outputPath, animations: "disabled" });
} finally {
  await browser.close();
}

const outputBytes = await readFile(outputPath);
const manifest = {
  schema_version: 1,
  status: "current-build-composite-not-human-evidence",
  viewport: "1440x900",
  submission_story_sha256: sha256(storyBytes),
  sources: sourcePaths.map((path, index) => ({ path, sha256: sha256(sourceBytes[index]), bytes: sourceBytes[index].length })),
  output: { path: outputPath, sha256: sha256(outputBytes), bytes: outputBytes.length },
};
await writeFile(`${outputDirectory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[PASS] gallery first image: ${outputPath} sha256=${manifest.output.sha256}`);
