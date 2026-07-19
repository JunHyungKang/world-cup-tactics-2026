import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { eligibilityConstants, isOfficialBoardUrl, parseStrictRfc3339, sha256Text } from "./lib/eligibility.mjs";

const confirmation = "I_CONFIRMED_VISIBLE_POST_MATCHES_CANONICAL_MESSAGE";
const args = new Map();
let apply = false;
const valueFlags = new Set([
  "--root", "--question-url", "--post-id", "--owner", "--posted-at", "--reviewed-at",
  "--capture-path", "--confirm-wording-match",
]);
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (token === "--apply") {
    if (apply) throw new Error("duplicate argument: --apply");
    apply = true;
    continue;
  }
  if (!valueFlags.has(token)) throw new Error(`unknown argument: ${token}`);
  if (args.has(token)) throw new Error(`duplicate argument: ${token}`);
  if (index + 1 >= process.argv.length || process.argv[index + 1].startsWith("--")) throw new Error(`missing value for ${token}`);
  args.set(token, process.argv[index + 1]);
  index += 1;
}
for (const required of [
  "--question-url", "--post-id", "--owner", "--posted-at", "--reviewed-at", "--capture-path", "--confirm-wording-match",
]) if (!args.has(required)) throw new Error(`missing required argument: ${required}`);

const root = resolve(args.get("--root") ?? process.cwd());
const statePath = resolve(root, "docs/data-scope-resolution.json");
const questionDocPath = resolve(root, "docs/organizer-data-scope-question.md");
const messagePath = resolve(root, "docs/organizer-data-scope-message.txt");
const captureInput = resolve(args.get("--capture-path") ?? "");
const questionUrl = args.get("--question-url");
const postIdInput = args.get("--post-id");
const postId = postIdInput === "none" ? null : postIdInput;
const owner = args.get("--owner");
const postedAt = args.get("--posted-at");
const reviewedAt = args.get("--reviewed-at");

const fail = (message) => { throw new Error(message); };
if (!isOfficialBoardUrl(questionUrl)) fail("--question-url must be a specific official DAKER board post URL");
if (postId !== null && postId.trim().length === 0) fail("--post-id must be a non-empty board ID or the literal none");
if (typeof owner !== "string" || owner.trim().length < 2 || /^(?:test|unknown|agent|codex|self)$/iu.test(owner)) fail("--owner must be a real owner identity");
if (args.get("--confirm-wording-match") !== confirmation) fail(`--confirm-wording-match must equal ${confirmation}`);
const postedAtMs = parseStrictRfc3339(postedAt);
const reviewedAtMs = parseStrictRfc3339(reviewedAt);
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/u.test(postedAt ?? "") ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/u.test(reviewedAt ?? "")) {
  fail("--posted-at and --reviewed-at must be RFC3339 KST timestamps ending +09:00");
}
if (!Number.isFinite(postedAtMs) || postedAtMs > Date.now()) fail("--posted-at must be a non-future RFC3339 timestamp");
if (!Number.isFinite(reviewedAtMs) || reviewedAtMs < postedAtMs || reviewedAtMs > Date.now()) fail("--reviewed-at must be a non-future RFC3339 timestamp at or after --posted-at");

const captureStat = await lstat(captureInput);
if (!captureStat.isFile() || captureStat.isSymbolicLink()) fail("--capture-path must be a regular non-symbolic-link file");
const captureBytes = await readFile(captureInput);
if (captureBytes.length === 0) fail("--capture-path must not be empty");
const extension = extname(captureInput).toLowerCase();
if (!new Set([".png", ".jpg", ".jpeg", ".webp", ".html", ".txt", ".pdf"]).has(extension)) fail("--capture-path extension must be png, jpg, jpeg, webp, html, txt, or pdf");

const [stateText, questionDoc, messageBytes] = await Promise.all([
  readFile(statePath, "utf8"), readFile(questionDocPath, "utf8"), readFile(messagePath),
]);
const state = JSON.parse(stateText);
if (state.schema_version !== 3 || state.status !== "unresolved" || state.question_status !== "draft-not-sent" || state.question_evidence !== null) {
  fail("canonical eligibility state is not the unsent schema-v3 transition source");
}
if (!questionDoc.includes("Status: `DRAFT — NOT SENT`")) fail("organizer question document is not DRAFT — NOT SENT");
const normalizedMessage = messageBytes.toString("utf8").replace(/\s+/gu, " ").trim();
for (const marker of [
  eligibilityConstants.requiredQuestionSubject,
  eligibilityConstants.requiredQuestionProposition,
  "A 구성 허용",
  "A 구성 불가 — 핵심 전술 근거도 2026 월드컵 경기 데이터 필수",
]) if (!normalizedMessage.includes(marker)) fail(`canonical message missing marker: ${marker}`);

