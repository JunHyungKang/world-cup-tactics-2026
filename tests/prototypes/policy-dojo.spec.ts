import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function chooseLockReveal(page: Page) {
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await page.getByText("16강 경기를 한 경기씩 확인하기", { exact: true }).click();
  await page.getByRole("button", { name: "첫 경기 선택만 확정" }).click();
  await page.getByRole("button", { name: "이번 16강 경기 결과 보기" }).click();
}

test("uses a fixed group-stage reference before revealing a sealed round-of-16 match", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  await expect(page.getByRole("heading", { name: /코너킥 수비/ })).toBeVisible();
  await expect(page.locator(".stage")).toHaveAttribute("data-partitions-disjoint", "true");
  await expect(page.getByTestId("team-context")).toContainText("포르투갈 조별리그 14개");
  await expect(page.getByTestId("team-context")).toContainText("포르투갈 47% · 대회 전체 53%");
  await expect(page.getByTestId("team-context")).toContainText("우루과이 수비까지 결합 · 채택 안 함");
  await expect(page.getByTestId("team-context")).toContainText("개선 확률 92.3% < 기준 97.5%");
  await expect(page.getByTestId("team-context")).toContainText("우루과이가 조별리그에서 수비한 코너는 5/6");
  await expect(page.getByTestId("forecast-audit")).toContainText("16강 예측 오차 2.14%↓");
  await expect(page.getByTestId("forecast-audit")).toContainText("16팀 중 12팀 개선, 4팀 악화");
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal/ })).toHaveCount(0);

  const quickTrial = page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" });
  await expect(quickTrial).toBeDisabled();
  await page.locator('.lane-card[data-lane="short"]').click();
  await expect(quickTrial).toBeDisabled();
  await page.locator('.lane-card[data-lane="near"]').click();
  await expect(quickTrial).toBeDisabled();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await expect(quickTrial).toBeEnabled();
  await page.getByText("16강 경기를 한 경기씩 확인하기", { exact: true }).click();
  const lock = page.getByRole("button", { name: "첫 경기 선택만 확정" });
  await expect(lock).toBeEnabled();
  await lock.click();
  await expect(page.getByText(/결과 공개 전에 확정했습니다/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal/ })).toHaveCount(0);
  await page.getByRole("button", { name: "이번 16강 경기 결과 보기" }).click();
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal · 선택 구역과 겹침/ })).toBeVisible();
  await expect(page.getByText(/수비 성공률이 아닙니다/)).toBeVisible();
  await page.getByText(/이번 경기 코너 12개 기록표/).click();
  await expect(page.locator(".event-ledger li")).toHaveCount(12);
});

test("records a source-linked ontology contradiction and evaluation receipt", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  await chooseLockReveal(page);
  await page.getByRole("button", { name: "선택 밖 코너 기록 보기" }).click();

  const contradiction = page.getByTestId("counterexample");
  await expect(contradiction).toBeFocused();
  await expect(contradiction.getByText("선택 밖 코너 기록")).toBeVisible();
  await expect(contradiction).toContainText("이 선택이 수비에 성공했는지, 경기 결과를 바꿨는지는 판단하지 않습니다.");
  const provenance = contradiction.getByText("이 기록의 출처와 판단 범위 보기");
  await expect(provenance).toBeVisible();
  await expect(contradiction.getByText(/코너킥 → 실제 전달 위치/)).not.toBeVisible();
  await provenance.click();
  await expect(contradiction.getByText(/코너킥 → 실제 전달 위치/)).toBeVisible();
  await expect(contradiction.getByText(/자료 출처 → Pappalardo Wyscout World Cup 2018/)).toBeVisible();
  await expect(contradiction.getByText(/이 기록으로 말할 수 없음/)).toBeVisible();
  await contradiction.getByRole("button", { name: "확인 기록을 남기고 다음 경기 보기" }).click();
  await expect(page.getByText(/16강 경기 2\/8 확인/)).toBeVisible();
  await expect(page.locator(".round").getByText("16강 확인 기록 1개")).toBeVisible();
  await page.getByText("16강 확인 기록 1개").last().click();
  await expect(page.locator(".history li")).toHaveCount(1);
  await expect(page.locator(".history")).toContainText("Uruguay - Portugal");
  await expect(page.locator(".history")).toContainText("숏 코너 + 니어포스트");
});

test("lets the desktop manager place a token directly on the pitch", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/prototypes/policy-dojo/");
  const zone = page.getByRole("button", { name: "중앙·파포스트에 주의 토큰 배치" });
  await zone.click();
  await expect(zone).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.lane-card[data-lane="central-far"]')).toHaveAttribute("aria-pressed", "true");
});

