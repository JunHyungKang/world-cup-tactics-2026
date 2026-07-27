import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

const headline = /포르투갈이 반복한 코너 전개,\s*우루과이는 이미 겪어봤을까요\?/u;
const signatures = [
  {
    id: "short-attacking-first",
    label: "숏 코너 뒤 · 공격팀 먼저 기록",
    attack: 7,
    defense: 2,
    heldOut: 5,
    shots: 2,
  },
  {
    id: "aerial-attacking-first",
    label: "공중 경합·헤더 뒤 · 공격팀 먼저 기록",
    attack: 1,
    defense: 2,
    heldOut: 2,
    shots: 0,
  },
  {
    id: "aerial-defending-first",
    label: "공중 경합·헤더 뒤 · 수비팀 먼저 기록",
    attack: 4,
    defense: 0,
    heldOut: 0,
    shots: 0,
  },
  {
    id: "other-attacking-first",
    label: "그 밖의 전개 뒤 · 공격팀 먼저 기록",
    attack: 1,
    defense: 0,
    heldOut: 0,
    shots: 0,
  },
  {
    id: "other-defending-first",
    label: "그 밖의 전개 뒤 · 수비팀 먼저 기록",
    attack: 1,
    defense: 1,
    heldOut: 3,
    shots: 2,
  },
];
const selectedIds = ["aerial-defending-first", "short-attacking-first"] as const;
const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
];

function questionToggle(page: Page, id: string) {
  return page.locator(`[data-select="${id}"]`);
}

function questionCard(page: Page, id: string) {
  return page.locator(`[data-question-card="${id}"]`);
}

async function openInitial(page: Page) {
  await page.goto("./", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
  await expect(page.locator(".workspace")).toHaveAttribute("data-routine-status", "PASS");
  await expect(page.locator(".workspace")).toHaveAttribute("data-revealed", "false");
  await expect(page.locator(".quick-evidence article")
    .filter({ hasText: "포르투갈이 공격한 코너" })).toContainText("14/14");
  await expect(page.locator(".quick-evidence article")
    .filter({ hasText: "우루과이가 수비한 코너" })).toContainText("5/6");
  await expect(page.locator("[data-question-card]")).toHaveCount(5);
  await expect(page.getByTestId("priority-summary")).toHaveText("0/2개 선택 · 2개 남음");
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
}

async function assertTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function assertNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
}

async function selectTwoQuestions(
  page: Page,
  mode: "pointer" | "touch" | "keyboard" = "pointer",
) {
  for (const [index, id] of selectedIds.entries()) {
    const toggle = questionToggle(page, id);
    if (mode === "touch") {
      await toggle.tap();
    } else if (mode === "keyboard") {
      await toggle.focus();
      await page.keyboard.press("Enter");
      if (index === selectedIds.length - 1) {
        await expect(page.getByRole("button", {
          name: "선택한 훈련 질문 2개를 맞대결 공개 전에 잠그기",
        })).toBeFocused();
      } else {
        await expect(questionToggle(page, id)).toBeFocused();
      }
    } else {
      await toggle.click();
    }
  }
  await expect(page.getByTestId("priority-summary")).toHaveText("2/2개 선택 · 0개 남음");
  for (const id of selectedIds) {
    await expect(questionToggle(page, id)).toHaveAttribute("aria-pressed", "true");
  }
}

async function lockQuestions(page: Page) {
  await page.getByRole("button", {
    name: "선택한 훈련 질문 2개를 맞대결 공개 전에 잠그기",
  }).click();
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await expect(page.getByTestId("priority-mix")).toContainText(
    "맞대결 기록을 보기 전에 잠갔습니다.",
  );
  for (const signature of signatures) {
    await expect(questionToggle(page, signature.id)).toBeDisabled();
  }
}

async function revealHeldOut(page: Page) {
  await page.getByRole("button", {
    name: "가려 둔 우루과이–포르투갈 코너 기록 보기",
  }).click();
  const result = page.getByTestId("scouting-result");
  await expect(result).toBeFocused();
  const selected = result.locator(".comparison-row").filter({ hasText: "내 훈련 질문" }).locator("span");
  const actual = result.locator(".comparison-row").filter({ hasText: "실제 맞대결" }).locator("span");
  const shots = result.locator(".comparison-row").filter({ hasText: "10초 안 슈팅 기록" }).locator("span");
  await expect(selected).toHaveText(["선택", "선택 밖", "선택", "선택 밖", "선택 밖"]);
  await expect(actual).toHaveText(["5", "2", "0", "0", "3"]);
  await expect(shots).toHaveText(["2", "0", "0", "0", "2"]);
  return result;
}

