import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildOwnerConsoleModel, prepareOwnerConsole, renderOwnerConsole } from "./prepare-external-owner-console.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixtureCommit = "a".repeat(40);
const fixtureBuildSha256 = "d".repeat(64);
const fixtureMarkerSha256 = "e".repeat(64);
const fixtureDeployedUrl = "https://junhyungkang.github.io/world-cup-tactics-2026/";
let directory;
let fixturePaths;
let expectedPlanSha;
let expectedFinalVideoSha;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "owner-console-test-"));
  fixturePaths = {
    planHandoff: join(directory, "handoff.json"),
    planPdf: join(directory, "plan.pdf"),
    uploadPackage: join(directory, "youtube-upload-package.json"),
    finalVideo: join(directory, "final-demo.webm"),
    finalManifest: join(directory, "final-demo.json"),
    youtubeDescription: join(directory, "youtube-description.txt"),
    youtubeThumbnail: join(directory, "youtube-thumbnail.png"),
    submissionStory: join(directory, "submission-story.json"),
    galleryImage: join(directory, "gallery.png"),
    galleryManifest: join(directory, "gallery-manifest.json"),
    outputDirectory: join(directory, "console"),
  };
  const planBytes = Buffer.from("eight-page-reviewed-plan-fixture");
  const finalVideoBytes = Buffer.from("frozen-public-final-video-fixture");
  const descriptionBytes = Buffer.from("포르투갈 상대 분석 설명 fixture\n");
  const thumbnailBytes = Buffer.from("current-thumbnail-fixture");
  const galleryBytes = Buffer.from("current-gallery-fixture");
  expectedPlanSha = sha256(planBytes);
  expectedFinalVideoSha = sha256(finalVideoBytes);
  const finalManifestBytes = Buffer.from(`${JSON.stringify({
    status: "final-upload-candidate-not-youtube-or-human-reviewed",
    source: {
      release_commit: fixtureCommit,
      build_sha256: fixtureBuildSha256,
      deployed_marker_sha256: fixtureMarkerSha256,
      deployed_url: fixtureDeployedUrl,
    },
    narrated_video: {
      path: fixturePaths.finalVideo,
      sha256: expectedFinalVideoSha,
      bytes: finalVideoBytes.length,
    },
  }, null, 2)}\n`);
  await Promise.all([
    writeFile(fixturePaths.planPdf, planBytes),
    writeFile(fixturePaths.finalVideo, finalVideoBytes),
    writeFile(fixturePaths.finalManifest, finalManifestBytes),
    writeFile(fixturePaths.youtubeDescription, descriptionBytes),
    writeFile(fixturePaths.youtubeThumbnail, thumbnailBytes),
    writeFile(fixturePaths.galleryImage, galleryBytes),
    writeFile(fixturePaths.galleryManifest, `${JSON.stringify({
      output: {
        path: fixturePaths.galleryImage,
        sha256: sha256(galleryBytes),
      },
    }, null, 2)}\n`),
    writeFile(fixturePaths.submissionStory, `${JSON.stringify({
      gallery: {
        title: "Corner Scout Lab — 포르투갈전, 먼저 볼 코너 영상 두 묶음을 고릅니다",
        one_line: "같은 기록 묶음의 선수 기록과 직접 비교·참고 장면을 보고 감독이 먼저 볼 영상 두 묶음을 고릅니다.",
        first_image: fixturePaths.galleryImage,
      },
    }, null, 2)}\n`),
    writeFile(fixturePaths.uploadPackage, `${JSON.stringify({
      status: "PREPARED-AWAITING-OWNER-LISTENING-AND-YOUTUBE-PUBLICATION-APPROVAL",
      release: {
        commit: fixtureCommit,
        build_sha256: fixtureBuildSha256,
        submission_marker_sha256: fixtureMarkerSha256,
        deployed_url: fixtureDeployedUrl,
        github_url: "https://github.com/JunHyungKang/world-cup-tactics-2026",
      },
      video: {
        path: fixturePaths.finalVideo,
        sha256: expectedFinalVideoSha,
        bytes: finalVideoBytes.length,
        duration_seconds: 59.84,
        human_listening_status: "PENDING",
      },
      manifest: {
        path: fixturePaths.finalManifest,
        sha256: sha256(finalManifestBytes),
        bytes: finalManifestBytes.length,
      },
      youtube: {
        title: "Corner Scout Lab | 포르투갈 코너 14개로 우루과이전 검토 질문을 만듭니다",
        description_path: fixturePaths.youtubeDescription,
        description_sha256: sha256(descriptionBytes),
        description_bytes: descriptionBytes.length,
      },
      thumbnail: {
        path: fixturePaths.youtubeThumbnail,
        sha256: sha256(thumbnailBytes),
        bytes: thumbnailBytes.length,
        source_path: "docs/assets/gallery/corner-policy-lab-first-image.png",
        source_sha256: "b".repeat(64),
      },
      claim_boundary: {
        product_scope: "opponent corner-delivery scouting and manager hypothesis stress test",
      },
      approval_boundary: {
        required_phrase: "이 영상으로 YouTube 공개 승인",
        does_not_authorize: [
          "final DAKER submission",
          "claiming human usability or preference evidence",
        ],
      },
    }, null, 2)}\n`),
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
  it("binds the exact reviewed plan and canonical upload package while keeping external actions gated", async () => {
    const model = await buildFixtureModel();

    expect(model.planning).toMatchObject({
      status: "READY",
      sha256: expectedPlanSha,
      pages: 8,
    });
    expect(model.youtube).toMatchObject({
      status: "READY-AWAITING-OWNER-LISTENING",
      final_video_sha256: expectedFinalVideoSha,
      approval_phrase: "이 영상으로 YouTube 공개 승인",
    });
    expect(model.final_release.status).toBe("READY-AWAITING-OWNER-LISTENING");
    expect(model.public_release).toEqual({
      status: "VERIFIED-FINAL-CANDIDATE",
      deployed_url: "https://junhyungkang.github.io/world-cup-tactics-2026/",
      github_url: "https://github.com/JunHyungKang/world-cup-tactics-2026",
      boundary: "웹과 GitHub는 검증됐지만 YouTube 공개와 DAKER 최종 제출은 아직 완료되지 않았습니다",
    });
  });

  it("states the claim and evidence boundaries in the rendered console", async () => {
    const html = renderOwnerConsole(await buildFixtureModel());

    expect(html).toContain("59.84초 영상 재생");
    expect(html).toContain("Corner Scout Lab — 포르투갈전, 먼저 볼 코너 영상 두 묶음");
    expect(html).toContain(expectedFinalVideoSha);
    expect(html).toContain("이 영상으로 YouTube 공개 승인");
    expect(html).toContain("포르투갈 상대 분석 설명 fixture");
    expect(html).toContain("에이전트 검토는 사람 참가자 테스트가 아니며");
    expect(html).toContain('value="https://junhyungkang.github.io/world-cup-tactics-2026/"');
    expect(html).toContain('value="https://github.com/JunHyungKang/world-cup-tactics-2026"');
    expect(html).toContain('host==="youtube.com"');
    expect(html).toContain('host==="youtu.be"');
    expect(html).not.toContain("59.52초");
    expect(html).not.toContain("두 역할을 어디에 둘까요");
    expect(html).not.toContain("리허설만 확인");
    expect(html).not.toContain("READY TO SUBMIT");
  });

  it("fails closed on a stale release or altered canonical video", async () => {
    const packageBytes = await readFile(fixturePaths.uploadPackage);
    const packageJson = JSON.parse(packageBytes);
    try {
      packageJson.release.commit = "c".repeat(40);
      await writeFile(fixturePaths.uploadPackage, `${JSON.stringify(packageJson, null, 2)}\n`);
      await expect(buildFixtureModel()).rejects.toThrow("release commit");
    } finally {
      await writeFile(fixturePaths.uploadPackage, packageBytes);
    }

    const videoBytes = await readFile(fixturePaths.finalVideo);
    try {
      await writeFile(fixturePaths.finalVideo, Buffer.concat([videoBytes, Buffer.from("-drift")]));
      await expect(buildFixtureModel()).rejects.toThrow("pending-listening video");
    } finally {
      await writeFile(fixturePaths.finalVideo, videoBytes);
    }
  });

  it("fails closed on release evidence, approval, manifest, description, or thumbnail drift", async () => {
    const packageBytes = await readFile(fixturePaths.uploadPackage);
    const packageJson = JSON.parse(packageBytes);
    try {
      packageJson.release.build_sha256 = "f".repeat(64);
      await writeFile(fixturePaths.uploadPackage, `${JSON.stringify(packageJson, null, 2)}\n`);
      await expect(buildFixtureModel()).rejects.toThrow("release evidence");
    } finally {
      await writeFile(fixturePaths.uploadPackage, packageBytes);
    }

    try {
      const weakened = JSON.parse(packageBytes);
      weakened.approval_boundary.required_phrase = "업로드 승인";
      await writeFile(fixturePaths.uploadPackage, `${JSON.stringify(weakened, null, 2)}\n`);
      await expect(buildFixtureModel()).rejects.toThrow("approval phrase");
    } finally {
      await writeFile(fixturePaths.uploadPackage, packageBytes);
    }

    for (const [path, expectedError] of [
      [fixturePaths.finalManifest, "video manifest"],
      [fixturePaths.youtubeDescription, "prepared description"],
      [fixturePaths.youtubeThumbnail, "prepared thumbnail"],
      [fixturePaths.galleryImage, "gallery image"],
    ]) {
      const bytes = await readFile(path);
      try {
        await writeFile(path, Buffer.concat([bytes, Buffer.from("\n")]));
        await expect(buildFixtureModel()).rejects.toThrow(expectedError);
      } finally {
        await writeFile(path, bytes);
      }
    }
  });

  it("writes a reviewable local packet without fabricating an external receipt", async () => {
    await prepareOwnerConsole({ artifactPaths: fixturePaths, releaseCommitValue: fixtureCommit });
    const manifest = JSON.parse(await readFile(resolve(fixturePaths.outputDirectory, "owner-console-manifest.json"), "utf8"));

    expect(manifest.status).toBe("owner-console-not-submission-or-confirmation");
    expect(manifest).not.toHaveProperty("youtube_confirmation");
    expect(manifest).not.toHaveProperty("daker_confirmation");
  });
});
