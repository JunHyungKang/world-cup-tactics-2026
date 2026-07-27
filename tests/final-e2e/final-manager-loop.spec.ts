import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

const headline = /포르투갈 코너 상황 3유형\.\s*훈련 10회를 어떻게 나눌까요\?/u;
const routines = [
  { id: "short-recorded-endpoint", name: "숏 구역 전달", repetitions: 5 },
  { id: "aerial-recorded-follow-up", name: "비숏 · 공중 후속 기록", repetitions: 4 },
  { id: "other-recorded-follow-up", name: "비숏 · 기타 후속 기록", repetitions: 1 },
];
const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
];

async function openInitial(page: Page) {
  await page.goto("./", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
  await expect(page.locator(".workspace")).toHaveAttribute("data-routine-status", "PASS");
  await expect(page.locator(".workspace")).toHaveAttribute("data-revealed", "false");
  await expect(page.locator(".quick-evidence article").filter({ hasText: "포르투갈 공격 기록" })).toContainText("14/14");
  await expect(page.locator(".quick-evidence article").filter({ hasText: "우루과이 수비 상황" })).toContainText("5/6");
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
}

async function assertTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function assertNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function allocateFiveFourOne(page: Page, mode: "pointer" | "touch" | "keyboard" = "pointer") {
  for (const routine of routines) {
    const add = page.getByRole("button", { name: `${routine.name} 훈련 1회 추가` });
    for (let count = 0; count < routine.repetitions; count += 1) {
      if (mode === "touch") await add.tap();
      else if (mode === "keyboard") {
        await add.focus();
        await page.keyboard.press("Enter");
        const finalRepetition = routine.id === "other-recorded-follow-up" &&
          count === routine.repetitions - 1;
        if (finalRepetition) {
          await expect(page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" })).toBeFocused();
        } else {
          await expect(add).toBeFocused();
        }
      } else await add.click();
    }
  }
  await expect(page.getByTestId("allocation-summary")).toHaveText("10회 배분 · 0회 남음");
}

async function lockRehearsal(page: Page) {
  await page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" }).click();
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await expect(page.getByText("맞대결 기록을 보기 전에 잠갔습니다.")).toBeVisible();
  for (const routine of routines) {
    await expect(page.getByRole("button", { name: `${routine.name} 훈련 1회 추가` })).toBeDisabled();
    await expect(page.getByRole("button", { name: `${routine.name} 훈련 1회 빼기` })).toBeDisabled();
  }
}

async function revealHeldOut(page: Page) {
  await page.getByRole("button", { name: "가려 둔 맞대결 첫 전개 보기" }).click();
  const result = page.getByTestId("scouting-result");
  await expect(result).toBeFocused();
  await expect(result.locator(".user-row > span")).toHaveText(["5", "4", "1"]);
  await expect(result.locator(".actual-row > span")).toHaveText(["5", "2", "3"]);
  return result;
}

async function completeRehearsal(page: Page, mode: "pointer" | "touch" | "keyboard" = "pointer") {
  await allocateFiveFourOne(page, mode);
  await lockRehearsal(page);
  return revealHeldOut(page);
}

test("BG-01 first-fold named-team evidence, controls, and hit targets", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openInitial(page);
    await expect(page.getByText(/두 팀의 기록을 하나의 성공률로 합치지 않습니다/)).toBeVisible();
    const hiddenMatchPromise = page.getByText(/맞대결 10개 코너의 첫 전개는.*가려 둡니다/);
    if (viewport.width > 620) await expect(hiddenMatchPromise).toBeVisible();
    else {
      await expect(hiddenMatchPromise).toBeHidden();
      await expect(page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" })).toBeVisible();
    }
    await expect(page.locator('[data-routine-card="short-recorded-endpoint"]')).toContainText("7/14");
    await expect(page.locator('[data-routine-card="aerial-recorded-follow-up"]')).toContainText("5/14");
    await expect(page.locator('[data-routine-card="other-recorded-follow-up"]')).toContainText("2/14");
    for (const routine of routines) {
      await assertTarget(page.getByRole("button", { name: `${routine.name} 훈련 1회 추가` }));
      await assertTarget(page.getByRole("button", { name: `${routine.name} 훈련 1회 빼기` }));
    }
    await assertTarget(page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" }));
    await assertNoHorizontalOverflow(page);
  }
});

test("BG-02 pointer, touch, and keyboard paths create the same 5-4-1 allocation", async ({ page }, testInfo) => {
  const modes = testInfo.project.name === "mobile"
    ? ["pointer", "touch", "keyboard"] as const
    : ["pointer", "keyboard"] as const;
  for (const mode of modes) {
    await openInitial(page);
    await allocateFiveFourOne(page, mode);
    for (const routine of routines) {
      await expect(page.locator(`[data-routine-card="${routine.id}"] .allocator strong`)).toHaveText(String(routine.repetitions));
    }
  }
});

test("BG-03 one precommit hides the held-out match and freezes the allocation", async ({ page }) => {
  await openInitial(page);
  await allocateFiveFourOne(page);
  await expect(page.getByText(/우루과이–포르투갈 · 포르투갈 코너 10개/)).toHaveCount(0);
  await lockRehearsal(page);
  await expect(page.getByText(/우루과이–포르투갈 · 포르투갈 코너 10개/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "가려 둔 맞대결 첫 전개 보기" })).toBeEnabled();
  await revealHeldOut(page);
});

test("BG-04 hidden 5-2-3 reveal exposes exact differences without grading the plan", async ({ page }) => {
  await openInitial(page);
  const result = await completeRehearsal(page);
  const differences = result.locator(".difference-grid article");
  await expect(differences.filter({ hasText: "숏 구역 전달" })).toContainText("횟수 차이 0");
  await expect(differences.filter({ hasText: "비숏 · 공중 후속 기록" })).toContainText("훈련 배분이 2회 많음");
  await expect(differences.filter({ hasText: "비숏 · 기타 후속 기록" })).toContainText("실제가 2회 많음");
  await expect(result).toContainText("횟수가 같거나 비슷해도 훈련이 옳았다는 뜻은 아닙니다");
  await expect(result).toContainText("다음 회의의 질문을 찾기 위한 기록");
});

test("BG-05 player-linked receipts expose source events without inventing football roles", async ({ page }) => {
  await openInitial(page);
  const result = await completeRehearsal(page);
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
  await page.getByText("왜 이렇게 나누나요? 팀 기록과 기획 변경 보기").click();
  await expect(page.getByText(/두 역할·두 구역 선택은 팀별 정보 이득이 사라져 기각했습니다/)).toBeVisible();
  await expect(page.getByText(/제한된 자원 → 결과 전에 확정 → 가려 둔 경기 공개/)).toBeVisible();
  await page.getByText("자료·분류 규칙·판단 한계").click();
  for (const source of ["Events", "Matches", "Players", "CC BY 4.0"]) {
    await expect(page.getByRole("link", { name: source })).toBeVisible();
  }
  await expect(page.getByText(/선수 위치, 속도, 키커의 실제 발 궤적, 마킹 임무/)).toBeVisible();
});

test("BG-07 clean-profile refresh is keyless, stateless, and same-origin", async ({ page, context, baseURL }) => {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL!).origin) foreign.push(request.url());
  });
  await openInitial(page);
  await page.evaluate(() => {
    localStorage.setItem("dirty", "rehearsal");
    sessionStorage.setItem("dirty", "rehearsal");
  });
  await context.addCookies([{ name: "dirty", value: "rehearsal", domain: new URL(baseURL!).hostname, path: "/" }]);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("allocation-summary")).toHaveText("0회 배분 · 10회 남음");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations() ?? []).length)).toBe(0);
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

