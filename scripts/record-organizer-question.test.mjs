import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateEligibilityArtifacts, validateEligibilityState } from "./lib/eligibility.mjs";

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

function kstTimestamp(ms) {
  return new Date(Math.floor(ms / 1000) * 1000 + (9 * 60 * 60 * 1000)).toISOString().replace(".000Z", "+09:00");
}

describe("organizer question receipt recorder", () => {
  it("defaults to dry-run, then emits a validator-compatible three-artifact chain only with --apply", async () => {
    const root = await mkdtemp(join(tmpdir(), "organizer-question-recorder-"));
    roots.push(root);
    await mkdir(join(root, "docs"));
    const [stateText, questionDoc, message, productThesis, planningSource, manifestText, productSelectionText] = await Promise.all([
      readFile("docs/data-scope-resolution.json", "utf8"),
      readFile("docs/organizer-data-scope-question.md", "utf8"),
      readFile("docs/organizer-data-scope-message.txt"),
      readFile("docs/product-thesis.md", "utf8"),
      readFile("docs/planning-outline.md", "utf8"),
      readFile("data/source-manifest.json", "utf8"),
      readFile("docs/product-selection.json", "utf8"),
    ]);
    const unresolvedState = {
      ...JSON.parse(stateText),
      status: "unresolved",
      route: null,
      question_status: "draft-not-sent",
      question_evidence: null,
      answer_evidence: null,
      scope_evidence: null,
      evidence_source_ids: [],
      binding: null,
    };
    const unresolvedQuestionDoc = questionDoc.replace("Status: `WITHDRAWN — NOT NEEDED`", "Status: `DRAFT — NOT SENT`");
    const unresolvedThesis = productThesis
      .replace("Product data scope: `official-open-historical-tactics`", "Product data scope: `unresolved-hybrid`")
      .replace("Product selection status: `PASS`", "Product selection status: `REVISE — conditional selection`");
    const unresolvedPlanning = planningSource.replace(
      "Product data scope: `official-open-historical-tactics`",
      "Product data scope: `unresolved-hybrid`",
    );
    const unresolvedSelection = {
      ...JSON.parse(productSelectionText),
      status: "conditional",
      data_scope: "unresolved-hybrid",
      source_ids: [],
      core_tactical_source_ids: [],
      data_files: [],
    };
    await Promise.all([
      writeFile(join(root, "docs/data-scope-resolution.json"), JSON.stringify(unresolvedState)),
      writeFile(join(root, "docs/organizer-data-scope-question.md"), unresolvedQuestionDoc),
      writeFile(join(root, "docs/organizer-data-scope-message.txt"), message),
      writeFile(join(root, "capture.png"), Buffer.from("owner-observed screenshot bytes")),
    ]);
    const referenceNow = Date.now();
    const baseArgs = [
      "scripts/record-organizer-question.mjs", "--root", root,
      "--question-url", "https://daker.ai/community/world-cup-data-scope-789",
      "--post-id", "world-cup-data-scope-789", "--owner", "jhkang",
      "--posted-at", kstTimestamp(referenceNow - 120_000),
      "--reviewed-at", kstTimestamp(referenceNow - 60_000),
      "--capture-path", join(root, "capture.png"),
      "--confirm-wording-match", "I_CONFIRMED_VISIBLE_POST_MATCHES_CANONICAL_MESSAGE",
    ];
    const genericUrlArgs = [...baseArgs];
    genericUrlArgs[genericUrlArgs.indexOf("--question-url") + 1] = "https://daker.ai/community";
    const genericUrl = spawnSync(process.execPath, [...genericUrlArgs, "--apply"], { cwd: process.cwd(), encoding: "utf8" });
    expect(genericUrl.status).toBe(1);
    expect(genericUrl.stderr).toContain("specific official DAKER board post URL");
    const missingConfirmationArgs = baseArgs.slice(0, -2);
    const missingConfirmation = spawnSync(process.execPath, [...missingConfirmationArgs, "--apply"], { cwd: process.cwd(), encoding: "utf8" });
    expect(missingConfirmation.status).toBe(1);
    expect(missingConfirmation.stderr).toContain("missing required argument: --confirm-wording-match");
    const wrongConfirmationArgs = [...baseArgs];
    wrongConfirmationArgs[wrongConfirmationArgs.indexOf("--confirm-wording-match") + 1] = "yes";
    const wrongConfirmation = spawnSync(process.execPath, wrongConfirmationArgs, { cwd: process.cwd(), encoding: "utf8" });
    expect(wrongConfirmation.status).toBe(1);
    expect(wrongConfirmation.stderr).toContain("--confirm-wording-match must equal");
    const missingPostIdArgs = [...baseArgs];
    missingPostIdArgs.splice(missingPostIdArgs.indexOf("--post-id"), 2);
    const missingPostId = spawnSync(process.execPath, missingPostIdArgs, { cwd: process.cwd(), encoding: "utf8" });
    expect(missingPostId.status).toBe(1);
    expect(missingPostId.stderr).toContain("missing required argument: --post-id");
    const unknownFlag = spawnSync(process.execPath, [...baseArgs, "--postid", "typo"], { cwd: process.cwd(), encoding: "utf8" });
    expect(unknownFlag.status).toBe(1);
    expect(unknownFlag.stderr).toContain("unknown argument: --postid");
    const utcArgs = [...baseArgs];
    utcArgs[utcArgs.indexOf("--posted-at") + 1] = new Date(referenceNow - 120_000).toISOString().replace(".000Z", "Z");
    const utcTime = spawnSync(process.execPath, utcArgs, { cwd: process.cwd(), encoding: "utf8" });
    expect(utcTime.status).toBe(1);
    expect(utcTime.stderr).toContain("RFC3339 KST timestamps ending +09:00");
    const localMessageCaptureArgs = [...baseArgs];
    localMessageCaptureArgs[localMessageCaptureArgs.indexOf("--capture-path") + 1] = join(root, "docs/organizer-data-scope-message.txt");
    const localMessageCapture = spawnSync(process.execPath, localMessageCaptureArgs, { cwd: process.cwd(), encoding: "utf8" });
    expect(localMessageCapture.status).toBe(1);
    expect(localMessageCapture.stderr).toContain("must not be the canonical local message itself");
    const dryRun = spawnSync(process.execPath, baseArgs, { cwd: process.cwd(), encoding: "utf8" });
    expect(dryRun.status, dryRun.stderr).toBe(0);
    expect(JSON.parse(dryRun.stdout).mode).toBe("dry-run");
    expect(JSON.parse(await readFile(join(root, "docs/data-scope-resolution.json"), "utf8")).question_status).toBe("draft-not-sent");
    expect(await readFile(join(root, "docs/organizer-data-scope-question.md"), "utf8")).toContain("Status: `DRAFT — NOT SENT`");
    await expect(access(join(root, "evidence/organizer-question/post-capture.png"))).rejects.toThrow();
    await expect(access(join(root, "evidence/organizer-question/content-review.json"))).rejects.toThrow();

    await mkdir(join(root, "evidence/organizer-question"), { recursive: true });
    await writeFile(join(root, "evidence/organizer-question/.record.lock"), "other recorder owns this lock\n");
    const lockContended = spawnSync(process.execPath, [...baseArgs, "--apply"], { cwd: process.cwd(), encoding: "utf8" });
    expect(lockContended.status).toBe(1);
    expect(await readFile(join(root, "evidence/organizer-question/.record.lock"), "utf8")).toBe("other recorder owns this lock\n");
    expect(JSON.parse(await readFile(join(root, "docs/data-scope-resolution.json"), "utf8")).question_status).toBe("draft-not-sent");
    await rm(join(root, "evidence/organizer-question"), { recursive: true });

    const rolledBack = spawnSync(process.execPath, [...baseArgs, "--apply"], {
      cwd: process.cwd(), encoding: "utf8", env: { ...process.env, ORGANIZER_RECORDER_TEST_FAIL_AFTER: "state" },
    });
    expect(rolledBack.status).toBe(1);
    expect(rolledBack.stderr).toContain("recording transaction rolled back");
    expect(JSON.parse(await readFile(join(root, "docs/data-scope-resolution.json"), "utf8")).question_status).toBe("draft-not-sent");
    expect(await readFile(join(root, "docs/organizer-data-scope-question.md"), "utf8")).toContain("Status: `DRAFT — NOT SENT`");
    await expect(access(join(root, "evidence/organizer-question/post-capture.png"))).rejects.toThrow();
    await expect(access(join(root, "evidence/organizer-question/content-review.json"))).rejects.toThrow();
    await expect(access(join(root, "evidence/organizer-question"))).rejects.toThrow();

    const raced = spawnSync(process.execPath, [...baseArgs, "--apply"], {
      cwd: process.cwd(), encoding: "utf8", env: { ...process.env, ORGANIZER_RECORDER_TEST_RACE_OUTPUT: "capture" },
    });
    expect(raced.status).toBe(1);
    expect(raced.stderr).toContain("recording transaction rolled back");
    expect(await readFile(join(root, "evidence/organizer-question/post-capture.png"), "utf8")).toBe("raced evidence");
    await expect(access(join(root, "evidence/organizer-question/content-review.json"))).rejects.toThrow();
    expect(JSON.parse(await readFile(join(root, "docs/data-scope-resolution.json"), "utf8")).question_status).toBe("draft-not-sent");
    await rm(join(root, "evidence/organizer-question"), { recursive: true });

    const applied = spawnSync(process.execPath, [...baseArgs, "--apply"], { cwd: process.cwd(), encoding: "utf8" });
    expect(applied.status, applied.stderr).toBe(0);
    expect(JSON.parse(applied.stdout).mode).toBe("applied");
    const state = JSON.parse(await readFile(join(root, "docs/data-scope-resolution.json"), "utf8"));
    const postedQuestion = await readFile(join(root, state.question_evidence.posted_question.path));
    expect(state.question_status).toBe("posted-awaiting-answer");
    expect(state.question_evidence.posted_question.sha256).toBe(createHash("sha256").update(postedQuestion).digest("hex"));
    expect(await readFile(join(root, "docs/organizer-data-scope-question.md"), "utf8")).toContain("Status: `POSTED — AWAITING ANSWER`");

    const input = {
      state,
      officialState: `Verified: \`${kstTimestamp(referenceNow - 180_000)}\` against:\nhttps://daker.ai/public/hackathons/world-cup-manager-tactics-web-challenge\n2026 FIFA 월드컵 데이터를 활용`,
      organizerQuestion: await readFile(join(root, "docs/organizer-data-scope-question.md"), "utf8"),
      productThesis: unresolvedThesis,
      planningSource: unresolvedPlanning,
      manifest: JSON.parse(manifestText),
      productSelection: unresolvedSelection,
      now: new Date(referenceNow + 1_000),
    };
    expect(validateEligibilityState(input)).toEqual([]);
    expect(await validateEligibilityArtifacts({ ...input, root })).toEqual([]);
  }, 30_000);
});
