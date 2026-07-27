import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const demoPriorities = ["aerial-defending-first", "short-attacking-first"];

async function selectDemoPriorities(page: Page) {
  for (const signature of demoPriorities) {
    await page.locator(`[data-quick-select="${signature}"]`).click();
  }
  await expect(page.getByTestId("priority-summary")).toHaveText("2/2개 선택 · 0개 남음");
  await expect(page.getByTestId("priority-mix")).toContainText(
    "사전 관찰 공백 1개 · 우루과이도 겪은 장면 1개",
  );
  await expect(page.getByTestId("selected-question-labels")).toContainText(
    "공중 경합·헤더 뒤 · 수비팀 먼저 기록",
  );
  await expect(page.getByTestId("selected-question-labels")).toContainText(
    "숏 구역 전달 뒤 · 공격팀 먼저 기록",
  );
}

async function completeDemo(page: Page) {
  await selectDemoPriorities(page);
  await page.getByRole("button", {
    name: "선택한 영상 검토 안건 2개를 맞대결 공개 전에 잠그기",
  }).click();
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await page.getByRole("button", {
    name: "가려 둔 우루과이–포르투갈 코너 기록 보기",
  }).click();
  return page.getByTestId("scouting-result");
}

test("the built release runs the keyless two-question lock and hidden counterevidence loop", async ({ page, baseURL }) => {
  const foreignRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL!).origin) {
      foreignRequests.push(request.url());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", {
    name: /포르투갈 코너 14개만.*그대로 믿어도 될까요/u,
  })).toBeVisible();
  await expect(page.locator(".quick-evidence article").filter({
    hasText: "포르투갈이 공격한 코너",
  })).toContainText("14/14");
  await expect(page.locator(".quick-evidence article").filter({
    hasText: "우루과이가 수비한 코너",
  })).toContainText("5/6");
  await expect(page.getByText("관찰 0회 · 약점 판정 아님")).toHaveCount(2);
  await expect(page.getByTestId("team-model")).toContainText(
    "포르투갈 코너 14개를 월드컵 조별리그 397개로 보정했습니다",
  );
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);

  const result = await completeDemo(page);
  await expect(result).toBeFocused();
  await expect(result.locator(".user-row > span")).toHaveText([
    "선택",
    "선택 밖",
    "선택",
    "선택 밖",
    "선택 밖",
  ]);
  await expect(result.locator(".actual-row > span")).toHaveText(["5", "2", "0", "0", "3"]);
  const counterevidence = page.getByTestId("counterevidence");
  await expect(counterevidence).toContainText("그 밖의 전개 뒤 · 수비팀 먼저 기록 · 실제 3장면");
  await expect(counterevidence).toContainText("10초 안 포르투갈 슈팅 기록이 2장면");
  await expect(counterevidence).toContainText("corner 261095314");
  await expect(counterevidence).toContainText("Bernardo Silva → L. Suárez");
  await expect(result).toContainText("10개 중 4개 뒤에 10초 안 슈팅 기록");
  await expect(result).toContainText("어떤 훈련이 이를 막았을지는 이 데이터로 알 수 없습니다");
  expect(foreignRequests).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the built release fails closed when the bound matchup question board is invalid", async ({ page }) => {
  await page.goto("/invalid/");
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("팀별 코너 첫 전개 기록을 열 수 없습니다");
  await expect(page.getByRole("button", {
    name: "선택한 영상 검토 안건 2개를 맞대결 공개 전에 잠그기",
  })).toHaveCount(0);
  await expect(page.getByRole("button", {
    name: "가려 둔 우루과이–포르투갈 코너 기록 보기",
  })).toHaveCount(0);
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
});

test("the locked priorities and revealed result remain immutable after the meeting memo", async ({ page }) => {
  await page.goto("/");
  await selectDemoPriorities(page);
  await page.getByRole("button", {
    name: "선택한 영상 검토 안건 2개를 맞대결 공개 전에 잠그기",
  }).click();
  for (const signature of demoPriorities) {
    await expect(page.locator(`[data-quick-select="${signature}"]`)).toBeDisabled();
  }
  await page.getByRole("button", {
    name: "가려 둔 우루과이–포르투갈 코너 기록 보기",
  }).click();
  const result = page.getByTestId("scouting-result");
  const comparisonBefore = await result.locator(".comparison").innerText();

  await page.getByLabel("다음 회의에서 영상 검토 안건 다시 선택").check();
  await page.getByLabel("이유 (120자 이내)").fill(
    "선택하지 않은 그 밖의 전개가 세 장면 나와 다음 회의에서 포함 여부를 검토",
  );
  await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();

  const note = page.getByTestId("meeting-note-receipt");
  await expect(note).toBeFocused();
  await expect(note).toContainText("다음 회의에서 영상 검토 안건 다시 선택");
  await expect(note).toContainText("이미 잠근 두 안건과 공개된 경기 기록을 바꾸지 않습니다");
  expect(await result.locator(".comparison").innerText()).toBe(comparisonBefore);
});
