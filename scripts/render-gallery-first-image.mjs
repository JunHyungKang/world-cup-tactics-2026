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
const proofCards = [
  ["1 · 감독이 먼저 선택", "수비에 둘까, 역습에 남길까", "두 명의 역할 · 수비 구역 · 통과 기준", images[0], "#79D5A5"],
  ["2 · 16강 8경기", "48% < 기준 50%", "선택하지 않은 구역의 코너 기록도 확인", images[1], "#F1C84B"],
  ["3 · 다음 8경기", "51% ≥ 기준 50%", "같은 선택 적용 · 변경 0회", images[2], "#F0A56A"],
];
const proofHtml = proofCards.map(([step, title, detail, image, color]) => `
  <article class="proof" style="--accent:${color}">
    <div class="proof-copy"><span>${escapeHtml(step)}</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>
    <div class="shot"><img src="${image}" alt="" /></div>
  </article>
`).join("");

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="ko"><style>
    @font-face{font-family:Plan;src:url('${font}') format('truetype');font-weight:700}
    *{box-sizing:border-box} body{margin:0;width:1440px;height:900px;overflow:hidden;background:#07110d;color:#f4f4ed;font-family:Plan,monospace}
    main{height:100%;padding:54px 62px 46px;position:relative;background:radial-gradient(circle at 34% 40%,#173126 0,#07110d 61%)}
    .layout{display:grid;grid-template-columns:1.18fr .82fr;gap:46px;height:100%}
    .story{display:flex;flex-direction:column;min-width:0}.eyebrow{color:#e7ea72;font-size:15px;letter-spacing:.13em}.title{margin:18px 0 12px;font-size:66px;line-height:1.01;letter-spacing:-.045em}.title span{color:#f1c84b}.sub{max-width:700px;color:#c5d0ca;font-size:18px;line-height:1.55}
    .choices{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:34px}.choice{min-height:164px;padding:20px;border:1px solid #395348;border-radius:20px;background:#10251d}.choice b{display:block;color:#aebbb4;font-size:14px}.choice strong{display:block;margin-top:10px;color:#f5f2e8;font-size:28px}.choice em{display:block;margin-top:6px;color:#83e6b8;font-size:18px;font-style:normal}.choice.primary{border:2px solid #f1c84b}.choice.primary em{color:#f1c84b}
    .campaign{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:10px;align-items:center;margin-top:18px}.campaign div{padding:13px 14px;border:1px solid #304b40;border-radius:13px;background:#0c1d17}.campaign strong{display:block;color:#f1c84b;font-size:25px}.campaign span{color:#aebbb4;font-size:13px}.campaign b{color:#f1c84b;font-size:24px}
    .receipt{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding:16px 18px;border:1px solid #527062;border-radius:14px;background:#0b1b15}.receipt strong{font-size:20px}.receipt span{color:#aebbb4;font-size:14px}.receipt em{color:#f0a76f;font-style:normal}
    .proofs{display:grid;grid-template-rows:repeat(3,1fr);gap:14px;min-width:0}.proof{display:grid;grid-template-columns:220px 1fr;min-height:0;overflow:hidden;border:1px solid var(--accent);border-radius:20px;background:#102019;box-shadow:0 18px 46px #0007}.proof-copy{display:flex;flex-direction:column;justify-content:center;padding:18px}.proof-copy span{color:var(--accent);font-size:13px}.proof-copy strong{margin-top:10px;font-size:22px;line-height:1.2}.proof-copy small{margin-top:8px;color:#aebbb4;font-size:13px;line-height:1.45}.shot{overflow:hidden;border-left:1px solid #385046;background:#06100c}.shot img{width:100%;height:100%;object-fit:cover;object-position:55% 48%;transform:scale(1.35)}
  </style><main>
    <section class="layout">
      <div class="story">
        <div class="eyebrow">CORNER POLICY LAB · 결과를 보기 전에 감독의 선택을 확정하세요</div>
        <h1 class="title">코너킥 수비,<br><span>한 명을 어디에 둘까요?</span></h1>
        <div class="sub">${escapeHtml(story.gallery.one_line)}</div>
        <div class="choices">
          <div class="choice primary"><b>수비에 한 명 더</b><strong>두 구역 맡기기</strong><em>역습 역할도 수비로</em></div>
          <div class="choice"><b>역습을 위해 한 명 남기기</b><strong>한 구역 맡기기</strong><em>역습 역할은 전방에</em></div>
        </div>
        <div class="campaign"><div><strong>48경기</strong><span>조별리그에서 기준 정하기</span></div><b>→</b><div><strong>8경기</strong><span>16강에서 첫 확인</span></div><b>→</b><div><strong>8경기</strong><span>같은 선택으로 다시 확인</span></div></div>
        <div class="receipt"><strong>결과 공개 뒤에도 선택 변경 0회</strong><span>겹친 기록과 <em>선택 밖 기록</em>을 함께 확인</span></div>
      </div>
      <section class="proofs">${proofHtml}</section>
    </section>
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
