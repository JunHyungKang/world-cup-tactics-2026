import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

const headline = "조별리그에서 세우고, 토너먼트에서 검증하세요.";
const criterionName = "최소 위치 겹침률 50% 선택";
const lanes = [
  { id: "short", card: "숏 코너", pitch: "숏 코너에 주의 토큰 배치" },
  { id: "near", card: "니어포스트", pitch: "니어포스트에 주의 토큰 배치" },
  { id: "central-far", card: "중앙·파포스트", pitch: "중앙·파포스트에 주의 토큰 배치" },
  { id: "other", card: "그 밖의 전달", pitch: "그 밖의 전달에 주의 토큰 배치" },
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
  await expect(page.locator(".stage")).toHaveAttribute("data-partitions-disjoint", "true");
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

async function choosePolicy(page: Page, mode: "card" | "pitch" | "keyboard" = "card") {
  for (const lane of lanes.slice(0, 2)) {
    const control = mode === "card"
      ? page.locator(`.lane-card[data-lane="${lane.id}"]`)
      : page.getByRole("button", { name: lane.pitch });
    if (mode === "keyboard") {
      await control.focus();
      await page.keyboard.press("Enter");
      await expect(control).toBeFocused();
    } else {
      await control.click();
    }
    await expect(control).toHaveAttribute("aria-pressed", "true");
  }
  const criterion = page.getByRole("button", { name: criterionName });
  if (mode === "keyboard") {
    await criterion.focus();
    await page.keyboard.press("Space");
    await expect(criterion).toBeFocused();
  } else {
    await criterion.click();
  }
  await expect(criterion).toHaveAttribute("aria-pressed", "true");
}

async function lockPolicy(page: Page) {
  await page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" }).click();
  const receipt = page.getByTestId("lock-receipt");
  await expect(receipt).toContainText("사전 위치 겹침 기준 50%");
  return (await receipt.locator(".policy-id").innerText()).trim();
}

async function revealRoundOf16(page: Page) {
  await page.getByRole("button", { name: "16강 8경기 평가 요약 공개" }).click();
  await expect(page.getByRole("heading", { name: /16강 8경기 · 위치 겹침/ })).toBeVisible();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 미달");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 48% · 사전 기준 50%");
}

async function revealFinal(page: Page) {
  await page.getByRole("button", { name: "같은 정책으로 봉인 검증 8경기 공개" }).click();
  await expect(page.getByRole("heading", { name: /8강 이후 8경기 · 위치 겹침/ })).toBeVisible();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 충족");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 51% · 사전 기준 50%");
}

async function completePolicy(page: Page) {
  await choosePolicy(page);
  const policyId = await lockPolicy(page);
  await revealRoundOf16(page);
  await revealFinal(page);
  return policyId;
}

test("BG-01 first-fold hierarchy, controls, and hit targets", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openInitial(page);
    await expect(page.getByText("과거 기록을 활용한 위치 스트레스 테스트입니다.")).toBeVisible();
    await expect(page.locator(".pitch")).toBeVisible();
    for (const lane of lanes) await assertTarget(page.locator(`.lane-card[data-lane="${lane.id}"]`));
    for (const value of [40, 50, 60]) await assertTarget(page.getByRole("button", { name: `최소 위치 겹침률 ${value}% 선택` }));
    await assertTarget(page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" }));
    await assertTarget(page.getByRole("button", { name: "판단 보류를 두 시험에 적용" }));
    await assertNoHorizontalOverflow(page);
  }
});

