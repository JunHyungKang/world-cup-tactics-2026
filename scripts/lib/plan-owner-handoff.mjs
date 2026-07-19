import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inspectPlanReviewManifest } from "./plan-review.mjs";
import { inspectPlanningPdf, validateAgentVisualReview, validateVisualQaLedger } from "./planning-pdf.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function pageHtml({ artifactPath, pdfSha256, packetSha256, reviewHref, pdfHref, readyForUpload, visualQaErrors }) {
  const config = JSON.stringify({ artifactPath, pdfSha256 });
  const gate = readyForUpload
    ? `<div class="gate pass"><strong>READY FOR OWNER UPLOAD</strong><span>Independent document visual QA is present and bound to this exact PDF, review artifact, and eight-page packet.</span></div>`
    : `<div class="gate pending"><strong>LOCKED — VISUAL QA PENDING</strong><span>${escapeHtml(visualQaErrors.join("; "))}</span></div>`;
  const uploadAction = readyForUpload
    ? `<a class="button" href="${escapeHtml(pdfHref)}">Open exact PDF for upload</a>`
    : `<span class="button disabled" aria-disabled="true">Locked until green preflight</span>`;
  const receipt = readyForUpload ? `<section class="card receipt"><div class="step">04</div><h2>Record only an observed confirmation</h2><p>After the owner uploads the exact PDF and observes DAKER's final-save confirmation, enter a real owner identity and the official ID, URL, or screenshot SHA-256. This page does not submit anything.</p>
  <div class="fields"><label>Owner<input id="owner" type="text" autocomplete="name" placeholder="real owner name or handle"></label><label>Confirmation<input id="confirmation" type="text" placeholder="official ID, HTTPS URL, or screenshot SHA-256"></label></div>
  <label class="attest"><input id="attest" type="checkbox"> I personally observed the official final-save confirmation for this exact PDF.</label>
  <button id="copy" disabled>Copy plan-submitted receipt row</button><div id="status" class="status">Receipt locked until every owner field and attestation is complete.</div><div id="row" class="row">No owner-confirmation row exists yet.</div></section>` : `<section class="card locked"><div class="step">04</div><h2>Receipt remains unavailable</h2><p>Rerun <code>pnpm planning:handoff</code> only after the independent reviewer row has been pasted and plan preflight is green. The receipt generator is intentionally absent in this packet.</p></section>`;
  const script = readyForUpload ? `<script>const config=${config};const owner=document.querySelector('#owner');const confirmation=document.querySelector('#confirmation');const attest=document.querySelector('#attest');const copy=document.querySelector('#copy');const row=document.querySelector('#row');const status=document.querySelector('#status');const forbidden=/^(?:test|unknown|agent\\d*|codex(?:[-_.].*)?|self|reviewer|human|qa(?:[-_.].*)?)$/i;const validOwner=()=>/^[^\\s|]{2,64}$/.test(owner.value.trim())&&!forbidden.test(owner.value.trim());const validConfirmation=()=>/^[^\\s|]{8,}$/.test(confirmation.value.trim());function kstNow(){const d=new Date(Date.now()+9*60*60*1000);return d.toISOString().slice(0,19)+'+09:00'}function update(){const ready=validOwner()&&validConfirmation()&&attest.checked;copy.disabled=!ready;if(!ready){row.textContent='No owner-confirmation row exists yet.';status.textContent='Receipt locked until every owner field and attestation is complete.';return}row.textContent='| '+kstNow()+' | plan-submitted | '+config.artifactPath+' | pdf='+config.pdfSha256+' | owner-confirmation PASS | submitted | owner='+owner.value.trim()+' confirmation='+confirmation.value.trim()+' |';status.textContent='READY TO COPY — this records an observation; it does not submit or verify DAKER state.'}owner.addEventListener('input',update);confirmation.addEventListener('input',update);attest.addEventListener('change',update);copy.addEventListener('click',async()=>{try{if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(row.textContent);copy.textContent='Copied'}catch{const selection=getSelection();const range=document.createRange();range.selectNodeContents(row);selection.removeAllRanges();selection.addRange(range);status.textContent='Clipboard unavailable; the full receipt row is selected for manual copy.'}});update();</script>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Corner Policy Lab — planning owner handoff</title><style>
:root{color-scheme:dark;--bg:#070b10;--card:#111924;--line:#2b3748;--text:#f7f8fb;--muted:#9dabbc;--accent:#f1ef69;--ok:#74dda5;--warn:#ffae73}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 12% 0,#17243c,transparent 34%),var(--bg);color:var(--text);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:960px;margin:auto;padding:46px 22px 100px}.eyebrow{color:var(--accent);font-weight:850;letter-spacing:.11em;text-transform:uppercase}h1{font-size:clamp(34px,6vw,64px);letter-spacing:-.045em;line-height:1.02;margin:.22em 0}.sub{color:var(--muted);max-width:720px}.gate{display:flex;flex-direction:column;gap:4px;margin:28px 0;padding:18px 20px;border:1px solid;border-radius:15px}.gate.pass{border-color:var(--ok);background:#10251d}.gate.pending{border-color:var(--warn);background:#291b13}.gate span{color:var(--muted);overflow-wrap:anywhere}.binding,.card{border:1px solid var(--line);background:rgba(17,25,36,.94);border-radius:18px;padding:22px;margin:18px 0}.binding{display:grid;gap:7px}.binding code,.row{overflow-wrap:anywhere}.step{color:var(--accent);font-weight:900;letter-spacing:.1em}.card h2{margin:.2em 0}.actions{display:flex;gap:10px;flex-wrap:wrap}.button,button{display:inline-block;background:var(--accent);color:#17160c;text-decoration:none;border:0;border-radius:9px;padding:11px 15px;font-weight:850;cursor:pointer}.secondary{background:#243246;color:var(--text)}.button.disabled,button:disabled{opacity:.35;cursor:not-allowed}.command{display:block;padding:12px;background:#090e15;border-radius:9px;overflow-wrap:anywhere}.fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fields label{display:grid;gap:6px}.fields input{padding:12px;border:1px solid var(--line);border-radius:9px;background:#080d14;color:white}.attest{display:flex;gap:10px;margin:16px 0}.attest input{width:20px;height:20px}.status{color:var(--warn);font-weight:750;margin:12px 0}.row{min-height:52px;border:1px dashed var(--line);border-radius:9px;padding:12px;color:var(--muted)}.locked{opacity:.82}@media(max-width:650px){.fields{grid-template-columns:1fr}}
</style></head><body><main><div class="eyebrow">Owner-only external handoff · no automatic submission</div><h1>One file. One green gate.<br>One observed receipt.</h1><p class="sub">Follow the order exactly. Never upload an unreviewed or differently hashed PDF merely to gain an earlier timestamp.</p>${gate}
<div class="binding"><strong>Exact submission artifact</strong><code>Path: ${escapeHtml(artifactPath)}</code><code>PDF SHA-256: ${escapeHtml(pdfSha256)}</code><code>Review packet SHA-256: ${escapeHtml(packetSha256)}</code><span>Planning deadline: 2026-07-27 10:00 KST · owner buffer: 09:00 KST</span></div>
<section class="card"><div class="step">01</div><h2>Independent document review</h2><p>Inspect the complete packet through either a named independent human attestation or a SHA-bound independent subagent review artifact. Neither route is participant, usability, preference, or memorability evidence.</p><div class="actions"><a class="button secondary" href="${escapeHtml(reviewHref)}">Open exact review packet</a></div></section>
<section class="card"><div class="step">02</div><h2>Green preflight before upload</h2><p>Paste the reviewer row into <code>docs/submission-ledger.md</code>, then run:</p><code class="command">pnpm submission:preflight -- --phase plan --planning-pdf ${escapeHtml(artifactPath)}</code><p>Do not continue while any FAIL or PENDING line remains.</p></section>
<section class="card"><div class="step">03</div><h2>Owner uploads only this PDF</h2><p>Continue only after the top gate is green. Compare the filename and SHA-256 immediately before upload, complete DAKER final save, and retain the official confirmation ID, URL, or screenshot hash.</p><div class="actions">${uploadAction}</div></section>${receipt}
<section class="card"><div class="step">05</div><h2>Close the plan evidence loop</h2><p>Paste the receipt row into the ledger and rerun the same plan preflight. A receipt records the external event; it never replaces independent visual QA.</p></section></main>${script}</body></html>`;
}