async function completeQuestionLoop(
  page: Page,
  mode: "pointer" | "touch" | "keyboard" = "pointer",
) {
  await selectTwoQuestions(page, mode);
  await lockQuestions(page);
  return revealHeldOut(page);
}

test("BG-01 first-fold named-team evidence, five questions, and 44px controls", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openInitial(page);
    await expect(page.getByText("0회는 약점이 아닙니다.")).toBeVisible();
    await expect(page.getByText(/자동 선택이나 순위는 없습니다/)).toBeVisible();
    for (const signature of signatures) {
      await assertTarget(questionToggle(page, signature.id));
    }
    await assertTarget(page.getByRole("button", {
      name: "선택한 훈련 질문 2개를 맞대결 공개 전에 잠그기",
    }));
    if (viewport.width === 390) {
      const firstControl = await questionToggle(page, "short-attacking-first").boundingBox();
      expect(firstControl).not.toBeNull();
      expect(firstControl!.y).toBeLessThan(844);
      await expect(page.locator(".commit")).toHaveCSS("position", "sticky");
    }
    await assertNoHorizontalOverflow(page);
  }
});

test("BG-02 pointer, touch, and keyboard paths select the same exact two questions", async ({ page }, testInfo) => {
  const modes = testInfo.project.name === "mobile"
    ? ["pointer", "touch", "keyboard"] as const
    : ["pointer", "keyboard"] as const;
  for (const mode of modes) {
    await openInitial(page);
    await selectTwoQuestions(page, mode);
    await expect(questionCard(page, "aerial-defending-first")).toHaveClass(/selected-priority/u);
    await expect(questionCard(page, "short-attacking-first")).toHaveClass(/selected-priority/u);
    await expect(questionCard(page, "other-defending-first")).not.toHaveClass(/selected-priority/u);
  }
});

test("BG-03 one precommit hides held-out evidence and freezes all question controls", async ({ page }) => {
  await openInitial(page);
  await expect(page.getByRole("button", {
    name: "선택한 훈련 질문 2개를 맞대결 공개 전에 잠그기",
  })).toBeDisabled();
  await selectTwoQuestions(page);
  await expect(page.getByText(/우루과이–포르투갈 · 포르투갈 코너 10개/)).toHaveCount(0);
  await lockQuestions(page);
  await expect(page.getByText(/우루과이–포르투갈 · 포르투갈 코너 10개/)).toHaveCount(0);
  await expect(page.getByRole("button", {
    name: "가려 둔 우루과이–포르투갈 코너 기록 보기",
  })).toBeEnabled();
  await revealHeldOut(page);
});

test("BG-04 held-out 5-2-0-0-3 and shot 2-0-0-0-2 records do not grade the questions", async ({ page }) => {
  await openInitial(page);
  const result = await completeQuestionLoop(page);
  await expect(result).toContainText("선택이 맞았는지 채점하지 않습니다");
  await expect(result).toContainText("관찰 횟수는 전술의 강점·약점·효과를 뜻하지 않습니다");
  const counterevidence = page.getByTestId("counterevidence");
  await expect(counterevidence).toContainText("선택 밖에서 먼저 확인할 슈팅 기록");
  await expect(counterevidence).toContainText("그 밖의 전개 뒤 · 수비팀 먼저 기록 · 실제 3장면");
  await expect(counterevidence).toContainText("corner 261095314");
  await expect(counterevidence).toContainText("Bernardo Silva → L. Suárez");
  await expect(counterevidence).toContainText("10초 안 포르투갈 슈팅 기록 있음");
});

