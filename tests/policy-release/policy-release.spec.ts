import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the built release runs the keyless commit and held-out reveal loop", async ({ page }) => {
  const origins = new Set<string>();
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /코너킥 수비/ })).toBeVisible();
  await expect(page.locator(".stage")).toHaveAttribute("data-partitions-disjoint", "true");
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await page.getByText("16강 경기를 한 경기씩 확인하기", { exact: true }).click();
  await page.getByRole("button", { name: "첫 경기 선택만 확정" }).click();
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal/ })).toHaveCount(0);
  await page.getByRole("button", { name: "이번 16강 경기 결과 보기" }).click();
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal · 선택 구역과 겹침/ })).toBeVisible();
  expect([...origins]).toEqual(["http://127.0.0.1:4175"]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the built release fails closed when the bound empirical report is invalid", async ({ page }) => {
  await page.goto("/invalid/");
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Policy Lab을 열 수 없습니다");
  await expect(page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" })).toHaveCount(0);
});

test("the built release applies one snapshot to both held-out audits", async ({ page }) => {
  await page.goto("/");
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.getByRole("button", { name: "최소 위치 겹침률 50% 선택" }).click();
  await page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" }).click();
  const policyId = (await page.getByTestId("lock-receipt").locator(".policy-id").innerText()).trim();
  await expect(page.getByTestId("lock-receipt")).toContainText("통과 기준 50%도 함께 확정했습니다");
  await page.getByRole("button", { name: "16강 8경기 결과 보기" }).click();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 미달");
  await expect(page.locator(".round").getByText("16강 확인 기록 8개")).toBeVisible();
  await expect(page.locator(".lane-card").first()).toBeDisabled();
  await page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }).click();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 충족");
  await expect(page.getByRole("heading", { name: /8강 이후 8경기 · 선택 구역과 겹침/ })).toBeVisible();
  await expect(page.getByTestId("final-receipt")).toContainText("선택 변경 0회");
  await expect(page.getByTestId("final-receipt")).toContainText(policyId);
});