export async function preparePlanOwnerHandoff({
  pdfPath = "output/pdf/corner-policy-lab-planning.pdf",
  reviewManifestPath,
  ledgerPath = "docs/submission-ledger.md",
  sourcePath = "docs/planning-outline.md",
  outputRoot = "output/plan-owner-handoff",
} = {}) {
  const [pdfInspection, sourceBytes, ledgerBytes] = await Promise.all([
    inspectPlanningPdf(pdfPath, { render: false }), readFile(sourcePath), readFile(ledgerPath),
  ]);
  if (pdfInspection.errors.length) throw new Error(`planning owner handoff rejected: ${pdfInspection.errors.join("; ")}`);
  const sourceSha256 = sha256(sourceBytes);
  const resolvedReviewManifest = reviewManifestPath ?? join("output", "plan-review", pdfInspection.pdfSha256.slice(0, 16), "review-manifest.json");
  const review = await inspectPlanReviewManifest(resolvedReviewManifest, {
    artifactPath: pdfPath, pdfSha256: pdfInspection.pdfSha256, sourceSha256, pageCount: pdfInspection.pageCount,
  });
  if (review.errors.length) throw new Error(`planning owner handoff rejected: ${review.errors.join("; ")}`);
  const agentReviewPath = join("docs", "reviews", `plan-visual-agent-review-${pdfInspection.pdfSha256.slice(0, 16)}.json`);
  let agentReviewSha256;
  let agentReviewErrors = [];
  try {
    const agentReviewBytes = await readFile(agentReviewPath);
    agentReviewSha256 = sha256(agentReviewBytes);
    agentReviewErrors = validateAgentVisualReview(JSON.parse(agentReviewBytes.toString("utf8")), {
      artifactPath: pdfPath,
      pdfSha256: pdfInspection.pdfSha256,
      sourceSha256,
      packetPath: resolvedReviewManifest,
      packetSha256: review.packetSha256,
      renderer: review.manifest?.renderer,
      artifactCreatedAtMs: pdfInspection.modifiedAtMs,
      packetManifest: review.manifest,
    });
  } catch (error) {
    if (error?.code !== "ENOENT") agentReviewErrors = [error.message];
  }
  const visualQaErrors = validateVisualQaLedger(ledgerBytes.toString("utf8"), {
    pdfSha256: pdfInspection.pdfSha256,
    sourceSha256,
    packetSha256: review.packetSha256,
    renderer: review.manifest?.renderer,
    agentReviewSha256,
    pageCount: pdfInspection.pageCount,
    artifactPath: pdfPath,
    artifactCreatedAtMs: pdfInspection.modifiedAtMs,
  });
  visualQaErrors.push(...agentReviewErrors);
  const readyForUpload = visualQaErrors.length === 0;
  const directory = join(outputRoot, pdfInspection.pdfSha256.slice(0, 16));
  await mkdir(directory, { recursive: true });
  const manifest = {
    schema_version: 1,
    status: "owner-handoff-not-submission-or-confirmation",
    created_at: new Date().toISOString(),
    ready_for_owner_upload: readyForUpload,
    artifact: { path: pdfPath, sha256: pdfInspection.pdfSha256, pages: pdfInspection.pageCount },
    review_packet: { path: resolvedReviewManifest, sha256: review.packetSha256 },
    agent_review: agentReviewSha256 ? { path: agentReviewPath, sha256: agentReviewSha256 } : null,
    ledger: { path: ledgerPath, sha256: sha256(ledgerBytes), visual_qa_errors: visualQaErrors },
  };
  const htmlPath = join(directory, "index.html");
  await writeFile(join(directory, "handoff-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(htmlPath, pageHtml({
    artifactPath: pdfPath,
    pdfSha256: pdfInspection.pdfSha256,
    packetSha256: review.packetSha256,
    reviewHref: `../../plan-review/${pdfInspection.pdfSha256.slice(0, 16)}/review.html`,
    pdfHref: "../../pdf/corner-policy-lab-planning.pdf",
    readyForUpload,
    visualQaErrors,
  }));
  return { directory, htmlPath, manifest };
}
