import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const selectedQuestions = [
  {
    id: "aerial-defending-first",
    label: "공중 경합·헤더 뒤 · 수비팀 먼저 기록",
    attack: 4,
    defense: 0,
  },
  {
    id: "short-attacking-first",
    label: "숏 코너 뒤 · 공격팀 먼저 기록",
    attack: 7,
    defense: 2,
  },
];

function questionCard(page: Page, id: string) {
  return page.locator(`[data-question-card="${id}"]`);
}

function questionToggle(page: Page, id: string) {
  return page.locator(`[data-select="${id}"]`);
}

async function selectTwoQuestions(page: Page, keyboard = false) {
  for (const [index, question] of selectedQuestions.entries()) {
    const toggle = questionToggle(page, question.id);
    if (keyboard) {
      await toggle.focus();
      await page.keyboard.press("Enter");
      if (index === selectedQuestions.length - 1) {
        await expect(page.getByRole("button", {
          name: "선택한 훈련 질문 2개를 맞대결 공개 전에 잠그기",
        })).toBeFocused();
      } else {
        await expect(questionToggle(page, question.id)).toBeFocused();
      }
    } else {
      await toggle.click();
    }
  }
  await expect(page.getByTestId("priority-summary")).toHaveText("2/2개 선택 · 0개 남음");
}

async function assertMinimumTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test("starts with five team-linked questions, visible support, and no held-out result", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  await expect(page.getByRole("heading", {
    name: /포르투갈이 반복한 코너 전개,\s*우루과이는 이미 겪어봤을까요\?/u,
  })).toBeVisible();

  const attackSummary = page.locator(".quick-evidence article")
    .filter({ hasText: "포르투갈이 공격한 코너" });
  const defenseSummary = page.locator(".quick-evidence article")
    .filter({ hasText: "우루과이가 수비한 코너" });
  await expect(attackSummary).toContainText("14/14");
  await expect(defenseSummary).toContainText("5/6");
  await expect(page.locator("[data-question-card]")).toHaveCount(5);
  await expect(page.getByTestId("priority-summary")).toHaveText("0/2개 선택 · 2개 남음");
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);

  const unseen = questionCard(page, "aerial-defending-first");
  await expect(unseen).toContainText("포르투갈 공격 · 4장면");
  await expect(unseen).toContainText("우루과이 수비 기록 · 0장면");
  await expect(unseen).toContainText("관찰 0회 · 약점 판정 아님");
  await expect(unseen).toContainText("약점이 아니라 이 표본에서 대응 장면을 확인하지 못했다는 뜻");

  const familiar = questionCard(page, "short-attacking-first");
  await expect(familiar).toContainText("포르투갈 공격 · 7장면");
  await expect(familiar).toContainText("우루과이 수비 기록 · 2장면");
  await expect(familiar).toContainText("같은 분류 2회");
  await familiar.getByText("원본 이벤트 체인 9장면 보기").click();
  await expect(familiar).toContainText("Portugal - Spain");
  await expect(familiar).toContainText("Ricardo Quaresma → João Mário");

  await expect(page.getByText("0회는 약점이 아닙니다.")).toBeVisible();
  await expect(page.getByText(/자동 선택이나 순위는 없습니다/)).toBeVisible();
  await expect(page.getByText(/훈련 효과, 수비 성공, 실점 방지, 최적 전술은 판단하지 않습니다/)).toBeVisible();
});

test("keeps a 44px first question control in the mobile flow and the commit bar sticky", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/prototypes/opponent-scouting/");
  const firstToggle = questionToggle(page, "short-attacking-first");
  await expect(firstToggle).toBeVisible();
  await assertMinimumTarget(firstToggle);
  const box = await firstToggle.boundingBox();
  expect(box!.y).toBeLessThan(844);
  await expect(page.locator(".commit")).toHaveCSS("position", "sticky");
  await expect(page.getByText("관찰 0회 · 약점 판정 아님").first()).toBeVisible();
});