test("BG-08 responsive decision states and invalid data remain contained", async ({ page }) => {
  test.slow();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openInitial(page);
    await assertNoHorizontalOverflow(page);
    await completeRehearsal(page);
    await assertNoHorizontalOverflow(page);
  }
  await page.goto("http://127.0.0.1:4174");
  await expect(page.getByRole("alert")).toContainText("팀별 코너 첫 전개 기록을 열 수 없습니다");
  await assertNoHorizontalOverflow(page);
});

test("BG-09 reduced motion preserves the deterministic 5-4-1 and 5-2-3 record", async ({ page }) => {
  const snapshots: string[] = [];
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    await openInitial(page);
    const result = await completeRehearsal(page);
    snapshots.push(await result.locator(".comparison").innerText());
  }
  expect(snapshots[1]).toBe(snapshots[0]);
});

test("BG-10 axe and forced colors preserve text-labelled evidence", async ({ page }) => {
  test.slow();
  await openInitial(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const result = await completeRehearsal(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ forcedColors: "active" });
  await expect(result.locator(".difference-grid")).toContainText("횟수 차이 0");
  await expect(result.locator(".difference-grid")).toContainText("훈련 배분이 2회 많음");
  await expect(result.locator(".difference-grid")).toContainText("실제가 2회 많음");
  const invalidPage = await page.context().newPage();
  await invalidPage.goto("http://127.0.0.1:4174");
  expect((await new AxeBuilder({ page: invalidPage }).analyze()).violations).toEqual([]);
  await invalidPage.close();
});

test("BG-11 recommendation, causality, and outcome claims remain absent", async ({ page }) => {
  await openInitial(page);
  await completeRehearsal(page);
  const body = await page.locator("body").innerText();
  for (const phrase of [
    "AI 추천",
    "승률 예측",
    "최적 정책입니다",
    "강화학습이 학습했다",
    "실점을 예방했다",
    "훈련이 성공했다",
  ]) {
    expect(body).not.toContain(phrase);
  }
  await expect(page.getByText(/이 배분은 전술 추천이 아닙니다/)).toBeVisible();
  await expect(page.getByText(/훈련 효과, 수비 성공, 실점 방지, 최적 전술은 판단하지 않습니다/)).toBeVisible();
  await expect(page.getByText(/어떤 훈련 배분이 이를 막았을지는 이 데이터로 알 수 없습니다/)).toBeVisible();
});

