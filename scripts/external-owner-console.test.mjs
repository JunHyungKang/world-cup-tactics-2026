import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildOwnerConsoleModel, prepareOwnerConsole, renderOwnerConsole } from "./prepare-external-owner-console.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixtureCommit = "a".repeat(40);
let directory;
let fixturePaths;
let expectedPlanSha;
let expectedRehearsalSha;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "owner-console-test-"));
  fixturePaths = {
    story: join(directory, "story.json"),
    planHandoff: join(directory, "handoff.json"),
    planPdf: join(directory, "plan.pdf"),
    rehearsalVideo: join(directory, "rehearsal.webm"),
    gallery: join(directory, "gallery.png"),
    outputDirectory: join(directory, "console"),
  };
  const planBytes = Buffer.from("eight-page-reviewed-plan-fixture");
  const rehearsalBytes = Buffer.from("local-rehearsal-fixture");
  expectedPlanSha = sha256(planBytes);
  expectedRehearsalSha = sha256(rehearsalBytes);
  const sourceStory = JSON.parse(await readFile("docs/submission-story.json", "utf8"));
  sourceStory.evidence.narrated_video = {
    path: fixturePaths.rehearsalVideo,
    sha256: expectedRehearsalSha,
  };
  sourceStory.gallery.first_image = fixturePaths.gallery;
  await Promise.all([
    writeFile(fixturePaths.planPdf, planBytes),
    writeFile(fixturePaths.rehearsalVideo, rehearsalBytes),
    writeFile(fixturePaths.gallery, Buffer.from("gallery-fixture")),
    writeFile(fixturePaths.story, `${JSON.stringify(sourceStory, null, 2)}\n`),
    writeFile(fixturePaths.planHandoff, `${JSON.stringify({
      ready_for_owner_upload: true,
      artifact: { path: fixturePaths.planPdf, sha256: expectedPlanSha, pages: 8 },
    }, null, 2)}\n`),
  ]);
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

const buildFixtureModel = () => buildOwnerConsoleModel({
  artifactPaths: fixturePaths,
  releaseCommitValue: fixtureCommit,
});

describe("external owner console", () => {
  it("binds the exact reviewed plan and local rehearsal while locking final submission", async () => {
    const model = await buildFixtureModel();

    expect(model.planning).toMatchObject({
      status: "READY",
      sha256: expectedPlanSha,
      pages: 8,
    });
    expect(model.youtube).toMatchObject({
      status: "LOCKED",
      local_rehearsal_sha256: expectedRehearsalSha,
    });
    expect(model.final_release.status).toBe("LOCKED");
    expect(model.public_release).toEqual({
      status: "CANDIDATE-PUBLIC",
      deployed_url: "https://junhyungkang.github.io/world-cup-tactics-2026/",
      github_url: "https://github.com/JunHyungKang/world-cup-tactics-2026",
      boundary: "현재 후보는 공개됐지만 최종 BG-12와 DAKER 제출 영수증은 아닙니다",
    });
  });

  it("states the claim and evidence boundaries in the rendered console", async () => {
    const html = renderOwnerConsole(await buildFixtureModel());

    expect(html).toContain("현재 59.52초 파일은 화면 검토용 리허설이며 최종 YouTube 업로드 파일이 아닙니다.");
    expect(html).toContain("인과 효과·승률·최적 정책을 주장하지 않습니다.");
    expect(html).toContain("에이전트 검토는 사람 참가자 테스트가 아니며");
    expect(html).toContain('value="https://junhyungkang.github.io/world-cup-tactics-2026/"');
    expect(html).toContain('value="https://github.com/JunHyungKang/world-cup-tactics-2026"');
    expect(html).not.toContain("READY TO SUBMIT");
  });

  it("writes a reviewable local packet without fabricating an external receipt", async () => {
    await prepareOwnerConsole({ artifactPaths: fixturePaths, releaseCommitValue: fixtureCommit });
    const manifest = JSON.parse(await readFile(resolve(fixturePaths.outputDirectory, "owner-console-manifest.json"), "utf8"));

    expect(manifest.status).toBe("owner-console-not-submission-or-confirmation");
    expect(manifest).not.toHaveProperty("youtube_confirmation");
    expect(manifest).not.toHaveProperty("daker_confirmation");
  });
});
