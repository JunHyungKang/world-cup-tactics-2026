import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_YOUTUBE_APPROVAL_PHRASE = "이 영상으로 YouTube 공개 승인";
const REQUIRED_DAKER_NON_AUTHORIZATION = "final DAKER submission";

export const paths = {
  planHandoff: "output/plan-owner-handoff/060376c8beb97afb/handoff-manifest.json",
  planPdf: "output/pdf/corner-policy-lab-planning.pdf",
  uploadPackage: "submissions/youtube-upload-package.json",
  finalVideo: "submissions/final-demo.webm",
  finalManifest: "submissions/final-demo.json",
  youtubeDescription: "submissions/youtube-description.txt",
  youtubeThumbnail: "submissions/youtube-thumbnail.png",
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

export async function buildOwnerConsoleModel({
  artifactPaths = paths,
  releaseCommitValue = releaseCommit(),
} = {}) {
  const [
    uploadPackage, finalManifest, handoff, planSha256, finalVideoSha256, finalManifestSha256,
    youtubeDescriptionSha256, youtubeThumbnailSha256, youtubeDescription,
  ] = await Promise.all([
    loadJson(artifactPaths.uploadPackage),
    loadJson(artifactPaths.finalManifest),
    loadJson(artifactPaths.planHandoff),
    hashFile(artifactPaths.planPdf),
    hashFile(artifactPaths.finalVideo),
    hashFile(artifactPaths.finalManifest),
    hashFile(artifactPaths.youtubeDescription),
    hashFile(artifactPaths.youtubeThumbnail),
    readFile(resolve(root, artifactPaths.youtubeDescription), "utf8"),
  ]);

  if (!handoff.ready_for_owner_upload) throw new Error("canonical planning handoff is not ready");
  if (handoff.artifact.path !== artifactPaths.planPdf || handoff.artifact.sha256 !== planSha256) {
    throw new Error("planning handoff does not bind the exact PDF");
  }
  if (uploadPackage.status !== "PREPARED-AWAITING-OWNER-LISTENING-AND-YOUTUBE-PUBLICATION-APPROVAL") {
    throw new Error("canonical YouTube package is not waiting at the owner approval gate");
  }
  if (uploadPackage.release.commit !== releaseCommitValue) {
    throw new Error("YouTube package release commit does not match the exact local HEAD");
  }
  if (finalManifest.source?.release_commit !== uploadPackage.release.commit ||
      finalManifest.source?.build_sha256 !== uploadPackage.release.build_sha256 ||
      finalManifest.source?.deployed_marker_sha256 !== uploadPackage.release.submission_marker_sha256 ||
      finalManifest.source?.deployed_url !== uploadPackage.release.deployed_url) {
    throw new Error("YouTube package release evidence does not match the exact final video manifest");
  }
  if (uploadPackage.video.path !== artifactPaths.finalVideo ||
      uploadPackage.video.sha256 !== finalVideoSha256 ||
      uploadPackage.video.bytes !== (await readFile(resolve(root, artifactPaths.finalVideo))).length ||
      uploadPackage.video.human_listening_status !== "PENDING" ||
      finalManifest.narrated_video?.path !== artifactPaths.finalVideo ||
      finalManifest.narrated_video?.sha256 !== finalVideoSha256 ||
      finalManifest.narrated_video?.bytes !== uploadPackage.video.bytes) {
    throw new Error("YouTube package does not bind the exact pending-listening video");
  }
  if (uploadPackage.manifest.path !== artifactPaths.finalManifest ||
      uploadPackage.manifest.sha256 !== finalManifestSha256 ||
      uploadPackage.manifest.bytes !== (await readFile(resolve(root, artifactPaths.finalManifest))).length) {
    throw new Error("YouTube package does not bind the exact final video manifest");
  }
  if (uploadPackage.youtube.description_path !== artifactPaths.youtubeDescription ||
      uploadPackage.youtube.description_sha256 !== youtubeDescriptionSha256 ||
      uploadPackage.youtube.description_bytes !== Buffer.byteLength(youtubeDescription)) {
    throw new Error("YouTube package does not bind the exact prepared description");
  }
  if (uploadPackage.thumbnail.path !== artifactPaths.youtubeThumbnail ||
      uploadPackage.thumbnail.sha256 !== youtubeThumbnailSha256 ||
      uploadPackage.thumbnail.bytes !== (await readFile(resolve(root, artifactPaths.youtubeThumbnail))).length) {
    throw new Error("YouTube package does not bind the exact prepared thumbnail");
  }
  if (uploadPackage.approval_boundary?.required_phrase !== REQUIRED_YOUTUBE_APPROVAL_PHRASE ||
      !uploadPackage.approval_boundary?.does_not_authorize?.includes(REQUIRED_DAKER_NON_AUTHORIZATION)) {
    throw new Error("YouTube package weakens the exact approval phrase or separate DAKER gate");
  }

  return {
    schema_version: 1,
    status: "owner-console-not-submission-or-confirmation",
    release_commit: releaseCommitValue,
    upload_package: {
      path: artifactPaths.uploadPackage,
      sha256: await hashFile(artifactPaths.uploadPackage),
      status: uploadPackage.status,
    },
    planning: {
      status: "READY",
      path: artifactPaths.planPdf,
      sha256: planSha256,
      pages: handoff.artifact.pages,
      handoff: artifactPaths.planHandoff,
    },
    final_release: {
      status: "READY-AWAITING-OWNER-LISTENING",
      reason: "공개 릴리스와 영상 패키지는 검증됐습니다. YouTube 공개 전 정확한 60초 음성을 직접 들어야 합니다",
    },
    public_release: {
      status: "VERIFIED-FINAL-CANDIDATE",
      deployed_url: uploadPackage.release.deployed_url,
      github_url: uploadPackage.release.github_url,
      boundary: "웹과 GitHub는 검증됐지만 YouTube 공개와 DAKER 최종 제출은 아직 완료되지 않았습니다",
    },
    youtube: {
      status: "READY-AWAITING-OWNER-LISTENING",
      title: uploadPackage.youtube.title,
      final_video_path: artifactPaths.finalVideo,
      final_video_sha256: finalVideoSha256,
      duration_seconds: uploadPackage.video.duration_seconds,
      description_path: artifactPaths.youtubeDescription,
      description_sha256: youtubeDescriptionSha256,
      description: youtubeDescription,
      thumbnail_path: artifactPaths.youtubeThumbnail,
      thumbnail_sha256: youtubeThumbnailSha256,
      approval_phrase: uploadPackage.approval_boundary.required_phrase,
      boundary: "정확한 영상 전편 청취와 명시적 승인 전에는 YouTube에 공개하지 않습니다",
    },
    gallery: {
      title: "Corner Policy Lab — 포르투갈전, 두 역할을 어디에 둘까요?",
      one_line: "포르투갈 코너 성향을 보고 수비 두 역할을 정한 뒤, 그 선택이 다른 경기에서도 통하는지 시험합니다.",
      path: uploadPackage.thumbnail.source_path,
      sha256: uploadPackage.thumbnail.source_sha256,
    },
    claims: uploadPackage.claim_boundary,
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
<section class="card"><span class="state ready">기획서 · 제출됨</span><h2>기획서 PDF</h2><p class="muted">독립 검토와 계획 단계 사전 점검을 통과한 8쪽 파일입니다.</p><code class="hash">${escapeHtml(model.planning.sha256)}</code><a class="button" href="../pdf/corner-policy-lab-planning.pdf">정확 PDF 열기</a></section>
<section class="card"><span class="state ready">YouTube · 청취 승인 대기</span><h2>정확한 최종 영상</h2><p class="muted">${escapeHtml(model.final_release.reason)} 이 영상 외의 리허설·구형 파일은 업로드하지 않습니다.</p><code class="hash">${escapeHtml(model.youtube.final_video_sha256)}</code><div class="actions"><a class="button" href="../../submissions/final-demo.webm">59.84초 영상 재생</a><a class="button secondary" href="../../submissions/youtube-thumbnail.png">썸네일 확인</a></div><p class="muted">승인 문구: <strong>${escapeHtml(model.youtube.approval_phrase)}</strong></p></section>
<section class="card wide"><span class="state locked">DAKER 최종 제출 · YouTube 필요</span><h2>업로드와 제출 정보</h2><div class="grid"><div><label for="web">공개 웹서비스 URL</label><input id="web" type="url" value="${escapeHtml(model.public_release.deployed_url)}"><label for="github">공개 GitHub URL</label><input id="github" type="url" value="${escapeHtml(model.public_release.github_url)}"><label for="youtube">공개 YouTube 시청 URL</label><input id="youtube" type="url" placeholder="https://www.youtube.com/watch?v=..."></div><div><label for="description">검증된 YouTube 설명</label><textarea id="description" readonly>${escapeHtml(model.youtube.description)}</textarea></div></div><div class="actions"><button class="button secondary" id="copy-description">YouTube 설명 복사</button><button class="button secondary" id="copy-daker" disabled>DAKER 최종 필드 복사</button></div><div class="statusline" id="metadata-status">설명은 지금 복사할 수 있습니다. DAKER 필드는 공개 YouTube URL 검증 후 열립니다.</div></section>
<section class="card wide"><span class="state locked">영수증 · 실제 확인만</span><h2>외부 확인을 대신 만들지 않기</h2><label class="check"><input id="attest" type="checkbox"><span>제가 정확한 영상의 전체 음성을 듣고, 실제 YouTube 공개 화면과 DAKER 최종 저장 확인을 직접 관찰한 뒤에만 영수증을 기록하겠습니다.</span></label><p class="muted">에이전트 검토는 사람 참가자 테스트가 아니며, 로컬 영상은 공개 전까지 YouTube 증거가 아닙니다.</p></section>
</div></main><script>
const model=${embedded};const fields=["web","github","youtube"].map(id=>document.getElementById(id));const description=document.getElementById("description");const copyDescription=document.getElementById("copy-description");const copyDaker=document.getElementById("copy-daker");const status=document.getElementById("metadata-status");
function isPublicUrl(value){try{const url=new URL(value);return url.protocol==="https:"&&!/^(?:localhost|127\\.|0\\.|10\\.|192\\.168\\.)/.test(url.hostname)}catch{return false}}
function isYouTubeWatchUrl(value){try{const url=new URL(value);const host=url.hostname.toLowerCase().replace(/^www\\./,"");return url.protocol==="https:"&&((host==="youtube.com"&&url.pathname==="/watch"&&url.searchParams.has("v"))||(host==="youtu.be"&&/^\\/[A-Za-z0-9_-]+$/.test(url.pathname)))}catch{return false}}
function update(){const [web,github,youtube]=fields.map(field=>field.value.trim());description.value=model.youtube.description;const ready=isPublicUrl(web)&&isPublicUrl(github)&&isYouTubeWatchUrl(youtube);copyDaker.disabled=!ready;status.textContent=ready?"YouTube 시청 URL 형식 확인 완료 · 실제 공개 접근성과 영상 결속은 최종 사전 점검에서 다시 확인합니다.":"설명은 지금 복사할 수 있습니다. DAKER 필드는 공개 YouTube 시청 URL 검증 후 열립니다."}
async function copy(text,button){await navigator.clipboard.writeText(text);const original=button.textContent;button.textContent="복사됨";setTimeout(()=>button.textContent=original,1200)}fields.forEach(field=>field.addEventListener("input",update));copyDescription.addEventListener("click",()=>copy(description.value,copyDescription));copyDaker.addEventListener("click",()=>{const [web,github,youtube]=fields.map(field=>field.value.trim());copy(JSON.stringify({title:model.gallery.title,one_line:model.gallery.one_line,web_url:web,github_url:github,youtube_url:youtube,gallery_image:model.gallery.path},null,2),copyDaker)});update();
</script></body></html>`;
}

export async function prepareOwnerConsole(options = {}) {
  const artifactPaths = options.artifactPaths ?? paths;
  const model = await buildOwnerConsoleModel({ ...options, artifactPaths });
  const outputDirectory = resolve(root, artifactPaths.outputDirectory);
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