test("BG-02 pointer, touch, and keyboard policy paths", async ({ page }, testInfo) => {
  await openInitial(page);
  await page.getByRole("button", { name: lanes[0].pitch }).click();
  await page.getByRole("button", { name: lanes[1].pitch }).click();
  await page.getByRole("button", { name: criterionName }).click();
  await expect(page.getByTestId("selection-count")).toHaveText("2/2");

  await openInitial(page);
  const firstCard = page.locator('.lane-card[data-lane="short"]');
  if (["webkit", "mobile"].includes(testInfo.project.name)) await firstCard.tap();
  else await firstCard.click();
  await expect(firstCard).toHaveAttribute("aria-pressed", "true");

  await openInitial(page);
  await choosePolicy(page, "keyboard");
  await expect(page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" })).toBeEnabled();
});

test("BG-03 input parity produces one deterministic policy fingerprint", async ({ page }) => {
  const fingerprints: string[] = [];
  for (const mode of ["card", "pitch", "keyboard"] as const) {
    await openInitial(page);
    await choosePolicy(page, mode);
    fingerprints.push(await lockPolicy(page));
  }
  expect(new Set(fingerprints).size).toBe(1);
});

test("BG-04 one immutable policy spans both held-out audits", async ({ page }) => {
  await openInitial(page);
  await choosePolicy(page);
  const policyId = await lockPolicy(page);
  await revealRoundOf16(page);
  await expect(page.locator(".lane-card").first()).toBeDisabled();
  await expect(page.locator(".history li")).toHaveCount(8);
  await expect(page.locator(".history li").first()).toContainText(policyId);
  await revealFinal(page);
  await expect(page.getByTestId("final-receipt")).toContainText(policyId);
  await expect(page.getByTestId("final-receipt")).toContainText("정책 변경 0회");
});

test("BG-05 abstention remains an honest no-criterion path", async ({ page }) => {
  await openInitial(page);
  await page.getByRole("button", { name: "판단 보류를 두 시험에 적용" }).click();
  await expect(page.getByTestId("lock-receipt")).toContainText("판단 보류");
  await page.getByRole("button", { name: "16강 8경기 평가 요약 공개" }).click();
  await expect(page.getByRole("heading", { name: /판단 보류 검증/ })).toBeVisible();
  await page.getByRole("button", { name: "같은 정책으로 봉인 검증 8경기 공개" }).click();
  await expect(page.getByTestId("final-receipt")).toContainText("판단 보류 정책 변경 0회");
  await expect(page.getByTestId("final-receipt")).not.toContainText("0%");
});

test("BG-06 representative contradiction exposes provenance, not causality", async ({ page }) => {
  await openInitial(page);
  await choosePolicy(page);
  await lockPolicy(page);
  await revealRoundOf16(page);
  const counterexample = page.getByTestId("counterexample");
  await expect(counterexample).toBeFocused();
  await expect(counterexample).toContainText("CornerRestart RECORDED_ACTION DeliveryAction");
  await expect(counterexample).toContainText("ObservedEvent OBSERVED_OUTCOME OutcomeProxy");
  await expect(counterexample).toContainText("ObservedEvent DERIVED_FROM Source");
  await expect(counterexample).toContainText("금지 관계: WOULD_PREVENT · OPTIMAL_POLICY");
});

test("BG-07 clean-profile refresh is keyless and same-origin", async ({ page, context, baseURL }) => {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL!).origin) foreign.push(request.url());
  });
  await openInitial(page);
  await page.evaluate(() => {
    localStorage.setItem("dirty", "policy");
    sessionStorage.setItem("dirty", "policy");
  });
  await context.addCookies([{ name: "dirty", value: "policy", domain: new URL(baseURL!).hostname, path: "/", secure: true }]);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("selection-count")).toHaveText("0/2");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations() ?? []).length)).toBe(0);
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

test("BG-08 responsive decision states and invalid artifact stay contained", async ({ page }) => {
  test.slow();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openInitial(page);
    await assertNoHorizontalOverflow(page);
    await choosePolicy(page);
    await lockPolicy(page);
    await revealRoundOf16(page);
    await assertNoHorizontalOverflow(page);
    await revealFinal(page);
    await assertNoHorizontalOverflow(page);
  }
  await page.goto("http://127.0.0.1:4174");
  await expect(page.getByRole("alert")).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test("BG-09 reduced motion preserves the deterministic receipt", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openInitial(page);
  const normalPolicy = await completePolicy(page);
  const normalReceipt = (await page.getByTestId("final-receipt").innerText()).replace(normalPolicy, "<POLICY>");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openInitial(page);
  const reducedPolicy = await completePolicy(page);
  const reducedReceipt = (await page.getByTestId("final-receipt").innerText()).replace(reducedPolicy, "<POLICY>");
  expect(reducedPolicy).toBe(normalPolicy);
  expect(reducedReceipt).toBe(normalReceipt);
});

test("BG-10 axe and forced-colors preserve non-color verdicts", async ({ page }) => {
  test.slow();
  await openInitial(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await completePolicy(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ forcedColors: "active" });
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 충족");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 51% · 사전 기준 50%");
  const invalidPage = await page.context().newPage();
  await invalidPage.goto("http://127.0.0.1:4174");
  expect((await new AxeBuilder({ page: invalidPage }).analyze()).violations).toEqual([]);
  await invalidPage.close();
});

test("BG-11 forbidden positive conclusions remain absent", async ({ page }) => {
  await openInitial(page);
  await completePolicy(page);
  const body = await page.locator("body").innerText();
  for (const phrase of ["승률", "xG 변화", "AI 추천", "최적 정책입니다", "강화학습이 학습했다", "예방했다"]) {
    expect(body).not.toContain(phrase);
  }
  await expect(page.getByText(/이 수치는 수비 성공률이 아닙니다/)).toBeVisible();
  await expect(page.getByText(/실제 선수 배치와 반사실적 경기 결과는 데이터에 없습니다/)).toBeVisible();
});