test("keeps keyboard focus on the selected zone without announcing the whole app", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  const zone = page.getByRole("button", { name: "숏 코너에 주의 토큰 배치" });
  await zone.focus();
  await page.keyboard.press("Enter");
  await expect(zone).toBeFocused();
  await expect(zone).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("selection-count")).toHaveText("1/2");
  await expect(page.locator("#app")).not.toHaveAttribute("aria-live");
});

test("binds the predeclared overlap criterion into the immutable fingerprint", async ({ page }) => {
  const fingerprintFor = async (criterion: 40 | 60) => {
    await page.goto("/prototypes/policy-dojo/");
    await page.locator('.lane-card[data-lane="short"]').click();
    await page.locator('.lane-card[data-lane="near"]').click();
    await page.getByRole("button", { name: `최소 위치 겹침률 ${criterion}% 선택` }).click();
    await page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" }).click();
    return (await page.getByTestId("lock-receipt").locator(".policy-id").innerText()).trim();
  };
  expect(await fingerprintFor(40)).not.toBe(await fingerprintFor(60));
});

test("binds the ordered role assignment into the immutable fingerprint", async ({ page }) => {
  const fingerprintFor = async (first: "short" | "central-far", second: "short" | "central-far") => {
    await page.goto("/prototypes/policy-dojo/");
    await page.locator(`.lane-card[data-lane="${first}"]`).click();
    await page.locator(`.lane-card[data-lane="${second}"]`).click();
    await page.getByRole("button", { name: "최소 위치 겹침률 60% 선택" }).click();
    await page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" }).click();
    const receipt = page.getByTestId("lock-receipt");
    return {
      fingerprint: (await receipt.locator(".policy-id").innerText()).trim(),
      text: await receipt.innerText(),
    };
  };

  const leaderShort = await fingerprintFor("short", "central-far");
  const leaderCentral = await fingerprintFor("central-far", "short");
  expect(leaderShort.text).toContain("숏 코너 + 중앙·파포스트");
  expect(leaderCentral.text).toContain("중앙·파포스트 + 숏 코너");
  expect(leaderShort.fingerprint).not.toBe(leaderCentral.fingerprint);
});

test("lets the manager abstain when support is insufficient", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  await page.getByRole("button", { name: "선택을 보류하고 16경기 확인" }).click();
  await expect(page.getByText(/판단 보류를 결과 공개 전에 선언했습니다/)).toBeVisible();
  await page.getByRole("button", { name: "16강 8경기 결과 보기" }).click();
  await expect(page.getByRole("heading", { name: /판단 보류 결과/ })).toBeVisible();
  await expect(page.getByText("보류", { exact: true })).toBeVisible();
  await expect(page.getByText(/사전 기준 0%/)).toHaveCount(0);
  await page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }).click();
  await expect(page.getByTestId("final-receipt")).toContainText("판단 보류 · 선택 변경 0회");
  await expect(page.getByTestId("final-receipt")).not.toContainText("0%");
});

test("freezes one final policy before opening all eight quarter-final-and-later matches", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  for (let round = 0; round < 8; round += 1) {
    await chooseLockReveal(page);
    await page.getByRole("button", { name: "선택 밖 코너 기록 보기" }).click();
    await page.getByRole("button", { name: "확인 기록을 남기고 다음 경기 보기" }).click();
  }
  await expect(page.locator(".stage")).toHaveAttribute("data-stage", "final");
  await expect(page.getByText(/마지막 확인 · 8강 이후 8경기/)).toBeVisible();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.locator('.lane-card[data-lane="central-far"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await page.getByRole("button", { name: "이 선택을 확정하고 마지막 8경기 확인" }).click();
  await expect(page.getByRole("heading", { name: /8강 이후 8경기 · 선택 구역과 겹침/ })).toBeVisible();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준");
  await expect(page.getByTestId("final-receipt")).toContainText("16강 확인 기록 8개를 남긴 뒤");
});

test("uses one immutable policy snapshot across both held-out audits", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal/ })).toHaveCount(0);
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" }).click();
  const lockReceipt = page.getByTestId("lock-receipt");
  await expect(lockReceipt).toContainText("아직 어느 결과도 공개하지 않았습니다");
  await expect(lockReceipt).toContainText("통과 기준 50%도 함께 확정했습니다");
  const policyId = (await lockReceipt.locator(".policy-id").innerText()).trim();
  await page.getByRole("button", { name: "16강 8경기 결과 보기" }).click();
  await expect(page.locator(".stage")).toHaveAttribute("data-stage", "rehearsal");
  await expect(page.getByRole("heading", { name: /16강 8경기 · 선택 구역과 겹침/ })).toBeVisible();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 미달");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 48% · 사전 기준 50%");
  await expect(page.getByText("16강 확인 기록 8개").first()).toBeVisible();
  await page.getByText("16강 확인 기록 8개").last().click();
  await expect(page.locator(".history li")).toHaveCount(8);
  await expect(page.locator(".history li").first()).toContainText(policyId);
  await expect(page.locator(".lane-card").first()).toBeDisabled();
  await expect(page.getByTestId("final-receipt")).toHaveCount(0);
  await page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }).click();
  await expect(page.getByTestId("counterexample")).toBeFocused();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 충족");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 51% · 사전 기준 50%");
  await expect(page.getByTestId("final-receipt")).toContainText("선택 변경 0회");
  await expect(page.getByTestId("final-receipt")).toContainText(policyId);
});

