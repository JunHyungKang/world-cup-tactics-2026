import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const paths = {
  story: "docs/submission-story.json",
  planHandoff: "output/plan-owner-handoff/81e2ae3c74519f86/handoff-manifest.json",
  planPdf: "output/pdf/corner-policy-lab-planning.pdf",
  rehearsalVideo: "output/policy-lab-demo/corner-policy-lab-60s-narrated.webm",
  gallery: "docs/assets/gallery/corner-policy-lab-first-image.png",
  outputDirectory: "output/external-owner-console",
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadJson(relativePath) {
  return JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
}

async function hashFile(relativePath) {
  return sha256(await readFile(resolve(root, relativePath)));
}

function releaseCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`cannot resolve release commit: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export async function buildOwnerConsoleModel() {
  const [story, handoff, planSha256, rehearsalSha256, gallerySha256] = await Promise.all([
    loadJson(paths.story),
    loadJson(paths.planHandoff),
    hashFile(paths.planPdf),
    hashFile(paths.rehearsalVideo),
    hashFile(paths.gallery),
  ]);

  if (!handoff.ready_for_owner_upload) throw new Error("canonical planning handoff is not ready");
  if (handoff.artifact.path !== paths.planPdf || handoff.artifact.sha256 !== planSha256) {
    throw new Error("planning handoff does not bind the exact PDF");
  }
  if (story.evidence.narrated_video.path !== paths.rehearsalVideo || story.evidence.narrated_video.sha256 !== rehearsalSha256) {
    throw new Error("submission story does not bind the exact rehearsal video");
  }
  if (story.gallery.first_image !== paths.gallery) throw new Error("submission story gallery path drifted");

  return {
    schema_version: 1,
    status: "owner-console-not-submission-or-confirmation",
    release_commit: releaseCommit(),
    planning: {
      status: "READY",
      path: paths.planPdf,
      sha256: planSha256,
      pages: handoff.artifact.pages,
      handoff: paths.planHandoff,
    },
    final_release: {
      status: "LOCKED",
      reason: "최종 제출용 스탬프 검증과 공개 URL 기준 최종 녹화가 아직 끝나지 않았습니다",
    },
    public_release: {
      status: "CANDIDATE-PUBLIC",
      deployed_url: "https://junhyungkang.github.io/world-cup-tactics-2026/",
      github_url: "https://github.com/JunHyungKang/world-cup-tactics-2026",
      boundary: "현재 후보는 공개됐지만 최종 BG-12와 DAKER 제출 영수증은 아닙니다",
    },
    youtube: {
      status: "LOCKED",
      title: story.video.title,
      local_rehearsal_path: paths.rehearsalVideo,
      local_rehearsal_sha256: rehearsalSha256,
      duration_seconds: story.video.narrated_duration_seconds,
      boundary: "local rehearsal only; do not upload as the final public demo",
    },
    gallery: {
      title: story.gallery.title,
      one_line: story.gallery.one_line,
      path: paths.gallery,
      sha256: gallerySha256,
    },
    claims: story.claim_boundary,
  };
}

export function renderOwnerConsole(model) {
  const embedded = JSON.stringify(model).replaceAll("<", "\\u003c");
  const title = escapeHtml(model.gallery.title);
  const oneLine = escapeHtml(model.gallery.one_line);
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Corner Policy Lab · 제출 콘솔</title><style>
:root{color-scheme:dark;--bg:#07110e;--panel:#0d1d18;--line:#234238;--mint:#83e6b8;--lime:#e4ed7b;--text:#f4f8f5;--muted:#a8bbb2;--red:#ff9d8f}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 75% 0,#17392c 0,transparent 34%),var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Noto Sans KR",sans-serif}main{width:min(1040px,calc(100% - 32px));margin:0 auto;padding:52px 0 72px}.eyebrow{color:var(--lime);letter-spacing:.12em;font-size:12px;font-weight:800}h1{font-size:clamp(34px,7vw,72px);line-height:1.02;margin:14px 0 16px;max-width:860px}.lead{color:var(--muted);font-size:18px;line-height:1.65;max-width:780px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:34px}.card{background:linear-gradient(145deg,rgba(16,38,31,.96),rgba(10,25,20,.96));border:1px solid var(--line);border-radius:22px;padding:24px}.wide{grid-column:1/-1}.state{display:inline-flex;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900;letter-spacing:.08em}.ready{background:rgba(131,230,184,.14);color:var(--mint)}.locked{background:rgba(255,157,143,.12);color:var(--red)}h2{font-size:24px;margin:16px 0 8px}.muted{color:var(--muted);line-height:1.55}.hash{display:block;overflow-wrap:anywhere;color:#bcd0c7;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;background:#07110e;border-radius:12px;padding:12px;margin:14px 0}.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border:0;border-radius:12px;padding:0 16px;font-weight:800;text-decoration:none;background:var(--mint);color:#062116;cursor:pointer}.button.secondary{background:#183c30;color:#dff9ec;border:1px solid #2b5a49}.button[disabled]{opacity:.45;cursor:not-allowed}label{display:block;color:var(--muted);font-size:13px;margin:12px 0 6px}input,textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:#07110e;color:var(--text);padding:12px;font:inherit}textarea{min-height:180px;resize:vertical}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.check{display:flex;gap:10px;align-items:flex-start;margin-top:14px;color:var(--muted)}.check input{width:auto;margin-top:4px}.statusline{margin-top:12px;color:var(--lime);font-size:13px}@media(max-width:700px){main{padding-top:30px}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.card{padding:20px}}
</style></head><body><main><div class="eyebrow">외부 제출 전용 콘솔</div><h1>${title}</h1><p class="lead">${oneLine}<br>이 페이지는 제출하지 않습니다. 정확 파일을 열고, 관찰한 외부 확인만 기록하도록 돕습니다.</p>
<div class="grid">
<section class="card"><span class="state ready">기획서 · 준비됨</span><h2>기획서 PDF</h2><p class="muted">독립 검토와 계획 단계 사전 점검을 통과한 8쪽 파일입니다.</p><code class="hash">${escapeHtml(model.planning.sha256)}</code><a class="button" href="../pdf/corner-policy-lab-planning.pdf">정확 PDF 열기</a></section>
<section class="card"><span class="state locked">최종 제출 · 잠김</span><h2>웹·GitHub·YouTube</h2><p class="muted">${escapeHtml(model.final_release.reason)} 현재 59.52초 파일은 화면 검토용 리허설이며 최종 YouTube 업로드 파일이 아닙니다.</p><code class="hash">리허설 ${escapeHtml(model.youtube.local_rehearsal_sha256)}</code><a class="button secondary" href="../policy-lab-demo/corner-policy-lab-60s-narrated.webm">리허설만 확인</a></section>
<section class="card wide"><span class="state locked">제출 정보 · YouTube 필요</span><h2>공개 후 복사할 제출 문구</h2><div class="grid"><div><label for="web">공개 웹서비스 URL</label><input id="web" type="url" value="${escapeHtml(model.public_release.deployed_url)}"><label for="github">공개 GitHub URL</label><input id="github" type="url" value="${escapeHtml(model.public_release.github_url)}"><label for="youtube">공개 YouTube 시청 URL</label><input id="youtube" type="url" placeholder="https://www.youtube.com/watch?v=..."></div><div><label for="description">YouTube 설명</label><textarea id="description" readonly></textarea></div></div><div class="actions"><button class="button secondary" id="copy-description" disabled>YouTube 설명 복사</button><button class="button secondary" id="copy-daker" disabled>DAKER 최종 필드 복사</button></div><div class="statusline" id="metadata-status">최종 영상의 공개 YouTube URL이 있어야 복사가 열립니다.</div></section>
<section class="card wide"><span class="state locked">영수증 · 실제 확인만</span><h2>외부 확인을 대신 만들지 않기</h2><label class="check"><input id="attest" type="checkbox"><span>제가 실제 공개 화면과 DAKER 최종 저장 확인을 직접 관찰한 뒤에만 영수증을 기록하겠습니다.</span></label><p class="muted">에이전트 검토는 사람 참가자 테스트가 아니며, 리허설 파일은 YouTube 공개 증거가 아닙니다.</p></section>
</div></main><script>
const model=${embedded};const fields=["web","github","youtube"].map(id=>document.getElementById(id));const description=document.getElementById("description");const copyDescription=document.getElementById("copy-description");const copyDaker=document.getElementById("copy-daker");const status=document.getElementById("metadata-status");
function isPublicUrl(value){try{const url=new URL(value);return url.protocol==="https:"&&!/^(?:localhost|127\\.|0\\.|10\\.|192\\.168\\.)/.test(url.hostname)}catch{return false}}
function update(){const [web,github,youtube]=fields.map(field=>field.value.trim());description.value=model.youtube.title+"\\n\\n"+model.gallery.one_line+"\\n\\n2018 월드컵 48경기로 관찰 정책을 세우고, 같은 정책을 16강 8경기와 봉인된 8경기에 변경 없이 적용합니다. 전달 위치의 겹침과 선택 밖 반례만 보여 주며, 인과 효과·승률·최적 정책을 주장하지 않습니다.\\n\\n웹서비스: "+(web||"[공개 후 입력]")+"\\nGitHub: "+(github||"[공개 후 입력]")+"\\n데이터: Pappalardo & Massucco Soccer Match Event Dataset, CC BY 4.0";const ready=[web,github,youtube].every(isPublicUrl);copyDescription.disabled=!ready;copyDaker.disabled=!ready;status.textContent=ready?"URL 형식 확인 완료 · 실제 공개 접근성과 바이트 일치는 별도 사전 점검이 필요합니다.":"세 공개 HTTPS URL이 모두 있어야 복사가 열립니다."}
async function copy(text,button){await navigator.clipboard.writeText(text);const original=button.textContent;button.textContent="복사됨";setTimeout(()=>button.textContent=original,1200)}fields.forEach(field=>field.addEventListener("input",update));copyDescription.addEventListener("click",()=>copy(description.value,copyDescription));copyDaker.addEventListener("click",()=>{const [web,github,youtube]=fields.map(field=>field.value.trim());copy(JSON.stringify({title:model.gallery.title,one_line:model.gallery.one_line,web_url:web,github_url:github,youtube_url:youtube,gallery_image:model.gallery.path},null,2),copyDaker)});update();
</script></body></html>`;
}

export async function prepareOwnerConsole() {
  const model = await buildOwnerConsoleModel();
  const outputDirectory = resolve(root, paths.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, "owner-console-manifest.json"), `${JSON.stringify(model, null, 2)}\n`),
    writeFile(resolve(outputDirectory, "index.html"), renderOwnerConsole(model)),
  ]);
  return model;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const model = await prepareOwnerConsole();
  console.log(`[PASS] external owner console: plan=${model.planning.status} final=${model.final_release.status}`);
  console.log(resolve(root, paths.outputDirectory, "index.html"));
}