test("BG-12 production marker binds the Policy Lab release and admitted data", async ({ page }, testInfo) => {
  await openInitial(page);
  const evidence = await page.evaluate(async () => {
    const marker = await (await fetch("./submission-build.json", { cache: "no-store" })).json();
    const texts: string[] = [];
    for (const file of marker.files) {
      if (/\.(?:html|js|css|json|map|txt)$/iu.test(file.path)) texts.push(await (await fetch(file.path, { cache: "no-store" })).text());
    }
    const release = await (await fetch("./release-manifest.json", { cache: "no-store" })).json();
    const bindingResponse = await fetch(marker.productDataBinding.path.replace(/^public\//u, "./"), { cache: "no-store" });
    const bindingBytes = new Uint8Array(await bindingResponse.arrayBuffer());
    const bindingDigest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bindingBytes))]
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const binding = JSON.parse(new TextDecoder().decode(bindingBytes));
    const dataChecks = [];
    for (const artifact of binding.data_files) {
      const response = await fetch(artifact.path.replace(/^public\//u, "./"), { cache: "no-store" });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((byte) => byte.toString(16).padStart(2, "0")).join("");
      dataChecks.push({ status: response.status, digest, expected: artifact.sha256 });
    }
    return { marker, texts: texts.join("\n"), release, bindingStatus: bindingResponse.status, bindingDigest, dataChecks };
  });
  expect(evidence.marker.releaseCommit).toBe(testInfo.project.metadata.releaseCommit);
  expect(evidence.marker.buildSha256).toBe(testInfo.project.metadata.buildSha256);
  expect(evidence.release).toMatchObject({
    product_id: "corner-policy-lab",
    release_status: "stamped-final",
    causal_recommendation_status: "REJECT",
    empirical_campaign_status: "REVISE",
  });
  expect(evidence.texts).not.toContain("코너 수비에 한 명 더. 역습에는 한 명 덜.");
  expect(evidence.texts).not.toContain("test-only-invalid-artifact");
  expect(evidence.bindingStatus).toBe(200);
  expect(evidence.bindingDigest).toBe(evidence.marker.productDataBinding.sha256);
  expect(evidence.dataChecks.length).toBeGreaterThan(0);
  for (const check of evidence.dataChecks) {
    expect(check.status).toBe(200);
    expect(check.digest).toBe(check.expected);
  }
});

test("BG-13 focus, status, and immutable next-meeting semantics", async ({ page }) => {
  await openInitial(page);
  const zone = page.getByRole("button", { name: lanes[0].pitch });
  await zone.focus();
  await page.keyboard.press("Enter");
  await expect(zone).toBeFocused();
  await expect(page.getByTestId("selection-count")).toHaveText("1/2");
  await expect(page.locator("#app")).not.toHaveAttribute("aria-live");
  await page.getByRole("button", { name: lanes[1].pitch }).click();
  await page.getByRole("button", { name: criterionName }).click();
  const policyId = await lockPolicy(page);
  await revealRoundOf16(page);
  await revealFinal(page);
  const finalBefore = (await page.getByTestId("final-receipt").innerText()).trim();
  await page.getByLabel("다음 미팅에서 우선 구역 수정").check();
  await page.getByLabel("이유 (120자 이내)").fill("선택 밖 전달을 다음 미팅에서 다시 검토");
  await page.getByRole("button", { name: "다음 미팅 메모 저장" }).click();
  const note = page.getByTestId("meeting-note-receipt");
  await expect(note).toBeFocused();
  await expect(note).toContainText(`봉인 정책 ${policyId} · 정책 변경 0회 · 검증 결과는 그대로입니다.`);
  expect((await page.getByTestId("final-receipt").innerText()).trim()).toBe(finalBefore);
});

test("BG-14 screenshot transcript covers initial, selected, and counterexample", async ({ page }, testInfo) => {
  await openInitial(page);
  await testInfo.attach("artifact-initial", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await choosePolicy(page);
  await testInfo.attach("artifact-selected", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await lockPolicy(page);
  await revealRoundOf16(page);
  await revealFinal(page);
  await testInfo.attach("artifact-counterexample", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await expect(page.getByTestId("final-receipt")).toContainText("정책 변경 0회");
  await expect(page.getByTestId("counterexample")).toContainText("EVIDENCE PATH · 금지 추론 안전장치");
});

test("BG-15 invalid policy data fails closed without substitute controls", async ({ page, request, baseURL }) => {
  const [publicApp, invalidApp] = await Promise.all([
    request.get(new URL("app.js", baseURL).toString()),
    request.get("http://127.0.0.1:4174/app.js"),
  ]);
  expect(publicApp.status()).toBe(200);
  expect(invalidApp.status()).toBe(200);
  expect(createHash("sha256").update(await invalidApp.body()).digest("hex"))
    .toBe(createHash("sha256").update(await publicApp.body()).digest("hex"));
  await page.goto("http://127.0.0.1:4174");
  await expect(page.getByRole("alert")).toContainText("Policy Lab을 열 수 없습니다.");
  await expect(page.getByRole("button", { name: "이 정책을 잠가 두 시험에 적용" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "판단 보류를 두 시험에 적용" })).toHaveCount(0);
  await expect(page.getByTestId("threshold-verdict")).toHaveCount(0);
  await expect(page.getByTestId("final-receipt")).toHaveCount(0);
  await expect(page.locator(".pitch")).toHaveCount(0);
  await expect(page.getByText(/합성 결과|대체 결과/u)).toHaveCount(0);
});
