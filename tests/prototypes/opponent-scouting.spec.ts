import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("starts with separate named-team records and no hidden matchup result", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  await expect(page.getByRole("heading", { name: /포르투갈 코너 상황 3유형/ })).toBeVisible();
  const attackSummary = page.locator(".quick-evidence article").filter({ hasText: "포르투갈 공격 기록" });
  const defenseSummary = page.locator(".quick-evidence article").filter({ hasText: "우루과이 수비 상황" });
  await expect(attackSummary).toContainText("14/14");
  await expect(defenseSummary).toContainText("5/6");
  const shortSituation = page.locator('[data-routine-card="short-recorded-endpoint"]');
  await expect(shortSituation).toContainText("포르투갈 공격");
  await expect(shortSituation).toContainText("7회");
  await expect(shortSituation).toContainText("우루과이 수비 상황");
  await shortSituation.getByText("선수·첫 후속 기록 근거").click();
  await expect(shortSituation).toContainText("포르투갈 7회 · 상대팀 0회");
  await expect(shortSituation).toContainText("10초 안 포르투갈 슈팅 기록");
  await expect(shortSituation).toContainText("1/7회");
  await expect(shortSituation).toContainText("상대팀 2회 · 우루과이 0회");
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await expect(page.getByText(/두 팀의 기록을 하나의 성공률로 합치지 않습니다/)).toBeVisible();
  await expect(page.getByText(/훈련 효과, 수비 성공, 실점 방지, 최적 전술은 판단하지 않습니다/)).toBeVisible();
});

test("puts the first allocation control near the top on a mobile viewport and keeps the commit bar sticky", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/prototypes/opponent-scouting/");
  const firstAdd = page.getByRole("button", { name: "숏 구역 전달 훈련 1회 추가" });
  await expect(firstAdd).toBeVisible();
  const box = await firstAdd.boundingBox();
  expect(box?.y).toBeLessThan(844);
  await expect(page.getByText("왜 이렇게 나누나요? 팀 기록과 기획 변경 보기")).toBeVisible();
  await expect(page.locator(".commit")).toHaveCSS("position", "sticky");
});

test("locks the group-stage-proportional 5-4-1 rehearsal before revealing held-out records", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  const lock = page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" });
  await expect(lock).toBeDisabled();
  for (let count = 0; count < 5; count += 1) {
    await page.getByRole("button", { name: "숏 구역 전달 훈련 1회 추가" }).click();
  }
  for (let count = 0; count < 4; count += 1) {
    await page.getByRole("button", { name: "비숏 · 공중 후속 기록 훈련 1회 추가" }).click();
  }
  for (let count = 0; count < 1; count += 1) {
    await page.getByRole("button", { name: "비숏 · 기타 후속 기록 훈련 1회 추가" }).click();
  }
  await expect(lock).toBeEnabled();
  await expect(lock).toBeFocused();
  await expect(page.getByTestId("allocation-summary")).toContainText("10회 배분 · 0회 남음");
  await lock.click();
  await expect(page.getByRole("button", { name: "숏 구역 전달 훈련 1회 추가" })).toBeDisabled();
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await page.getByRole("button", { name: "가려 둔 맞대결 첫 전개 보기" }).click();
  const result = page.getByTestId("scouting-result");
  await expect(result).toBeFocused();
  await expect(result).toContainText("포르투갈 코너 10개");
  await expect(result.locator(".actual-row")).toContainText("5");
  await expect(result.locator(".actual-row")).toContainText("2");
  await expect(result.locator(".actual-row")).toContainText("3");
  await expect(result).toContainText("키커: Raphaël Guerreiro");
  await expect(result).toContainText("첫 후속 기록의 선수: João Mário");
  await expect(result).toContainText("match 2058002 · corner 261094415");
  await expect(result).toContainText("10개 중 4개 뒤에 10초 안 슈팅 기록");
  await expect(result).toContainText("어떤 훈련 배분이 이를 막았을지는 이 데이터로 알 수 없습니다");
  await expect(result.locator(".difference-grid")).toContainText("횟수 차이 0");
  await expect(result.locator(".difference-grid")).toContainText("훈련 배분이 2회 많음");
  await expect(result.locator(".difference-grid")).toContainText("실제가 2회 많음");

  await page.getByLabel("다음 회의에서 훈련 비중 재배분").check();
  await page.getByLabel(/이유/).fill("비숏 전달 뒤 기타 후속 기록이 예상보다 2회 많아 재배분을 검토");
  await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();
  const meetingNote = page.getByTestId("meeting-note-receipt");
  await expect(meetingNote).toBeFocused();
  await expect(meetingNote).toContainText("다음 회의에서 훈련 비중 재배분");
  await expect(meetingNote).toContainText("기타 후속 기록이 예상보다 2회 많아");
  await expect(result.locator(".actual-row")).toContainText("5");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("explains the structural correction and exposes reproducible classification rules", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  await expect(page.getByRole("heading", { name: /구역 수만 보지 않고.*누가 차고/ })).toBeVisible();
  await expect(page.locator(".audit-metrics article").filter({ hasText: "8/14" })).toContainText("콰레스마 코너");
  await expect(page.locator(".audit-metrics article").filter({ hasText: "6회" })).toContainText("하파엘 게헤이루");
  await expect(page.getByText(/두 구역으로 압축하면 이점이 사라졌습니다/)).toBeVisible();
  await page.getByText("자료·분류 규칙·판단 한계").click();
  await expect(page.getByText(/숏 구역 전달: 프로젝트가 정의한 숏 구역/)).toBeVisible();
  for (const source of ["Events", "Matches", "Players", "CC BY 4.0"]) {
    await expect(page.getByRole("link", { name: source })).toBeVisible();
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("does not present a first-event actor as a receiver, contact winner, or marking recommendation", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  const visible = await page.locator("body").innerText();
  for (const forbidden of [
    "첫 접촉 선수",
    "수신자",
    "경합 승자",
    "마킹 담당",
    "AI 추천",
    "승률 예측",
    "첫 행동",
    "첫 공격 행동",
    "첫 수비 행동",
  ]) {
    expect(visible).not.toContain(forbidden);
  }
  expect(visible).toContain("첫 후속 기록");
  expect(visible).toContain("첫 수비는 데이터에 남은 기록");
});
