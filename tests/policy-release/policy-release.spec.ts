import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const rehearsal = [
  { name: "숏 구역 전달", repetitions: 5 },
  { name: "비숏 · 공중 후속 기록", repetitions: 4 },
  { name: "비숏 · 기타 후속 기록", repetitions: 1 },
];

async function allocateFiveFourOne(page: Page) {
  for (const routine of rehearsal) {
    const add = page.getByRole("button", { name: `${routine.name} 훈련 1회 추가` });
    for (let count = 0; count < routine.repetitions; count += 1) await add.click();
  }
  await expect(page.getByTestId("allocation-summary")).toHaveText("10회 배분 · 0회 남음");
}

test("the built release runs the keyless 5-4-1 lock and hidden 5-2-3 reveal loop", async ({ page, baseURL }) => {
  const foreignRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL!).origin) {
      foreignRequests.push(request.url());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /포르투갈 코너 상황 3유형/ })).toBeVisible();
  await expect(page.locator(".quick-evidence article").filter({ hasText: "포르투갈 공격 기록" })).toContainText("14/14");
  await expect(page.locator(".quick-evidence article").filter({ hasText: "우루과이 수비 상황" })).toContainText("5/6");
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);

  await allocateFiveFourOne(page);
  await page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" }).click();
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await page.getByRole("button", { name: "가려 둔 맞대결 첫 전개 보기" }).click();

  const result = page.getByTestId("scouting-result");
  await expect(result).toBeFocused();
  await expect(result.locator(".user-row > span")).toHaveText(["5", "4", "1"]);
  await expect(result.locator(".actual-row > span")).toHaveText(["5", "2", "3"]);
  await expect(result.locator(".difference-grid")).toContainText("횟수 차이 0");
  await expect(result.locator(".difference-grid")).toContainText("훈련 배분이 2회 많음");
  await expect(result.locator(".difference-grid")).toContainText("실제가 2회 많음");
  await expect(result).toContainText("10개 중 4개 뒤에 10초 안 슈팅 기록");
  await expect(result).toContainText("어떤 훈련 배분이 이를 막았을지는 이 데이터로 알 수 없습니다");
  expect(foreignRequests).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the built release fails closed when the bound situation rehearsal is invalid", async ({ page }) => {
  await page.goto("/invalid/");
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("팀별 코너 첫 전개 기록을 열 수 없습니다");
  await expect(page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "가려 둔 맞대결 첫 전개 보기" })).toHaveCount(0);
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
});

test("the locked allocation and revealed result remain immutable after the meeting memo", async ({ page }) => {
  await page.goto("/");
  await allocateFiveFourOne(page);
  await page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" }).click();
  for (const routine of rehearsal) {
    await expect(page.getByRole("button", { name: `${routine.name} 훈련 1회 추가` })).toBeDisabled();
  }
  await page.getByRole("button", { name: "가려 둔 맞대결 첫 전개 보기" }).click();
  const result = page.getByTestId("scouting-result");
  const comparisonBefore = await result.locator(".comparison").innerText();

  await page.getByLabel("다음 회의에서 훈련 비중 재배분").check();
  await page.getByLabel("이유 (120자 이내)").fill("기타 후속 기록이 실제로 2회 더 많아 다음 회의에서 재검토");
  await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();

  const note = page.getByTestId("meeting-note-receipt");
  await expect(note).toBeFocused();
  await expect(note).toContainText("다음 회의에서 훈련 비중 재배분");
  await expect(note).toContainText("이미 공개된 경기 기록과 훈련 배분을 바꾸지 않습니다");
  expect(await result.locator(".comparison").innerText()).toBe(comparisonBefore);
});