test("BG-12 production marker binds the Policy Lab release and admitted data", async ({ page }, testInfo) => {
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
    const bindingResponse = await fetch(marker.productDataBinding.path.replace(/^public\//u, "./"), { cache: "no-store" });
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
    return { marker, texts: texts.join("\n"), release, bindingStatus: bindingResponse.status, bindingDigest, dataChecks, policyReport };
  });

  expect(evidence.marker.releaseCommit).toBe(testInfo.project.metadata.releaseCommit);
  expect(evidence.marker.buildSha256).toBe(testInfo.project.metadata.buildSha256);
  expect(evidence.release).toMatchObject({
    product_id: "corner-policy-lab",
    release_status: "stamped-final",
    manager_loop: "team-situation-rehearsal",
    causal_recommendation_status: "REJECT",
    empirical_campaign_status: "REVISE",
  });
  expect(evidence.texts).toContain("포르투갈 코너 상황 3유형.");
  expect(evidence.texts).toContain("훈련 10회를 어떻게 나눌까요?");
  expect(evidence.texts).toContain("가려 둔 맞대결 첫 전개 보기");
  expect(evidence.texts).not.toContain("test-only-invalid-artifact");
  expect(evidence.texts).not.toContain("두 역할을 어디에 둘까요?");
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
      situation_counts: {
        "short-recorded-endpoint": 7,
        "aerial-recorded-follow-up": 5,
        "other-recorded-follow-up": 2,
      },
    },
    manager_defensive_reference: {
      team_name: "Uruguay",
      source_corners: 6,
      classifiable_corners: 5,
      situation_counts: {
        "short-recorded-endpoint": 2,
        "aerial-recorded-follow-up": 2,
        "other-recorded-follow-up": 1,
      },
    },
    held_out_match: {
      match_id: 2058002,
      match_name: "Uruguay - Portugal",
      source_corners: 10,
      classifiable_corners: 10,
      situation_counts: {
        "short-recorded-endpoint": 5,
        "aerial-recorded-follow-up": 2,
        "other-recorded-follow-up": 3,
      },
      attacking_shots_within_10_seconds: 4,
    },
  });
  expect(situation.opponent_attack_reference.leading_corner_takers[0]).toMatchObject({
    display_name: "Ricardo Quaresma",
    count: 8,
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
  const add = page.getByRole("button", { name: "숏 구역 전달 훈련 1회 추가" });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(add).toBeFocused();
  await expect(page.locator('[data-routine-card="short-recorded-endpoint"] .allocator strong')).toHaveText("1");
  for (let count = 1; count < 5; count += 1) await add.click();
  for (const routine of routines.slice(1)) {
    const control = page.getByRole("button", { name: `${routine.name} 훈련 1회 추가` });
    for (let count = 0; count < routine.repetitions; count += 1) await control.click();
  }
  await lockRehearsal(page);
  const result = await revealHeldOut(page);
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

test("BG-14 screenshot transcript covers initial, allocated, and revealed states", async ({ page }, testInfo) => {
  const attachScreenshot = async (name: "artifact-initial" | "artifact-allocated" | "artifact-revealed") => {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(name, { path, contentType: "image/png" });
  };
  await openInitial(page);
  await attachScreenshot("artifact-initial");
  await allocateFiveFourOne(page);
  await attachScreenshot("artifact-allocated");
  await lockRehearsal(page);
  await revealHeldOut(page);
  await attachScreenshot("artifact-revealed");
});

test("BG-15 invalid situation data fails closed without substitute controls", async ({ page, request, baseURL }) => {
  const [publicApp, invalidApp] = await Promise.all([
    request.get(new URL("app.js", baseURL).toString()),
    request.get("http://127.0.0.1:4174/app.js"),
  ]);
  expect(publicApp.status()).toBe(200);
  expect(invalidApp.status()).toBe(200);
  expect(createHash("sha256").update(await invalidApp.body()).digest("hex"))
    .toBe(createHash("sha256").update(await publicApp.body()).digest("hex"));

  const invalidReportResponse = await request.get("http://127.0.0.1:4174/data/policy-lab-spike.json");
  const invalidReport = await invalidReportResponse.json();
  expect(invalidReport.team_scouting.status).toBe("PASS");
  expect(invalidReport.team_scouting.corner_situation_rehearsal.status).toBe("REVISE");
  await page.goto("http://127.0.0.1:4174");
  await expect(page.getByRole("alert")).toContainText("팀별 코너 첫 전개 기록을 열 수 없습니다.");
  await expect(page.getByRole("button", { name: "훈련 10회를 결과 전에 잠그기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "가려 둔 맞대결 첫 전개 보기" })).toHaveCount(0);
  await expect(page.getByTestId("scouting-result")).toHaveCount(0);
  await expect(page.locator(".routine-grid")).toHaveCount(0);
  await expect(page.getByText(/합성 결과|대체 결과/u)).toHaveCount(0);
});
