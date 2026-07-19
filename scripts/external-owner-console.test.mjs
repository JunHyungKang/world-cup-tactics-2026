import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildOwnerConsoleModel, paths, prepareOwnerConsole, renderOwnerConsole } from "./prepare-external-owner-console.mjs";

describe("external owner console", () => {
  it("binds the exact reviewed plan and local rehearsal while locking final submission", async () => {
    const model = await buildOwnerConsoleModel();

    expect(model.planning).toMatchObject({
      status: "READY",
      sha256: "2e1c9a477203ccea8f293c78cda36b635042e73195053b837e500ae28c82a71d",
      pages: 8,
    });
    expect(model.youtube).toMatchObject({
      status: "LOCKED",
      local_rehearsal_sha256: "558e8f0b02aab094e2eb366acfa8becf50527f9f5f16ebea96a8fd30e586e22f",
    });
    expect(model.final_release.status).toBe("LOCKED");
  });

  it("states the claim and evidence boundaries in the rendered console", async () => {
    const html = renderOwnerConsole(await buildOwnerConsoleModel());

    expect(html).toContain("현재 59.52초 파일은 화면 검토용 리허설이며 최종 YouTube 업로드 파일이 아닙니다.");
    expect(html).toContain("인과 효과·승률·최적 정책을 주장하지 않습니다.");
    expect(html).toContain("에이전트 검토는 사람 참가자 테스트가 아니며");
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
