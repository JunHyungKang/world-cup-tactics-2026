import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildOwnerConsoleModel, paths, prepareOwnerConsole, renderOwnerConsole } from "./prepare-external-owner-console.mjs";

describe("external owner console", () => {
  it("binds the exact reviewed plan and local rehearsal while locking final submission", async () => {
    const model = await buildOwnerConsoleModel();

    expect(model.planning).toMatchObject({
      status: "READY",
      sha256: "81e2ae3c74519f86990b203f157302e57b4ea8b3ebd2d68e83374b43a02ab645",
      pages: 8,
    });
    expect(model.youtube).toMatchObject({
      status: "LOCKED",
      local_rehearsal_sha256: "56cfa02434464a2b15c204c44d367295a7f05eee966e08daea772fbe03444ec8",
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
    const html = renderOwnerConsole(await buildOwnerConsoleModel());

    expect(html).toContain("현재 59.52초 파일은 화면 검토용 리허설이며 최종 YouTube 업로드 파일이 아닙니다.");
    expect(html).toContain("인과 효과·승률·최적 정책을 주장하지 않습니다.");
    expect(html).toContain("에이전트 검토는 사람 참가자 테스트가 아니며");
    expect(html).toContain('value="https://junhyungkang.github.io/world-cup-tactics-2026/"');
    expect(html).toContain('value="https://github.com/JunHyungKang/world-cup-tactics-2026"');
    expect(html).not.toContain("READY TO SUBMIT");
  });

  it("writes a reviewable local packet without fabricating an external receipt", async () => {
    await prepareOwnerConsole();
    const manifest = JSON.parse(await readFile(resolve(paths.outputDirectory, "owner-console-manifest.json"), "utf8"));

    expect(manifest.status).toBe("owner-console-not-submission-or-confirmation");
    expect(manifest).not.toHaveProperty("youtube_confirmation");
    expect(manifest).not.toHaveProperty("daker_confirmation");
  });
});
