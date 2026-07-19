import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the built release runs the keyless commit and held-out reveal loop", async ({ page }) => {
  const origins = new Set<string>();
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /조별리그에서 세우고/ })).toBeVisible();
  await expect(page.locator(".stage")).toHaveAttribute("data-partitions-disjoint", "true");
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.getByText("한 경기씩 검토하며 정책 바꾸기", { exact: true }).click();
  await page.getByRole("button", { name: "첫 16강 경기만 잠금" }).click();
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal/ })).toHaveCount(0);
  await page.getByRole("button", { name: "미공개 16강 경기 공개" }).click();
  await expect(page.getByRole("heading", { name: /Uruguay - Portugal · 위치 겹침/ })).toBeVisible();
  expect([...origins]).toEqual(["http://127.0.0.1:4175"]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the built release fails closed when the bound empirical report is invalid", async ({ page }) => {
  await page.goto("/invalid/");
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Policy Lab을 열 수 없습니다");
  await expect(page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" })).toHaveCount(0);
});

test("the built release applies one snapshot to both held-out audits", async ({ page }) => {
  await page.goto("/");
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.locator('.lane-card[data-lane="near"]').click();
  await page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" }).click();
  const policyId = (await page.getByTestId("lock-receipt").locator(".policy-id").innerText()).trim();
  await page.getByRole("button", { name: "16강 8경기 평가 요약 공개" }).click();
  await expect(page.locator(".round").getByText("16강 평가 영수증 8개")).toBeVisible();
  await expect(page.locator(".lane-card").first()).toBeDisabled();
  await page.getByRole("button", { name: "같은 정책으로 봉인 검증 8경기 공개" }).click();
  await expect(page.getByRole("heading", { name: /8강 이후 8경기 · 위치 겹침/ })).toBeVisible();
  await expect(page.getByTestId("final-receipt")).toContainText("정책 변경 0회");
  await expect(page.getByTestId("final-receipt")).toContainText(policyId);
});
