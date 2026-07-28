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
  ["1 · 반복 기록 확인", "3장면 · 2경기", "콰레스마의 코너 뒤 첫 기록에 게헤이루 등장 · 패스 대상 의미 없음", images[0], "#79D5A5"],
  ["2 · 직접 비교와 참고 구분", "먼저 볼 영상 2묶음", "전개 방식·첫 기록의 팀·이벤트 유형을 확인한 뒤 감독이 선택", images[1], "#F1C84B"],
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
        <h1 class="title">16강 전날,<br><span>포르투갈 코너 영상은<br>무엇부터 볼까?</span></h1>
        <div class="sub">${escapeHtml(story.gallery.one_line)}</div>
        <div class="choices">
          <div class="choice primary">
            <b>반복된 선수·이벤트 연결</b>
            <strong>키커 콰레스마</strong>
            <span>첫 기록에 등장한 선수 게헤이루</span>
            <em>같은 기록 묶음 3장면 · 2경기</em>
          </div>
          <div class="choice">
            <b>우루과이 비교 장면</b>
            <strong>직접 비교 · 참고</strong>
            <em>세 가지 기록 조건으로 구분</em>
          </div>
        </div>
        <div class="campaign">
          <div><strong>3 · 2</strong><span>장면 · 경기</span></div>
          <b>→</b>
          <div><strong>2개</strong><span>먼저 볼 영상 묶음 잠금</span></div>
          <b>→</b>
          <div><strong>3 · 2</strong><span>선택 밖 장면 · 슈팅</span></div>
        </div>
        <div class="receipt">
          <strong>기록은 장면을 찾고, 감독은 영상을 판단합니다</strong>
          <span>대응 전술 판정 대신 <em>다음 회의 안건</em>을 남김</span>
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
