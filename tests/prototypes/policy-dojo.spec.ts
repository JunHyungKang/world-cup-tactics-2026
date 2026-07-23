import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function chooseLockReveal(page: Page) {
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await page.getByText("한 경기씩 검토하며 정책 바꾸기", { exact: true }).click();
  await page.getByRole("button", { name: "첫 16강 경기만 잠금" }).click();
  await page.getByRole("button", { name: "미공개 16강 경기 공개" }).click();
}

test("uses a fixed group-stage reference before revealing a sealed round-of-16 match", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  await expect(page.getByRole("heading", { name: /조별리그에서 세우고/ })).toBeVisible();
  await expect(page.locator(".stage")).toHaveAttribute("data-partitions-disjoint", "true");
  await expect(page.getByText(/고정 참고 집합: 조별리그 48경기/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal/ })).toHaveCount(0);

  const quickTrial = page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" });
  await expect(quickTrial).toBeDisabled();
  await page.locator('.lane-card[data-lane="short"]').click();
  await expect(quickTrial).toBeDisabled();
  await page.locator('.lane-card[data-lane="near"]').click();
  await expect(quickTrial).toBeDisabled();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await expect(quickTrial).toBeEnabled();
  await page.getByText("한 경기씩 검토하며 정책 바꾸기", { exact: true }).click();
  const lock = page.getByRole("button", { name: "첫 16강 경기만 잠금" });
  await expect(lock).toBeEnabled();
  await lock.click();
  await expect(page.getByText(/결과 공개 전에 잠갔습니다/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal/ })).toHaveCount(0);
  await page.getByRole("button", { name: "미공개 16강 경기 공개" }).click();
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal · 위치 겹침/ })).toBeVisible();
  await expect(page.getByText(/수비 성공률이 아닙니다/)).toBeVisible();
  await page.getByText(/이번 경기 코너 12개 기록표/).click();
  await expect(page.locator(".event-ledger li")).toHaveCount(12);
});

test("records a source-linked ontology contradiction and evaluation receipt", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  await chooseLockReveal(page);
  await page.getByRole("button", { name: "대표 반례 보기" }).click();

  const contradiction = page.getByTestId("counterexample");
  await expect(contradiction).toBeFocused();
  await expect(contradiction.getByText(/CornerRestart RECORDED_ACTION DeliveryAction/)).toBeVisible();
  await expect(contradiction.getByText(/ObservedEvent OBSERVED_OUTCOME OutcomeProxy/)).toBeVisible();
  await expect(contradiction.getByText(/ObservedEvent DERIVED_FROM Source/)).toBeVisible();
  await expect(contradiction.getByText(/금지 관계: WOULD_PREVENT · OPTIMAL_POLICY/)).toBeVisible();
  await contradiction.getByRole("button", { name: "평가 영수증 남기고 다음 미공개 경기" }).click();
  await expect(page.getByText(/정책 리허설 2\/8/)).toBeVisible();
  await expect(page.locator(".round").getByText("16강 평가 영수증 1개")).toBeVisible();
  await page.getByText("16강 평가 영수증 1개").last().click();
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
    await page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" }).click();
    return (await page.getByTestId("lock-receipt").locator(".policy-id").innerText()).trim();
  };
  expect(await fingerprintFor(40)).not.toBe(await fingerprintFor(60));
});

test("lets the manager abstain when support is insufficient", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  await page.getByRole("button", { name: "판단 보류를 두 시험에 적용" }).click();
  await expect(page.getByText(/판단 보류를 결과 공개 전에 선언했습니다/)).toBeVisible();
  await page.getByRole("button", { name: "16강 8경기 평가 요약 공개" }).click();
  await expect(page.getByRole("heading", { name: /판단 보류 검증/ })).toBeVisible();
  await expect(page.getByText("보류", { exact: true })).toBeVisible();
});