test("keyboard-selects exactly two questions, locks before reveal, and preserves the memo receipt", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  const lock = page.getByRole("button", {
    name: "선택한 훈련 질문 2개를 맞대결 공개 전에 잠그기",
  });
  await expect(lock).toBeDisabled();

  await selectTwoQuestions(page, true);
  await expect(lock).toBeEnabled();
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await lock.click();
  for (const question of selectedQuestions) {
    await expect(questionToggle(page, question.id)).toBeDisabled();
  }
  await expect(page.getByTestId("priority-mix")).toContainText(
    "맞대결 기록을 보기 전에 잠갔습니다.",
  );
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);

  await page.getByRole("button", {
    name: "가려 둔 우루과이–포르투갈 코너 기록 보기",
  }).click();
  const result = page.getByTestId("scouting-result");
  await expect(result).toBeFocused();
  const actual = result.locator(".comparison-row").filter({ hasText: "실제 맞대결" }).locator("span");
  const shots = result.locator(".comparison-row").filter({ hasText: "10초 안 슈팅 기록" }).locator("span");
  await expect(actual).toHaveText(["5", "2", "0", "0", "3"]);
  await expect(shots).toHaveText(["2", "0", "0", "0", "2"]);

  const counterevidence = page.getByTestId("counterevidence");
  await expect(counterevidence).toContainText("선택 밖에서 먼저 확인할 슈팅 기록");
  await expect(counterevidence).toContainText("그 밖의 전개 뒤 · 수비팀 먼저 기록 · 실제 3장면");
  await expect(counterevidence).toContainText("corner 261095314");
  await expect(counterevidence).toContainText("Bernardo Silva → L. Suárez");
  await expect(counterevidence).toContainText("걷어내기");

  const comparisonBefore = await result.locator(".comparison").innerText();
  await page.getByLabel("다음 회의에서 훈련 질문 다시 선택").check();
  await page.getByLabel("이유 (120자 이내)")
    .fill("선택 밖 기타 비숏·수비팀 첫 기록이 3장면 남아 다음 회의에서 포함 여부를 검토");
  await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();
  const meetingNote = page.getByTestId("meeting-note-receipt");
  await expect(meetingNote).toBeFocused();
  await expect(meetingNote).toContainText("다음 회의에서 훈련 질문 다시 선택");
  await expect(meetingNote).toContainText("이미 잠근 두 가설과 공개된 경기 기록을 바꾸지 않습니다");
  expect(await result.locator(".comparison").innerText()).toBe(comparisonBefore);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("explains the structural correction and exposes reproducible classification rules", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  await expect(page.getByRole("heading", {
    name: /포르투갈의 ‘키커 → 첫 후속 기록 → 10초 안 슈팅’/u,
  })).toBeVisible();
  await page.getByText("분류 규칙과 기획 변경 보기").click();
  await expect(page.getByText(/기획서의 위치·임계값 단위는 데이터 검증 뒤 기각했습니다/)).toBeVisible();
  await expect(page.getByText(/두 우선순위 → 결과 전에 확정 → 가려 둔 경기의 반박/)).toBeVisible();
  await page.getByText("자료·분류 규칙·판단 한계").click();
  await expect(page.getByText(/첫 후속 기록의 팀 역할을 공격팀·수비팀으로 나눕니다/)).toBeVisible();
  for (const source of ["Events", "Matches", "Players", "CC BY 4.0"]) {
    await expect(page.getByRole("link", { name: source })).toBeVisible();
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("keeps zero-observation and recorded-actor wording inside the non-causal boundary", async ({ page }) => {
  await page.goto("/prototypes/opponent-scouting/");
  const visible = await page.locator("body").innerText();
  for (const forbidden of [
    "첫 접촉 선수",
    "수신자",
    "경합 승자",
    "마킹 담당",
    "AI 추천",
    "승률 예측",
    "최적 정책입니다",
    "우루과이의 약점",
  ]) {
    expect(visible).not.toContain(forbidden);
  }
  expect(visible).toContain("첫 후속 기록");
  expect(visible).toContain("관찰 0회 · 약점 판정 아님");
  expect(visible).toContain("이 선택은 전술 추천이 아닙니다");
});
