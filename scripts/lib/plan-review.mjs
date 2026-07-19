import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  inspectPlanningPdf,
  validatePlanningCandidateBindings,
  validatePlanningScreenshotManifest,
} from "./planning-pdf.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const REVIEW_PACKET_SHA_PLACEHOLDER = "P".repeat(64);

export function findPdfToPpm() {
  const candidates = [
    process.env.PDFTOPPM,
    join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "bin", "override", "pdftoppm"),
    "pdftoppm",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["-v"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }
  throw new Error("pdftoppm unavailable; set PDFTOPPM to a working Poppler renderer");
}

function rendererIdentity(binary) {
  const result = spawnSync(binary, ["-v"], { encoding: "utf8" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const version = /(?:pdftoppm|poppler)[^\d]*(\d+(?:\.\d+)+)/iu.exec(output)?.[1];
  if (!version) throw new Error("could not determine pdftoppm version");
  return `pdftoppm/${version}`;
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function reviewHtml({ artifactPath, pdfSha256, sourceSha256, screenshotManifestSha256, renderer, packetSha256, pages }) {
  const config = JSON.stringify({ artifactPath, pdfSha256, sourceSha256, renderer, packetSha256, pageCount: pages.length });
  const cards = pages.map((page) => `
    <article class="page-card">
      <div class="page-heading"><strong>Page ${page.page}</strong><span>${htmlEscape(page.sha256.slice(0, 16))}…</span></div>
      <a href="${htmlEscape(page.path)}" target="_blank" rel="noreferrer"><img src="${htmlEscape(page.path)}" alt="Planning PDF rendered page ${page.page}"></a>
      <label><input class="page-check" type="checkbox" data-page="${page.page}"> Page ${page.page}: clipping, overlap, broken glyphs, small text/tables, page number, header/footer, and citations inspected — PASS</label>
    </article>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Corner Policy Lab — independent PDF visual review</title>
<style>
:root{color-scheme:dark;--bg:#080b10;--card:#111722;--line:#283244;--text:#f6f7fb;--muted:#9ca9bb;--accent:#ffca46;--danger:#ff8f77;--ok:#62dfa0}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,#172238 0,transparent 35%),var(--bg);color:var(--text);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1120px;margin:auto;padding:44px 22px 100px}h1{font-size:clamp(30px,5vw,58px);line-height:1.03;letter-spacing:-.04em;margin:.2em 0}.eyebrow{color:var(--accent);font-weight:800;letter-spacing:.12em;text-transform:uppercase}.warning,.binding,.finish{border:1px solid var(--line);border-radius:16px;background:rgba(17,23,34,.92);padding:18px 20px;margin:22px 0}.warning{border-color:#66483d;color:#ffd7ce}.binding{display:grid;gap:8px}.binding code{overflow-wrap:anywhere;color:#c8d4e5}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.page-card{border:1px solid var(--line);background:var(--card);border-radius:18px;padding:14px}.page-heading{display:flex;justify-content:space-between;color:var(--muted);padding:2px 4px 12px}.page-card img{display:block;width:100%;height:auto;border-radius:8px;background:white}.page-card label{display:flex;gap:10px;align-items:flex-start;padding:14px 2px 2px;font-weight:650}.page-check{width:20px;height:20px;accent-color:var(--ok);flex:0 0 auto}.finish{position:sticky;bottom:12px;box-shadow:0 18px 60px #000}.finish-grid{display:grid;grid-template-columns:1fr auto;gap:12px}.finish input[type=text]{width:100%;padding:12px;border-radius:9px;border:1px solid var(--line);background:#090d14;color:white}.attest{display:flex;gap:10px;margin:14px 0}.attest input{width:20px;height:20px}.row{min-height:54px;padding:12px;border:1px dashed var(--line);border-radius:9px;color:var(--muted);overflow-wrap:anywhere}.ready{border-color:var(--ok);color:var(--text)}button{padding:11px 16px;border:0;border-radius:9px;background:var(--accent);color:#17130a;font-weight:850;cursor:pointer}button:disabled{opacity:.35;cursor:not-allowed}.status{color:var(--danger);font-weight:700;margin:8px 0}@media(max-width:760px){.grid{grid-template-columns:1fr}.finish{position:static}.finish-grid{grid-template-columns:1fr}}
</style></head><body><main>
<div class="eyebrow">Exact-artifact human gate · not a product study</div><h1>Inspect all 8 rendered pages.<br>Then create one bound ledger row.</h1>
<p>This packet reduces review friction; it does not perform or fabricate independent-human review.</p>
<div class="warning"><strong>Scope boundary:</strong> document visual QA only. This is not participant research, preference or memorability evidence, product usability validation, demo-loop approval, or submission authorization. The artifact creator, Codex, agents, and synthetic personas cannot approve this gate.</div>
<div class="binding"><strong>Artifact binding</strong><code>PDF: ${htmlEscape(artifactPath)}</code><code>PDF SHA-256: ${htmlEscape(pdfSha256)}</code><code>Planning source SHA-256: ${htmlEscape(sourceSha256)}</code><code>Screenshot manifest SHA-256: ${htmlEscape(screenshotManifestSha256)}</code><code>Renderer: ${htmlEscape(renderer)}</code></div>
<section class="grid">${cards}</section>
<section class="finish"><strong>Independent reviewer attestation</strong><p>Use a real 2–64 character, whitespace-free name or handle. Do not use test, agent, Codex, creator, implementer, reviewer, human, QA, or self.</p>
<div class="finish-grid"><input id="reviewer" type="text" autocomplete="name" placeholder="reviewer name or handle"><button id="copy" disabled>Copy exact ledger row</button></div>
<label class="attest"><input id="attest" type="checkbox"> I am an independent human reviewer, not the artifact creator, and I personally inspected the exact rendered artifact above.</label>
<div id="status" class="status">PENDING — inspect 8/8 pages and complete the attestation.</div><div id="row" class="row" aria-live="polite">No PASS row exists until every condition is complete.</div>
<p>After pasting the row into <code>docs/submission-ledger.md</code>, run:<br><code>pnpm submission:preflight -- --phase plan --planning-pdf ${htmlEscape(artifactPath)}</code></p></section>
</main><script>
const config=${config}; const checks=[...document.querySelectorAll('.page-check')]; const reviewer=document.querySelector('#reviewer'); const attest=document.querySelector('#attest'); const copy=document.querySelector('#copy'); const row=document.querySelector('#row'); const status=document.querySelector('#status');
const forbidden=/(?:^|[-_.])(?:test|unknown|agent\\d*|codex\\d*|creator|implementer|self|reviewer|human|qa\\d*)(?:$|[-_.])/i; const validName=()=>/^[^\\s|]{2,64}$/.test(reviewer.value.trim())&&!forbidden.test(reviewer.value.trim());
function kstNow(){const d=new Date(Date.now()+9*60*60*1000);return d.toISOString().slice(0,19)+'+09:00'}
function update(){const done=checks.filter(x=>x.checked).length;const ready=done===config.pageCount&&attest.checked&&validName();copy.disabled=!ready;if(!ready){row.textContent='No PASS row exists until every condition is complete.';row.classList.remove('ready');status.textContent='PENDING — '+done+'/'+config.pageCount+' pages; valid independent reviewer and attestation required.';return}const value='| '+kstNow()+' | plan-visual-qa | '+config.artifactPath+' | pdf='+config.pdfSha256+' source='+config.sourceSha256+' | visual '+config.pageCount+'/'+config.pageCount+' PASS | local | reviewer='+reviewer.value.trim()+' role=independent-human renderer='+config.renderer+' packet='+config.packetSha256+' |';row.textContent=value;row.classList.add('ready');status.textContent='READY — copy this exact row. This still does not authorize submission.'}
checks.forEach(x=>x.addEventListener('change',update));reviewer.addEventListener('input',update);attest.addEventListener('change',update);copy.addEventListener('click',async()=>{try{if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(row.textContent);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy exact ledger row',1400)}catch{const selection=getSelection();const range=document.createRange();range.selectNodeContents(row);selection.removeAllRanges();selection.addRange(range);status.textContent='READY — clipboard access is unavailable; the exact row is selected for manual copy.'}});update();
</script></body></html>`;
}

export async function preparePlanReview({
  pdfPath = "output/pdf/corner-policy-lab-planning.pdf",
  outputRoot = "output/plan-review",
  sourcePath = "docs/planning-outline.md",
  screenshotManifestPath = "docs/assets/policy-lab-planning/manifest.json",
} = {}) {
  const [pdfBytes, sourceBytes, screenshotBytes] = await Promise.all([
    readFile(pdfPath), readFile(sourcePath), readFile(screenshotManifestPath),
  ]);
  const inspection = await inspectPlanningPdf(pdfPath, { render: false });
  const sourceSha256 = sha256(sourceBytes);
  const screenshotManifestSha256 = sha256(screenshotBytes);
  const errors = [...inspection.errors, ...validatePlanningCandidateBindings(inspection.pages, { sourceSha256, screenshotManifestSha256 })];
  errors.push(...await validatePlanningScreenshotManifest(JSON.parse(screenshotBytes.toString("utf8"))));
  if (errors.length) throw new Error(`planning review packet rejected: ${errors.join("; ")}`);

  const pdfSha256 = sha256(pdfBytes);
  if (pdfSha256 !== inspection.pdfSha256) throw new Error("planning PDF changed during review packet preparation");
  const packetDirectory = join(outputRoot, pdfSha256.slice(0, 16));
  const pagesDirectory = join(packetDirectory, "pages");
  await mkdir(pagesDirectory, { recursive: true });
  const rendererBinary = findPdfToPpm();
  const renderer = rendererIdentity(rendererBinary);
  const fontConfig = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "poppler", "poppler", "etc", "fonts", "fonts.conf");
  const fontCacheHome = process.env.PDF_FONT_CACHE_HOME ?? join(process.cwd(), "tmp", "pdfs");
  await mkdir(fontCacheHome, { recursive: true });
  execFileSync(rendererBinary, ["-png", "-r", "120", pdfPath, join(pagesDirectory, "page")], {
    timeout: 60_000,
    env: { ...process.env, FONTCONFIG_FILE: process.env.FONTCONFIG_FILE ?? fontConfig, XDG_CACHE_HOME: fontCacheHome },
  });
  const pages = [];
  for (let page = 1; page <= inspection.pageCount; page += 1) {
    const absolutePath = join(pagesDirectory, `page-${page}.png`);
    const bytes = await readFile(absolutePath);
    if (bytes.length < 1_000) throw new Error(`rendered page ${page} is unexpectedly small`);
    pages.push({ page, path: `pages/page-${page}.png`, sha256: sha256(bytes), bytes: bytes.length });
  }
  const [pdfAfter, sourceAfter, screenshotAfter] = await Promise.all([
    readFile(pdfPath), readFile(sourcePath), readFile(screenshotManifestPath),
  ]);
  if (sha256(pdfAfter) !== pdfSha256 || sha256(sourceAfter) !== sourceSha256 || sha256(screenshotAfter) !== screenshotManifestSha256) {
    throw new Error("PDF, planning source, or screenshot manifest changed during review packet rendering");
  }
  const manifest = {
    schema_version: 1,
    status: "review-packet-not-human-evidence",
    created_at: new Date().toISOString(),
    artifact: { path: pdfPath, filename: basename(pdfPath), sha256: pdfSha256, bytes: pdfBytes.length, pages: inspection.pageCount },
    planning_source: { path: sourcePath, sha256: sourceSha256 },
    screenshot_manifest: { path: screenshotManifestPath, sha256: screenshotManifestSha256 },
    renderer,
    rendered_pages: pages,
  };
  const normalizedHtml = reviewHtml({
    artifactPath: pdfPath,
    pdfSha256,
    sourceSha256,
    screenshotManifestSha256,
    renderer,
    packetSha256: REVIEW_PACKET_SHA_PLACEHOLDER,
    pages,
  });
  const normalizedHtmlBytes = Buffer.from(normalizedHtml);
  manifest.review_html = {
    path: "review.html",
    normalized_sha256: sha256(normalizedHtmlBytes),
    bytes: normalizedHtmlBytes.length,
    normalization: "replace-exact-packet-manifest-sha256-with-64-P-placeholder",
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const packetSha256 = sha256(manifestBytes);
  const html = normalizedHtml.replace(REVIEW_PACKET_SHA_PLACEHOLDER, packetSha256);
  if (html.includes(REVIEW_PACKET_SHA_PLACEHOLDER) || !html.includes(packetSha256) || Buffer.byteLength(html) !== normalizedHtmlBytes.length) {
    throw new Error("review HTML packet binding could not be finalized deterministically");
  }
  await writeFile(join(packetDirectory, "review-manifest.json"), manifestBytes);
  await writeFile(join(packetDirectory, "review.html"), html);
  return { packetDirectory, htmlPath: join(packetDirectory, "review.html"), manifest, packetSha256 };
}

export async function inspectPlanReviewManifest(manifestPath, {
  artifactPath, pdfSha256, sourceSha256, screenshotManifestSha256, pageCount,
} = {}) {
  const errors = [];
  let bytes;
  let manifest;
  try {
    bytes = await readFile(manifestPath);
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    return { errors: [`plan review manifest unreadable: ${error.message}`] };
  }
  if (manifest.schema_version !== 1 || manifest.status !== "review-packet-not-human-evidence") errors.push("plan review manifest identity is invalid");
  if (manifest.artifact?.path !== artifactPath || manifest.artifact?.sha256 !== pdfSha256 || manifest.artifact?.pages !== pageCount) errors.push("plan review manifest PDF binding mismatch");
  if (manifest.planning_source?.sha256 !== sourceSha256) errors.push("plan review manifest source binding mismatch");
  if (screenshotManifestSha256 !== undefined && manifest.screenshot_manifest?.sha256 !== screenshotManifestSha256) errors.push("plan review manifest screenshot binding mismatch");
  if (!/^pdftoppm\/\d+(?:\.\d+)+$/u.test(manifest.renderer ?? "")) errors.push("plan review manifest renderer identity is invalid");
  const packetSha256 = sha256(bytes);
  let canonicalNormalizedHtmlBytes;
  try {
    canonicalNormalizedHtmlBytes = Buffer.from(reviewHtml({
      artifactPath: manifest.artifact?.path,
      pdfSha256: manifest.artifact?.sha256,
      sourceSha256: manifest.planning_source?.sha256,
      screenshotManifestSha256: manifest.screenshot_manifest?.sha256,
      renderer: manifest.renderer,
      packetSha256: REVIEW_PACKET_SHA_PLACEHOLDER,
      pages: manifest.rendered_pages,
    }));
  } catch (error) {
    errors.push(`plan review canonical HTML could not be regenerated: ${error.message}`);
  }
  if (manifest.review_html?.path !== "review.html" ||
      !/^[a-f0-9]{64}$/u.test(manifest.review_html?.normalized_sha256 ?? "") ||
      !Number.isInteger(manifest.review_html?.bytes) || manifest.review_html.bytes < 1_000 ||
      manifest.review_html?.normalization !== "replace-exact-packet-manifest-sha256-with-64-P-placeholder") {
    errors.push("plan review HTML binding is malformed");
  } else {
    if (!canonicalNormalizedHtmlBytes || canonicalNormalizedHtmlBytes.length !== manifest.review_html.bytes ||
        sha256(canonicalNormalizedHtmlBytes) !== manifest.review_html.normalized_sha256) {
      errors.push("plan review HTML canonical contract mismatch");
    }
    try {
      const htmlBytes = await readFile(join(dirname(manifestPath), manifest.review_html.path));
      const html = htmlBytes.toString("utf8");
      const occurrences = html.split(packetSha256).length - 1;
      const normalizedBytes = Buffer.from(html.replace(packetSha256, REVIEW_PACKET_SHA_PLACEHOLDER));
      if (occurrences !== 1) errors.push("plan review HTML does not contain exactly one packet manifest SHA-256 binding");
      if (htmlBytes.length !== manifest.review_html.bytes || normalizedBytes.length !== manifest.review_html.bytes ||
          sha256(normalizedBytes) !== manifest.review_html.normalized_sha256) {
        errors.push("plan review HTML normalized digest mismatch");
      }
      if (canonicalNormalizedHtmlBytes && !normalizedBytes.equals(canonicalNormalizedHtmlBytes)) {
        errors.push("plan review HTML bytes drift from the canonical reviewer gate");
      }
    } catch (error) {
      errors.push(`plan review HTML unreadable: ${error.message}`);
    }
  }
  if (!Array.isArray(manifest.rendered_pages) || manifest.rendered_pages.length !== pageCount) {
    errors.push(`plan review manifest must bind ${pageCount} rendered pages`);
  } else {
    for (let index = 0; index < pageCount; index += 1) {
      const page = manifest.rendered_pages[index];
      const expectedPath = `pages/page-${index + 1}.png`;
      if (page?.page !== index + 1 || page?.path !== expectedPath || !/^[a-f0-9]{64}$/u.test(page?.sha256 ?? "") || !Number.isInteger(page?.bytes)) {
        errors.push(`plan review page ${index + 1} binding is malformed`);
        continue;
      }
      try {
        const pageBytes = await readFile(join(dirname(manifestPath), expectedPath));
        if (pageBytes.length !== page.bytes || sha256(pageBytes) !== page.sha256) errors.push(`plan review page ${index + 1} digest mismatch`);
      } catch (error) {
        errors.push(`plan review page ${index + 1} unreadable: ${error.message}`);
      }
    }
  }
  return { errors, manifest, packetSha256 };
}