test("freezes one final policy before opening all eight quarter-final-and-later matches", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  for (let round = 0; round < 8; round += 1) {
    await chooseLockReveal(page);
    await page.getByRole("button", { name: "대표 반례 보기" }).click();
    await page.getByRole("button", { name: "평가 영수증 남기고 다음 미공개 경기" }).click();
  }
  await expect(page.locator(".stage")).toHaveAttribute("data-stage", "final");
  await expect(page.getByText(/최종 검증 · 8강 이후 8경기/)).toBeVisible();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.locator('.lane-card[data-lane="central-far"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await page.getByRole("button", { name: "최종 정책 잠금 · 봉인 8경기 검증" }).click();
  await expect(page.getByRole("heading", { name: /8강 이후 8경기 · 위치 겹침/ })).toBeVisible();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준");
  await expect(page.getByTestId("final-receipt")).toContainText("16강 평가 영수증 8개를 남긴 뒤");
});

test("uses one immutable policy snapshot across both held-out audits", async ({ page }) => {
  await page.goto("/prototypes/policy-dojo/");
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal/ })).toHaveCount(0);
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" }).click();
  const lockReceipt = page.getByTestId("lock-receipt");
  await expect(lockReceipt).toContainText("아직 어느 결과도 공개하지 않았습니다");
  await expect(lockReceipt).toContainText("사전 위치 겹침 기준 50%도 함께 잠갔습니다");
  const policyId = (await lockReceipt.locator(".policy-id").innerText()).trim();
  await page.getByRole("button", { name: "16강 8경기 평가 요약 공개" }).click();
  await expect(page.locator(".stage")).toHaveAttribute("data-stage", "rehearsal");
  await expect(page.getByRole("heading", { name: /16강 8경기 · 위치 겹침/ })).toBeVisible();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 미달");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 48% · 사전 기준 50%");
  await expect(page.getByText("16강 평가 영수증 8개").first()).toBeVisible();
  await page.getByText("16강 평가 영수증 8개").last().click();
  await expect(page.locator(".history li")).toHaveCount(8);
  await expect(page.locator(".history li").first()).toContainText(policyId);
  await expect(page.locator(".lane-card").first()).toBeDisabled();
  await expect(page.getByTestId("final-receipt")).toHaveCount(0);
  await page.getByRole("button", { name: "같은 정책으로 봉인 검증 8경기 공개" }).click();
  await expect(page.getByTestId("counterexample")).toBeFocused();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 충족");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 51% · 사전 기준 50%");
  await expect(page.getByTestId("final-receipt")).toContainText("정책 변경 0회");
  await expect(page.getByTestId("final-receipt")).toContainText(policyId);
});

test("records a next-meeting decision without changing the sealed policy or results", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/prototypes/policy-dojo/");
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" }).click();
  const policyId = (await page.getByTestId("lock-receipt").locator(".policy-id").innerText()).trim();
  await page.getByRole("button", { name: "16강 8경기 평가 요약 공개" }).click();
  await page.getByRole("button", { name: "같은 정책으로 봉인 검증 8경기 공개" }).click();

  const finalReceiptBefore = (await page.getByTestId("final-receipt").innerText()).trim();
  const resultBefore = (await page.getByRole("heading", { name: /8강 이후 8경기 · 위치 겹침/ }).innerText()).trim();
  const meetingNoteForm = page.locator(".meeting-note");
  const ontologyPath = page.locator(".ontology-path");
  await expect(meetingNoteForm).toBeVisible();
  await expect(ontologyPath).toBeVisible();
  await expect(ontologyPath).not.toHaveAttribute("open");
  expect(await meetingNoteForm.evaluate((element) => Boolean(element.compareDocumentPosition(document.querySelector(".ontology-path")) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.getByLabel("다음 미팅에서 우선 구역 수정").check();
  await page.getByLabel("이유 (120자 이내)").fill("선택 밖 전달이 반복돼 다음 미팅에서 구역 조합을 다시 검토");
  await page.getByRole("button", { name: "다음 미팅 메모 저장" }).click();

  const note = page.getByTestId("meeting-note-receipt");
  await expect(note).toBeFocused();
  await expect(note).toContainText("다음 미팅에서 우선 구역 수정");
  await expect(note).toContainText("다음 미팅에서 구역 조합을 다시 검토");
  await expect(note).toContainText(`봉인 정책 ${policyId} · 정책 변경 0회 · 검증 결과는 그대로입니다.`);
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
  await expect(page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" })).toBeVisible();
  await expect(page.getByRole("button", { name: "판단 보류를 두 시험에 적용" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