const captureSha256 = createHash("sha256").update(captureBytes).digest("hex");
const postedQuestionSha256 = createHash("sha256").update(messageBytes).digest("hex");
if (captureSha256 === postedQuestionSha256) fail("owner-observed capture must not be the canonical local message itself");
if (extension === ".txt" || extension === ".html") {
  const normalizedCapture = captureBytes.toString("utf8").replace(/\s+/gu, " ").trim();
  const identityMarker = normalizedCapture.includes(new URL(questionUrl).toString()) || (postId !== null && normalizedCapture.includes(postId));
  if (!identityMarker || !normalizedCapture.includes(eligibilityConstants.requiredQuestionSubject) ||
      !normalizedCapture.includes(eligibilityConstants.requiredQuestionProposition)) {
    fail("text/HTML capture must contain the exact post URL or ID, subject, and A proposition");
  }
}
const captureRelative = `evidence/organizer-question/post-capture${extension}`;
const reviewRelative = "evidence/organizer-question/content-review.json";
const review = {
  schema_version: 1,
  status: "PASS",
  question_url: new URL(questionUrl).toString(),
  post_id: postId,
  owner,
  capture_sha256: captureSha256,
  posted_question_sha256: postedQuestionSha256,
  proposition_sha256: sha256Text(eligibilityConstants.requiredQuestionProposition),
  wording_matches: true,
  reviewed_at: reviewedAt,
};
const reviewBytes = Buffer.from(`${JSON.stringify(review, null, 2)}\n`);
const reviewSha256 = createHash("sha256").update(reviewBytes).digest("hex");
const nextState = {
  ...state,
  question_status: "posted-awaiting-answer",
  question_evidence: {
    question_url: review.question_url,
    post_id: postId,
    owner,
    posted_at: postedAt,
    capture: { path: captureRelative, sha256: captureSha256 },
    posted_question: { path: "docs/organizer-data-scope-message.txt", sha256: postedQuestionSha256 },
    content_review: { path: reviewRelative, sha256: reviewSha256 },
  },
};
const nextQuestionDoc = questionDoc.replace("Status: `DRAFT — NOT SENT`", "Status: `POSTED — AWAITING ANSWER`");
const result = {
  mode: apply ? "applied" : "dry-run",
  question_status: nextState.question_status,
  question_url: review.question_url,
  capture: nextState.question_evidence.capture,
  posted_question: nextState.question_evidence.posted_question,
  content_review: nextState.question_evidence.content_review,
  next: apply
    ? `inspect, then git add ${captureRelative} ${reviewRelative} docs/data-scope-resolution.json docs/organizer-data-scope-question.md and run pnpm eligibility:audit`
    : "rerun with --apply only after inspecting these bindings",
};

if (apply) {
  const evidenceDirectory = resolve(root, "evidence/organizer-question");
  const captureOutput = resolve(root, captureRelative);
  const reviewOutput = resolve(root, reviewRelative);
  let directoryCreated = false;
  try {
    const directoryStat = await lstat(evidenceDirectory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) fail("evidence directory must be a regular directory");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(evidenceDirectory, { recursive: true });
    directoryCreated = true;
  }
  const suffix = randomUUID();
  const lockPath = resolve(evidenceDirectory, ".record.lock");
  const stateTemp = `${statePath}.${suffix}.tmp`;
  const questionTemp = `${questionDocPath}.${suffix}.tmp`;
  const captureTemp = `${captureOutput}.${suffix}.tmp`;
  const reviewTemp = `${reviewOutput}.${suffix}.tmp`;
  const temporaryPaths = [captureTemp, reviewTemp, stateTemp, questionTemp];
  const published = new Set();
  let lockAcquired = false;
  let questionChanged = false;
  let stateChanged = false;
  try {
    await writeFile(lockPath, `${process.pid} ${suffix}\n`, { flag: "wx" });
    lockAcquired = true;
    await writeFile(captureTemp, captureBytes, { flag: "wx" });
    await writeFile(reviewTemp, reviewBytes, { flag: "wx" });
    await writeFile(stateTemp, `${JSON.stringify(nextState, null, 2)}\n`, { flag: "wx" });
    await writeFile(questionTemp, nextQuestionDoc, { flag: "wx" });
    if (process.env.ORGANIZER_RECORDER_TEST_RACE_OUTPUT === "capture") {
      await writeFile(captureOutput, "raced evidence", { flag: "wx" });
    }
    await link(captureTemp, captureOutput);
    published.add(captureOutput);
    await rm(captureTemp);
    await link(reviewTemp, reviewOutput);
    published.add(reviewOutput);
    await rm(reviewTemp);
    if (await readFile(statePath, "utf8") !== stateText || await readFile(questionDocPath, "utf8") !== questionDoc) {
      throw new Error("canonical state or question document changed during recording");
    }
    await rename(questionTemp, questionDocPath);
    questionChanged = true;
    if (process.env.ORGANIZER_RECORDER_TEST_FAIL_AFTER === "question") throw new Error("injected recorder failure after question rename");
    await rename(stateTemp, statePath);
    stateChanged = true;
    if (process.env.ORGANIZER_RECORDER_TEST_FAIL_AFTER === "state") throw new Error("injected recorder failure after state rename");
    await rm(lockPath);
    lockAcquired = false;
  } catch (error) {
    const rollback = await Promise.allSettled([
      ...(stateChanged ? [writeFile(statePath, stateText)] : []),
      ...(questionChanged ? [writeFile(questionDocPath, questionDoc)] : []),
      ...[...published].map((path) => rm(path, { force: true })),
      ...temporaryPaths.map((path) => rm(path, { force: true })),
      ...(lockAcquired ? [rm(lockPath, { force: true })] : []),
    ]);
    const rollbackFailures = rollback.filter(({ status }) => status === "rejected");
    if (directoryCreated) {
      try { await rmdir(evidenceDirectory); } catch (directoryError) {
        if (directoryError.code !== "ENOTEMPTY" && directoryError.code !== "ENOENT") rollbackFailures.push({ status: "rejected", reason: directoryError });
      }
    }
    if (rollbackFailures.length) {
      const details = rollbackFailures.map(({ reason }) => reason?.message ?? String(reason)).join("; ");
      throw new Error(`recording transaction rollback incomplete after '${error.message}': ${details}`);
    }
    throw new Error(`recording transaction rolled back: ${error.message}`);
  }
}

console.log(JSON.stringify(result, null, 2));