test("BG-05 player-linked receipts expose events without inventing football roles", async ({ page }) => {
  await openInitial(page);
  const result = await completeQuestionLoop(page);
  await expect(result).toContainText("키커: Raphaël Guerreiro");
  await expect(result).toContainText("첫 후속 기록의 선수: João Mário");
  await expect(result).toContainText("match 2058002 · corner 261094415");
  const resultText = await result.innerText();
  for (const unsupportedRole of ["첫 접촉 선수", "수신자", "경합 승자", "마킹 담당"]) {
    expect(resultText).not.toContain(unsupportedRole);
  }
});

test("BG-06 structural correction and provenance stay visible without causal inference", async ({ page }) => {
  await openInitial(page);
  await page.getByText("분류 규칙과 기획 변경 보기").click();
  await expect(page.getByText(/기획서의 위치·임계값 단위는 데이터 검증 뒤 기각했습니다/)).toBeVisible();
  await expect(page.getByText(/두 우선순위 → 결과 전에 확정 → 가려 둔 경기의 반박/)).toBeVisible();
  await page.getByText("자료·분류 규칙·판단 한계").click();
  for (const source of ["Events", "Matches", "Players", "CC BY 4.0"]) {
    await expect(page.getByRole("link", { name: source })).toBeVisible();
  }
  await expect(page.getByText(/첫 접촉, 소유권, 경합 승자를 뜻하지 않습니다/)).toBeVisible();
});

test("BG-07 clean-profile refresh is keyless, stateless, and same-origin", async ({ page, context, baseURL }) => {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL!).origin) {
      foreign.push(request.url());
    }
  });
  await openInitial(page);
  await selectTwoQuestions(page);
  await page.evaluate(() => {
    localStorage.setItem("dirty", "questions");
    sessionStorage.setItem("dirty", "questions");
  });
  await context.addCookies([{
    name: "dirty",
    value: "questions",
    domain: new URL(baseURL!).hostname,
    path: "/",
  }]);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("priority-summary")).toHaveText("0/2개 선택 · 2개 남음");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(await page.evaluate(
    async () => (await navigator.serviceWorker?.getRegistrations() ?? []).length,
  )).toBe(0);
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

test("BG-08 responsive decision states and invalid data remain contained", async ({ page }) => {
  test.slow();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openInitial(page);
    await assertNoHorizontalOverflow(page);
    await completeQuestionLoop(page);
    await assertNoHorizontalOverflow(page);
  }
  await page.goto("http://127.0.0.1:4174");
  await expect(page.getByRole("alert")).toContainText("팀별 코너 첫 전개 기록을 열 수 없습니다");
  await assertNoHorizontalOverflow(page);
});

test("BG-09 reduced motion preserves the same selected questions and held-out ledger", async ({ page }) => {
  const snapshots: string[] = [];
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    await openInitial(page);
    const result = await completeQuestionLoop(page);
    snapshots.push(await result.locator(".comparison").innerText());
  }
  expect(snapshots[1]).toBe(snapshots[0]);
});

test("BG-10 axe and forced colors preserve text-labelled evidence states", async ({ page }) => {
  test.slow();
  await openInitial(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const result = await completeQuestionLoop(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ forcedColors: "active" });
  await expect(result).toContainText("선택");
  await expect(result).toContainText("선택 밖");
  await expect(result).toContainText("관찰 횟수는 전술의 강점·약점·효과를 뜻하지 않습니다");
  const invalidPage = await page.context().newPage();
  await invalidPage.goto("http://127.0.0.1:4174");
  expect((await new AxeBuilder({ page: invalidPage }).analyze()).violations).toEqual([]);
  await invalidPage.close();
});

test("BG-11 zero-observation, recommendation, causality, and outcome claims stay bounded", async ({ page }) => {
  await openInitial(page);
  await completeQuestionLoop(page);
  const body = await page.locator("body").innerText();
  for (const phrase of [
    "AI 추천",
    "승률 예측",
    "최적 정책입니다",
    "강화학습이 학습했다",
    "실점을 예방했다",
    "훈련이 성공했다",
    "우루과이의 약점",
  ]) {
    expect(body).not.toContain(phrase);
  }
  await expect(page.getByText("0회는 약점이 아닙니다.")).toBeVisible();
  await expect(page.getByText(/관찰 0회 · 약점 판정 아님/).first()).toBeVisible();
  await expect(page.getByText(/이 선택은 전술 추천이 아닙니다/)).toBeVisible();
  await expect(page.getByText(/어떤 훈련이 이를 막았을지는 이 데이터로 알 수 없습니다/)).toBeVisible();
});

