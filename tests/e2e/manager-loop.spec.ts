import { expect, test } from "@playwright/test";

test("manager choice changes the visible tactical readout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Touchline Lab" })).toBeVisible();
  await expect(page.getByText("프로토타입 로직 · 공식 데이터 연결 전")).toBeVisible();

  const risk = page.getByText("전환 위험").locator("..").getByRole("strong");
  const before = await risk.textContent();
  await page.getByLabel("압박 강도").fill("95");
  await expect(risk).not.toHaveText(before ?? "");
});
