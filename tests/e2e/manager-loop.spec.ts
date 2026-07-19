import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("mobile first fold exposes the whole decision with 44px targets", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /코너 수비에 한 명 더/ })).toBeVisible();
  await expect(page.getByText("2018 브라질 경기 기록 · 결과 예측 아님 · 프로젝트에서 정의한 구역")).toBeVisible();

  for (const name of ["역습 역할 1명을 수비 임무로 옮기기", "숏 코너 견제", "니어포스트 수비", "중앙·파포스트 수비", "세컨드볼 대비"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height, name).toBeLessThanOrEqual(568);
  }
});

test("selection, evidence, counterexample, replay, and reset form one honest loop", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "세컨드볼 대비" }).click();
  await expect(page.getByRole("heading", { name: "세컨드볼 대비 우선 · 역습 1명 수비 전환" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "세컨드볼 대비 우선 · 역습 1명 수비 전환" })).toBeInViewport();
  await expect(page.getByText("전술 효과를 나타내는 점수가 아닙니다.")).toBeVisible();
  await expect(page.getByText("코너 이벤트 #258974215")).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("data-evidence-fingerprint", "877e015b716ffdee");
  await expect(page.getByText(/실제 공의 궤적이 아닙니다/)).toBeVisible();
  await expect(page.getByText(/프로토타입 로직|경기 통제|전환 위험/)).toHaveCount(0);

  await page.getByRole("button", { name: "다음 장면" }).click();
  await expect(page.getByText(/현재 2 \/ 전체/)).toBeVisible();
  await page.getByRole("button", { name: /반례 보기/ }).click();
  await expect(page.getByRole("heading", { name: "이 선택으로 설명되지 않는 슈팅 기록" })).toBeVisible();
  await expect(page.getByText("이 슈팅 기록에는 선택한 우선 구역과 겹치는 지점이 없습니다. 이 선택이 슈팅을 막았을지는 알 수 없습니다.")).toBeVisible();
  await expect(page.getByText("코너 이벤트 #258973935")).toBeVisible();
  await page.getByRole("button", { name: "초기화" }).click();
  await expect(page.getByRole("heading", { name: "내 약속 COACH" })).toHaveCount(0);
  await expect(page.locator(".reset-status")).toHaveText("처음 상태로 돌아왔습니다. 과거 기록과 고정 집계는 그대로입니다.");
  await expect(page.getByRole("button", { name: "역습 역할 1명을 수비 임무로 옮기기" })).toBeFocused();
});

test("keyboard path and accessibility scan preserve the same state", async ({ page }) => {
  await page.goto("/");
  const role = page.getByRole("button", { name: "역습 역할 1명을 수비 임무로 옮기기" });
  await role.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "숏 코너 견제" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "숏 코너 견제 우선 · 역습 1명 수비 전환" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("mouse drag commits only over a rendered mission target", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const token = page.getByRole("button", { name: "역습 역할 1명을 수비 임무로 옮기기" });
  const destination = page.getByRole("button", { name: "세컨드볼 대비" });
  const [tokenBox, destinationBox] = await Promise.all([token.boundingBox(), destination.boundingBox()]);
  expect(tokenBox).not.toBeNull();
  expect(destinationBox).not.toBeNull();
  await page.mouse.move(tokenBox!.x + tokenBox!.width / 2, tokenBox!.y + tokenBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(destinationBox!.x + destinationBox!.width / 2, destinationBox!.y + destinationBox!.height / 2, { steps: 8 });
  const ghost = page.getByTestId("role-drag-ghost");
  await expect(ghost).toBeVisible();
  const ghostBox = await ghost.boundingBox();
  expect(ghostBox).not.toBeNull();
  expect(Math.abs(ghostBox!.x + ghostBox!.width / 2 - (destinationBox!.x + destinationBox!.width / 2))).toBeLessThan(2);
  expect(Math.abs(ghostBox!.y + ghostBox!.height / 2 - (destinationBox!.y + destinationBox!.height / 2))).toBeLessThan(2);
  expect(await ghost.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
  expect(await destination.evaluate((element, point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return hit === element || Boolean(hit && element.contains(hit));
  }, { x: destinationBox!.x + destinationBox!.width / 2, y: destinationBox!.y + destinationBox!.height / 2 })).toBe(true);
  await page.mouse.up();
  await expect(ghost).toHaveCount(0);
  await expect(destination).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "세컨드볼 대비 우선 · 역습 1명 수비 전환" })).toBeVisible();

  const initialWindow = page.getByText("코너 이벤트 #258974215");
  const snappedBox = await token.boundingBox();
  expect(snappedBox).not.toBeNull();
  await page.mouse.move(snappedBox!.x + snappedBox!.width / 2, snappedBox!.y + snappedBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(snappedBox!.x - 120, snappedBox!.y - 80, { steps: 8 });
  await page.mouse.up();
  await expect(initialWindow).toBeVisible();
  await expect(destination).toHaveAttribute("aria-pressed", "true");
});
