import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("conditions the first decision on a named opponent and hides the matchup record", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  await expect(page.getByRole("heading", { name: /포르투갈전 코너 수비 훈련 10회/ })).toBeVisible();
  await expect(page.getByText(/포르투갈 코너 14개와 대회 전체 기록을 함께 반영/)).toBeVisible();
  await expect(page.getByText("포르투갈 조별리그 코너").locator("..")).toContainText("14/14");
  await expect(page.getByText("우루과이가 수비한 코너").locator("..")).toContainText("5/6");
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await expect(page.getByText(/포르투갈 47%/)).toBeVisible();
  await expect(page.getByText(/대회 전체 53%/)).toBeVisible();
  await expect(page.getByText(/훈련 배분의 효과, 수비 성공, 실점 방지 또는 최적 전술을 뜻하지 않습니다/)).toBeVisible();
});

test("locks exactly ten self-allocated rehearsal reps before revealing the opponent distribution", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  const lock = page.getByRole("button", { name: "이 배분을 결과 보기 전에 잠그기" });
  await expect(lock).toBeDisabled();
  for (let count = 0; count < 5; count += 1) {
    await page.getByRole("button", { name: "숏 코너 훈련 1회 추가" }).click();
  }
  for (let count = 0; count < 1; count += 1) {
    await page.getByRole("button", { name: "니어포스트 훈련 1회 추가" }).click();
  }
  for (let count = 0; count < 4; count += 1) {
    await page.getByRole("button", { name: "중앙·파포스트 훈련 1회 추가" }).click();
  }
  await expect(lock).toBeEnabled();
  await expect(page.getByTestId("allocation-summary")).toContainText("10회 배분 · 0회 남음");
  await lock.click();
  await expect(page.getByRole("button", { name: "숏 코너 훈련 1회 추가" })).toBeDisabled();
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await page.getByRole("button", { name: "가려 둔 맞대결 기록 보기" }).click();
  const result = page.getByTestId("scouting-result");
  await expect(result).toBeFocused();
  await expect(result).toContainText("포르투갈의 실제 코너 10개");
  await expect(result.locator(".actual-row")).toContainText("5");
  await expect(result.locator(".actual-row")).toContainText("1");
  await expect(result.locator(".actual-row")).toContainText("4");
  await expect(result).toContainText("훈련의 효과나 정답을 매기지 않습니다");
});

test("discloses where team conditioning helps and where the two-area compression does not", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  await expect(page.getByText("2.14%↓").locator("..")).toContainText("16강 8경기 예측 오차");
  await expect(page.getByText("7.21%↓").locator("..")).toContainText("8강 이후 8경기 예측 오차");
  await expect(page.getByText("12/16").locator("..")).toContainText("4팀은 악화");
  await expect(page.getByText(/상위 두 구역만 뽑으면.*전체 적중 수가 같았습니다/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
