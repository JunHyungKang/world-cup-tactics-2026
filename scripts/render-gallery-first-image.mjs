import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const outputDirectory = "docs/assets/gallery";
const outputPath = `${outputDirectory}/corner-policy-lab-first-image.png`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const escapeHtml = (value) => value.replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
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
  ["1 · 작은 표본을 보정", "포르투갈 47% · 대회 53%", "토너먼트 160개에서 대회 평균 대비 로그손실 4.6% 감소", images[0], "#79D5A5"],
  ["2 · 원본 장면 안건을 잠금", "영상 검토 안건 2개", "포르투갈 3/3경기 반복과 우루과이 관찰 경기를 보고 감독이 선택", images[1], "#F1C84B"],
  ["3 · 선택 밖 반례를 확인", "3장면 · 10초 안 슈팅 2장면", "corner 261095314를 다음 회의 안건으로 저장", images[2], "#F0A56A"],
];
const proofHtml = proofCards.map(([step, title, detail, image, color]) => `
  <article class="proof" style="--accent:${color}">
    <div class="proof-copy">
      <span>${escapeHtml(step)}</span>
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
    <div class="shot"><img src="${image}" alt="" /></div>
  </article>
`).join("");

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><html lang="ko"><style>
    @font-face{font-family:Plan;src:url('${font}') format('truetype');font-weight:700}
    *{box-sizing:border-box}
    body{margin:0;width:1440px;height:900px;overflow:hidden;background:#07110d;color:#f4f4ed;font-family:Plan,monospace}
    main{height:100%;padding:54px 62px 46px;position:relative;background:radial-gradient(circle at 34% 40%,#173126 0,#07110d 61%)}
    .layout{display:grid;grid-template-columns:1.18fr .82fr;gap:46px;height:100%}
    .story{display:flex;flex-direction:column;min-width:0}
    .eyebrow{color:#e7ea72;font-size:15px;letter-spacing:.13em}
    .title{margin:18px 0 12px;font-size:64px;line-height:1.01;letter-spacing:-.045em}
    .title span{color:#f1c84b}
    .sub{max-width:700px;color:#c5d0ca;font-size:17px;line-height:1.55}
    .choices{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:30px}
    .choice{min-height:154px;padding:20px;border:1px solid #395348;border-radius:20px;background:#10251d}
    .choice b{display:block;color:#aebbb4;font-size:14px}
    .choice strong{display:block;margin-top:10px;color:#f5f2e8;font-size:27px}
    .choice em{display:block;margin-top:6px;color:#83e6b8;font-size:17px;font-style:normal}
    .choice.primary{border:2px solid #f1c84b}
    .choice.primary em{color:#f1c84b}
    .campaign{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:10px;align-items:center;margin-top:18px}
    .campaign div{padding:13px 14px;border:1px solid #304b40;border-radius:13px;background:#0c1d17}
    .campaign strong{display:block;color:#f1c84b;font-size:25px}
    .campaign span{color:#aebbb4;font-size:12px}
    .campaign b{color:#f1c84b;font-size:24px}
    .receipt{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding:16px 18px;border:1px solid #527062;border-radius:14px;background:#0b1b15}
    .receipt strong{font-size:19px}
    .receipt span{max-width:250px;color:#aebbb4;font-size:13px;text-align:right}
    .receipt em{color:#f0a76f;font-style:normal}
    .proofs{display:grid;grid-template-rows:repeat(3,1fr);gap:14px;min-width:0}
    .proof{display:grid;grid-template-columns:230px 1fr;min-height:0;overflow:hidden;border:1px solid var(--accent);border-radius:20px;background:#102019;box-shadow:0 18px 46px #0007}
    .proof-copy{display:flex;flex-direction:column;justify-content:center;padding:18px}
    .proof-copy span{color:var(--accent);font-size:12px}
    .proof-copy strong{margin-top:10px;font-size:20px;line-height:1.25}
    .proof-copy small{margin-top:8px;color:#aebbb4;font-size:12px;line-height:1.45}
    .shot{overflow:hidden;border-left:1px solid #385046;background:#06100c}
    .shot img{width:100%;height:100%;object-fit:cover;object-position:52% 48%;transform:scale(1.28)}
  </style><main>
    <section class="layout">
      <div class="story">
        <div class="eyebrow">CORNER SCOUT LAB · 2018 WORLD CUP</div>
        <h1 class="title">포르투갈 코너 14개만<br><span>그대로 믿어도 될까?</span></h1>
        <div class="sub">${escapeHtml(story.gallery.one_line)}</div>
        <div class="choices">
          <div class="choice primary">
            <b>포르투갈이 공격한 코너</b>
            <strong>14/14</strong>
            <em>팀 근거 47% · 대회 기록으로 보정</em>
          </div>
          <div class="choice">
            <b>우루과이가 수비한 코너</b>
            <strong>5/6</strong>
            <em>예측에 섞지 않고 원본 장면만 확인</em>
          </div>
        </div>
        <div class="campaign">
          <div><strong>397개</strong><span>작은 표본 보정</span></div>
          <b>→</b>
          <div><strong>2개</strong><span>영상 검토 안건 잠금</span></div>
          <b>→</b>
          <div><strong>3 · 2</strong><span>선택 밖 장면 · 슈팅</span></div>
        </div>
        <div class="receipt">
          <strong>모델은 검토 범위를 좁히고, 장면은 감독이 판단합니다</strong>
          <span>약점 판정 대신 <em>다음 회의 안건</em>을 남김</span>
        </div>
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
  schema_version: 2,
  status: "current-build-composite-not-human-evidence",
  viewport: "1440x900",
  submission_story_sha256: sha256(storyBytes),
  sources: sourcePaths.map((path, index) => ({
    path,
    sha256: sha256(sourceBytes[index]),
    bytes: sourceBytes[index].length,
  })),
  output: {
    path: outputPath,
    sha256: sha256(outputBytes),
    bytes: outputBytes.length,
  },
};
await writeFile(
  `${outputDirectory}/manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`[PASS] Corner Scout Lab gallery first image: ${outputPath} sha256=${manifest.output.sha256}`);