test("BG-12 production marker binds the matchup-question release and exact five-signature data", async ({ page }, testInfo) => {
  await openInitial(page);
  const evidence = await page.evaluate(async () => {
    const marker = await (await fetch("./submission-build.json", { cache: "no-store" })).json();
    const texts: string[] = [];
    for (const file of marker.files) {
      if (/\.(?:html|js|css|json|map|txt)$/iu.test(file.path)) {
        texts.push(await (await fetch(file.path, { cache: "no-store" })).text());
      }
    }
    const release = await (await fetch("./release-manifest.json", { cache: "no-store" })).json();
    const bindingResponse = await fetch(
      marker.productDataBinding.path.replace(/^public\//u, "./"),
      { cache: "no-store" },
    );
    const bindingBytes = new Uint8Array(await bindingResponse.arrayBuffer());
    const bindingDigest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bindingBytes))]
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const binding = JSON.parse(new TextDecoder().decode(bindingBytes));
    const dataChecks = [];
    let policyReport = null;
    for (const artifact of binding.data_files) {
      const response = await fetch(artifact.path.replace(/^public\//u, "./"), { cache: "no-store" });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((byte) => byte.toString(16).padStart(2, "0")).join("");
      dataChecks.push({ status: response.status, digest, expected: artifact.sha256 });
      if (artifact.path.endsWith("policy-lab-spike.json")) {
        policyReport = JSON.parse(new TextDecoder().decode(bytes));
      }
    }
    return {
      marker,
      texts: texts.join("\n"),
      release,
      bindingStatus: bindingResponse.status,
      bindingDigest,
      dataChecks,
      policyReport,
    };
  });

  expect(evidence.marker.releaseCommit).toBe(testInfo.project.metadata.releaseCommit);
  expect(evidence.marker.buildSha256).toBe(testInfo.project.metadata.buildSha256);
  expect(evidence.release).toMatchObject({
    product_id: "corner-policy-lab",
    release_status: "stamped-final",
    manager_loop: "matchup-question-lock",
    causal_recommendation_status: "REJECT",
    empirical_campaign_status: "REVISE",
  });
  expect(evidence.texts).toContain("포르투갈이 반복한 코너 전개");
  expect(evidence.texts).toContain("훈련 질문 두 개");
  expect(evidence.texts).toContain("가려 둔 우루과이–포르투갈 코너 기록 보기");
  expect(evidence.texts).not.toContain("test-only-invalid-artifact");
  expect(evidence.texts).not.toContain("훈련 10회를 어떻게 나눌까요?");
  expect(evidence.bindingStatus).toBe(200);
  expect(evidence.bindingDigest).toBe(evidence.marker.productDataBinding.sha256);
  expect(evidence.dataChecks.length).toBeGreaterThan(0);
  for (const check of evidence.dataChecks) {
    expect(check.status).toBe(200);
    expect(check.digest).toBe(check.expected);
  }

  const situation = evidence.policyReport!.team_scouting.corner_situation_rehearsal;
  expect(situation).toMatchObject({
    status: "PASS",
    opponent_attack_reference: {
      team_name: "Portugal",
      source_corners: 14,
      classifiable_corners: 14,
    },
    manager_defensive_reference: {
      team_name: "Uruguay",
      source_corners: 6,
      classifiable_corners: 5,
    },
    held_out_match: {
      match_id: 2058002,
      match_name: "Uruguay - Portugal",
      source_corners: 10,
      classifiable_corners: 10,
      attacking_shots_within_10_seconds: 4,
    },
  });
  const board = situation.matchup_question_board;
  expect(board).toMatchObject({
    status: "PASS",
    selection_contract: {
      priority_count: 2,
      no_default_priorities: true,
      held_out_match_hidden_until_lock: true,
    },
  });
  expect(board.questions.map((question: {
    id: string;
    opponent_attack: { corners: number };
    manager_defensive_exposure: { corners: number };
    held_out_evidence: { corners: number; attacking_shots_within_10_seconds: number };
  }) => ({
    id: question.id,
    attack: question.opponent_attack.corners,
    defense: question.manager_defensive_exposure.corners,
    heldOut: question.held_out_evidence.corners,
    shots: question.held_out_evidence.attacking_shots_within_10_seconds,
  }))).toEqual(signatures.map(({ id, attack, defense, heldOut, shots }) => ({
    id,
    attack,
    defense,
    heldOut,
    shots,
  })));
  const unselectedShot = board.questions
    .find((question: { id: string }) => question.id === "other-defending-first")
    .held_out_evidence.event_receipts
    .find((receipt: { attacking_shot_within_10_seconds: boolean }) =>
      receipt.attacking_shot_within_10_seconds);
  expect(unselectedShot).toMatchObject({
    corner_event_id: 261095314,
    corner_taker: { display_name: "Bernardo Silva" },
    first_recorded_follow_up: {
      actor: { display_name: "L. Suárez" },
      sub_event_name: "Clearance",
    },
  });
  expect(situation.claim_boundary.unsupported).toEqual(expect.arrayContaining([
    "marking assignment",
    "rehearsal effectiveness",
    "defensive success caused by a plan",
    "optimal matchup tactic",
  ]));
});