test("shows the Portugal match before using the tournament as a generalization stress test", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  await expect(page.getByTestId("opponent-result")).toHaveCount(0);
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="central-far"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 60% 선택" }).click();
  await page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" }).click();
  await page.getByRole("button", { name: "16강 8경기 결과 보기" }).click();

  const opponent = page.getByTestId("opponent-result");
  await expect(opponent).toContainText("포르투갈의 실제 코너 전달 10개");
  await expect(opponent).toContainText("감독이 고른 구역으로 9/10개가 왔습니다");
  await expect(opponent).toContainText("숏 코너5개");
  await expect(opponent).toContainText("니어포스트1개");
  await expect(opponent).toContainText("중앙·파포스트4개");
  await expect(opponent).toContainText("한 경기 기록만으로 선택이 옳았다고 판정하지 않습니다");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 63% · 사전 기준 60%");

  await page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }).click();
  await expect(page.getByTestId("opponent-result")).toHaveCount(0);
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 55% · 사전 기준 60%");
});

test("records a next-meeting decision without changing the sealed policy or results", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/prototypes/policy-dojo/");
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" }).click();
  const policyId = (await page.getByTestId("lock-receipt").locator(".policy-id").innerText()).trim();
  await page.getByRole("button", { name: "16강 8경기 결과 보기" }).click();
  await page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }).click();

  const finalReceiptBefore = (await page.getByTestId("final-receipt").innerText()).trim();
  const resultBefore = (await page.getByRole("heading", { name: /8강 이후 8경기 · 선택 구역과 겹침/ }).innerText()).trim();
  const meetingNoteForm = page.locator(".meeting-note");
  const ontologyPath = page.locator(".ontology-path");
  await expect(meetingNoteForm).toBeVisible();
  await expect(ontologyPath).toBeVisible();
  await expect(ontologyPath).not.toHaveAttribute("open");
  expect(await meetingNoteForm.evaluate((element) => Boolean(element.compareDocumentPosition(document.querySelector(".ontology-path")) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.getByLabel("다음 회의에서 우선 구역 수정").check();
  await page.getByLabel("이유 (120자 이내)").fill("선택 밖 전달이 반복돼 다음 회의에서 구역 조합을 다시 검토");
  await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();

  const note = page.getByTestId("meeting-note-receipt");
  await expect(note).toBeFocused();
  await expect(note).toContainText("다음 회의에서 우선 구역 수정");
  await expect(note).toContainText("다음 회의에서 구역 조합을 다시 검토");
  await expect(note).toContainText(`처음 확정한 선택 ${policyId} · 선택 변경 0회 · 확인 결과는 그대로입니다.`);
  expect((await page.getByTestId("final-receipt").innerText()).trim()).toBe(finalReceiptBefore);
  await expect(page.getByRole("heading", { name: resultBefore, exact: true })).toBeVisible();
  await expect(page.locator(".lane-card").first()).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("keeps the first policy decision operable and accessible at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/prototypes/policy-dojo/");
  const pitch = page.locator(".pitch");
  await expect(pitch).toBeVisible();
  const pitchBox = await pitch.boundingBox();
  expect(pitchBox).not.toBeNull();
  expect(pitchBox!.height).toBeGreaterThanOrEqual(130);
  const mobileZone = page.getByRole("button", { name: "숏 코너에 주의 토큰 배치" });
  await mobileZone.click();
  await expect(mobileZone).toBeFocused();
  await expect(mobileZone).toHaveAttribute("aria-pressed", "true");
  const threshold = page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" });
  await threshold.click();
  await expect(threshold).toBeFocused();
  await expect(threshold).toHaveAttribute("aria-pressed", "true");
  for (const lane of ["short", "near", "central-far", "other"]) {
    const box = await page.locator(`.lane-card[data-lane="${lane}"]`).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" })).toBeVisible();
  await expect(page.getByRole("button", { name: "선택을 보류하고 16경기 확인" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