test("BG-13 focus, status, and next-meeting memo preserve the sealed comparison", async ({ page }) => {
  await openInitial(page);
  await selectTwoQuestions(page, "keyboard");
  await lockQuestions(page);
  const result = await revealHeldOut(page);
  const comparisonBefore = await result.locator(".comparison").innerText();
  await page.getByLabel("다음 회의에서 훈련 질문 다시 선택").check();
  await page.getByLabel("이유 (120자 이내)")
    .fill("선택 밖 기타 비숏·수비팀 첫 기록이 3장면 남아 다음 회의에서 포함 여부를 검토");
  await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();
  const note = page.getByTestId("meeting-note-receipt");
  await expect(note).toBeFocused();
  await expect(note).toContainText("다음 회의에서 훈련 질문 다시 선택");
  await expect(note).toContainText("이미 잠근 두 질문과 공개된 경기 기록을 바꾸지 않습니다");
  expect(await result.locator(".comparison").innerText()).toBe(comparisonBefore);
});

test("BG-14 screenshot transcript covers initial, selected, and revealed states", async ({ page }, testInfo) => {
  const attachScreenshot = async (
    name: "artifact-initial" | "artifact-selected" | "artifact-revealed",
  ) => {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(name, { path, contentType: "image/png" });
  };
  await openInitial(page);
  await attachScreenshot("artifact-initial");
  await selectTwoQuestions(page);
  await attachScreenshot("artifact-selected");
  await lockQuestions(page);
  await revealHeldOut(page);
  await attachScreenshot("artifact-revealed");
});

test("BG-15 invalid matchup-question data fails closed without substitute controls", async ({ page, request, baseURL }) => {
  const [publicApp, invalidApp] = await Promise.all([
    request.get(new URL("app.js", baseURL).toString()),
    request.get("http://127.0.0.1:4174/app.js"),
  ]);
  expect(publicApp.status()).toBe(200);
  expect(invalidApp.status()).toBe(200);
  expect(createHash("sha256").update(await invalidApp.body()).digest("hex"))
    .toBe(createHash("sha256").update(await publicApp.body()).digest("hex"));

  const invalidReportResponse = await request.get(
    "http://127.0.0.1:4174/data/policy-lab-spike.json",
  );
  const invalidReport = await invalidReportResponse.json();
  expect(invalidReport.team_scouting.status).toBe("PASS");
  expect(invalidReport.team_scouting.corner_situation_rehearsal.status).toBe("REVISE");
  await page.goto("http://127.0.0.1:4174");
  await expect(page.getByRole("alert")).toContainText("팀별 코너 첫 전개 기록을 열 수 없습니다.");
  await expect(page.getByRole("button", {
    name: "선택한 훈련 질문 2개를 맞대결 공개 전에 잠그기",
  })).toHaveCount(0);
  await expect(page.getByRole("button", {
    name: "가려 둔 우루과이–포르투갈 코너 기록 보기",
  })).toHaveCount(0);
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await expect(page.locator("[data-question-card]")).toHaveCount(0);
  await expect(page.getByText(/합성 결과|대체 결과/u)).toHaveCount(0);
});
