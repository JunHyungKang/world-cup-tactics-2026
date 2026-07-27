import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

const headline = /포르투갈전 코너킥 수비,\s*두 역할을 어디에 둘까요\?/u;
const criterionName = "최소 위치 겹침률 60% 선택";
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
  await expect(page.getByTestId("team-context")).toContainText("포르투갈 조별리그 14개");
  await expect(page.getByTestId("team-context")).toContainText("우루과이 수비까지 결합 · 채택 안 함");
  await expect(page.getByTestId("team-context")).toContainText("개선 확률 92.3% < 기준 97.5%");
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
  for (const lane of [lanes[0], lanes[2]]) {
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

async function lockPolicy(page: Page, staffing: "two-zones" | "outlet-kept" = "two-zones") {
  await page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" }).click();
  const receipt = page.getByTestId("lock-receipt");
  await expect(receipt).toContainText(staffing === "outlet-kept"
    ? "역습 역할 1명 전방 유지"
    : "역습 역할 1명 두 번째 수비 구역 전환");
  await expect(receipt).toContainText("통과 기준 60%");
  return (await receipt.locator(".policy-id").innerText()).trim();
}

async function revealRoundOf16(page: Page) {
  await page.getByRole("button", { name: "16강 8경기 결과 보기" }).click();
  await expect(page.getByRole("heading", { name: /16강 8경기 · 선택 구역과 겹침/ })).toBeVisible();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 충족");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 63% · 사전 기준 60%");
  const opponent = page.getByTestId("opponent-result");
  await expect(opponent).toContainText("포르투갈의 실제 코너 전달 10개");
  await expect(opponent).toContainText("감독이 고른 구역으로 9/10개가 왔습니다");
  await expect(opponent).toContainText("한 경기 기록만으로 선택이 옳았다고 판정하지 않습니다");
}

async function revealFinal(page: Page) {
  await page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }).click();
  await expect(page.getByRole("heading", { name: /8강 이후 8경기 · 선택 구역과 겹침/ })).toBeVisible();
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 미달");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 55% · 사전 기준 60%");
  await expect(page.getByTestId("opponent-result")).toHaveCount(0);
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
    await expect(page.getByText(/실제 코너 전달이 선택한 구역으로 왔는지만 확인합니다/)).toBeVisible();
    await expect(page.getByTestId("team-context")).toContainText("포르투갈 47% · 대회 전체 53%");
    await expect(page.getByTestId("forecast-audit")).toContainText("16강 예측 오차 2.14%↓ · 8강 이후 7.21%↓");
    await expect(page.getByTestId("forecast-audit")).toContainText("16팀 중 12팀 개선, 4팀 악화");
    await expect(page.locator(".pitch")).toBeVisible();
    for (const lane of lanes) await assertTarget(page.locator(`.lane-card[data-lane="${lane.id}"]`));
    await expect(page.locator('.lane-card[data-lane="short"]')).toContainText("33.5%");
    await expect(page.locator('.lane-card[data-lane="near"]')).toContainText("27.5%");
    await expect(page.locator('.lane-card[data-lane="central-far"]')).toContainText("35.5%");
    await expect(page.locator('.lane-card[data-lane="other"]')).toContainText("3.5%");
    await assertTarget(page.locator(".outlet-choice"));
    for (const value of [40, 50, 60]) await assertTarget(page.getByRole("button", { name: `최소 위치 겹침률 ${value}% 선택` }));
    await assertTarget(page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" }));
    await assertTarget(page.getByRole("button", { name: "선택을 보류하고 16경기 확인" }));
    await assertNoHorizontalOverflow(page);
  }
});

test("BG-02 pointer, touch, and keyboard policy paths", async ({ page }, testInfo) => {
  await openInitial(page);
  await page.getByRole("button", { name: lanes[0].pitch }).click();
  await page.getByRole("button", { name: lanes[2].pitch }).click();
  await page.getByRole("button", { name: criterionName }).click();
  await expect(page.getByTestId("selection-count")).toHaveText("2/2");
  await expect(page.getByTestId("role-tradeoff")).toContainText("두 역할을 수비에 배치");
  await expect(page.getByTestId("role-tradeoff")).toContainText("수비 전환");

  await openInitial(page);
  const firstCard = page.locator('.lane-card[data-lane="short"]');
  if (["webkit", "mobile"].includes(testInfo.project.name)) await firstCard.tap();
  else await firstCard.click();
  await expect(firstCard).toHaveAttribute("aria-pressed", "true");

  await openInitial(page);
  await choosePolicy(page, "keyboard");
  await expect(page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" })).toBeEnabled();
});

test("BG-03 input parity produces one deterministic policy fingerprint", async ({ page }) => {
  const fingerprints: string[] = [];
  for (const mode of ["card", "pitch", "keyboard"] as const) {
    await openInitial(page);
    await choosePolicy(page, mode);
    fingerprints.push(await lockPolicy(page));
  }
  expect(new Set(fingerprints).size).toBe(1);

  await openInitial(page);
  await page.locator('.lane-card[data-lane="central-far"]').click();
  await page.locator('.lane-card[data-lane="short"]').click();
  await page.getByRole("button", { name: criterionName }).click();
  const reverseRoleOrder = await lockPolicy(page);
  await expect(page.getByTestId("lock-receipt")).toContainText("중앙·파포스트 + 숏 코너");
  expect(reverseRoleOrder).not.toBe(fingerprints[0]);
});

test("BG-03B outlet role stays high as a complete, non-dominated manager policy", async ({ page }) => {
  await openInitial(page);
  await page.locator('.lane-card[data-lane="central-far"]').click();
  const outlet = page.getByRole("button", { name: /역습 역할 1명/u });
  await outlet.click();
  await expect(outlet).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: criterionName }).click();
  await expect(page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" })).toBeEnabled();
  const policyId = await lockPolicy(page, "outlet-kept");
  await expect(page.getByTestId("lock-receipt")).toContainText("역습 역할 1명 전방 유지");
  await page.getByRole("button", { name: "16강 8경기 결과 보기" }).click();
  await expect(page.getByRole("heading", { name: /16강 8경기 · 선택 구역과 겹침/ })).toBeVisible();
  await page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }).click();
  await expect(page.getByRole("heading", { name: /8강 이후 8경기 · 선택 구역과 겹침/ })).toBeVisible();
  await expect(page.getByTestId("role-tradeoff")).toContainText("1개 구역");
  await expect(page.getByTestId("role-tradeoff")).toContainText("전방 유지");
  await expect(page.getByTestId("final-receipt")).toContainText("역습 대기 구역 참고 기록 12/76");
  await expect(page.getByTestId("final-receipt")).toContainText("별도 기록이라 위치 겹침과 더하지 않습니다");
  await expect(page.getByTestId("final-receipt")).toContainText(policyId);
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
  await expect(page.getByTestId("final-receipt")).toContainText("선택 변경 0회");
});

test("BG-05 abstention remains an honest no-criterion path", async ({ page }) => {
  await openInitial(page);
  await page.getByRole("button", { name: "선택을 보류하고 16경기 확인" }).click();
  await expect(page.getByTestId("lock-receipt")).toContainText("판단 보류");
  await page.getByRole("button", { name: "16강 8경기 결과 보기" }).click();
  await expect(page.getByRole("heading", { name: /판단 보류 결과/ })).toBeVisible();
  await page.getByRole("button", { name: "같은 선택으로 다음 8경기 확인" }).click();
  await expect(page.getByTestId("final-receipt")).toContainText("판단 보류 · 선택 변경 0회");
  await expect(page.getByTestId("final-receipt")).not.toContainText("0%");
});

test("BG-06 representative contradiction exposes provenance, not causality", async ({ page }) => {
  await openInitial(page);
  await choosePolicy(page);
  await lockPolicy(page);
  await revealRoundOf16(page);
  const counterexample = page.getByTestId("counterexample");
  await expect(counterexample).toBeFocused();
  await expect(counterexample).toContainText("선택 밖 코너 기록");
  await expect(counterexample).toContainText("이 선택이 수비에 성공했는지, 경기 결과를 바꿨는지는 판단하지 않습니다.");
  const provenance = counterexample.getByText("이 기록의 출처와 판단 범위 보기");
  await expect(counterexample.getByText(/코너킥 → 실제 전달 위치/)).not.toBeVisible();
  await provenance.click();
  await expect(counterexample.getByText(/코너킥 → 실제 전달 위치/)).toBeVisible();
  await expect(counterexample.getByText(/자료 출처 → Pappalardo Wyscout World Cup 2018/)).toBeVisible();
  await expect(counterexample.getByText(/이 기록으로 말할 수 없음/)).toBeVisible();
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
  await expect(page.getByTestId("threshold-verdict")).toContainText("사전 기준 미달");
  await expect(page.getByTestId("threshold-verdict")).toContainText("실제 55% · 사전 기준 60%");
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
  await expect(page.getByText(/노란 역할 표시는 감독의 선택이며 실제 선수 도달/)).toBeVisible();
  await expect(page.getByText(/두 팀 결합안도 시험했지만, 근거가 약해 추천에는 쓰지 않았습니다/)).toBeVisible();
  await expect(page.getByTestId("team-context")).toContainText("95% 불확실성 구간이 0을 지나므로");
  await expect(page.getByTestId("forecast-audit")).toContainText("자동 추천하지 않음");
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
    causal_recommendation_status: "REJECT",
    empirical_campaign_status: "REVISE",
  });
  expect(evidence.texts).toContain("코너킥 수비,");
  expect(evidence.texts).toContain("두 역할을 어디에 둘까요?");
  expect(evidence.texts).toContain("수비까지 결합 · 채택 안 함");
  expect(evidence.texts).not.toContain("test-only-invalid-artifact");
  expect(evidence.bindingStatus).toBe(200);
  expect(evidence.bindingDigest).toBe(evidence.marker.productDataBinding.sha256);
  expect(evidence.dataChecks.length).toBeGreaterThan(0);
  for (const check of evidence.dataChecks) {
    expect(check.status).toBe(200);
    expect(check.digest).toBe(check.expected);
  }
  const scouting = evidence.policyReport!.team_scouting;
  expect(scouting).toMatchObject({
    status: "PASS",
    model: { selection_data: "group-stage reference only", selected_concentration: 16 },
    teams_improved: 12,
    teams_evaluated: 16,
  });
  expect(scouting.partition_scores.round_of_16.improvement.log_loss_reduction_rate).toBeCloseTo(0.0214480788, 9);
  expect(scouting.partition_scores.quarter_final_and_later.improvement.log_loss_reduction_rate).toBeCloseTo(0.0721235544, 9);
  expect(scouting.partition_scores.all_knockout.improvement.log_loss_reduction_rate).toBeCloseTo(0.0458638470, 9);
  expect(scouting.bootstrap.mean_log_score_gain_per_corner_interval.lower_95).toBeGreaterThan(0);
  expect(scouting.bootstrap.probability_gain_above_zero).toBeGreaterThanOrEqual(0.975);
  const dossier = scouting.first_fixed_round_of_16_example;
  expect(dossier).toMatchObject({
    selection_rule: "lowest source match ID in the predeclared round-of-16 partition; not selected by forecast result",
    opponent_group_stage_classified_corners: 14,
    opponent_group_stage_action_counts: { short: 7, near: 3, "central-far": 4, other: 0 },
    manager_group_stage_defensive_exposure_source_corners: 6,
    manager_group_stage_defensive_exposure_classified_corners: 5,
    defensive_exposure_is_not_pooled_into_forecast: true,
    held_out_opponent_action_counts: { short: 5, near: 1, "central-far": 4, other: 0 },
  });
  expect(dossier.opponent_evidence_weight).toBeCloseTo(0.4666666667, 9);
  expect(dossier.tournament_prior_weight).toBeCloseTo(0.5333333333, 9);
  expect(dossier.opponent_posterior_probabilities).toMatchObject({
    short: expect.closeTo(0.3354324097, 9),
    near: expect.closeTo(0.2746431570, 9),
    "central-far": expect.closeTo(0.3549958018, 9),
    other: expect.closeTo(0.0349286314, 9),
  });
  const matchup = scouting.matchup_challenger;
  expect(matchup).toMatchObject({
    status: "REJECT",
    selected: { concentration: 16, defending_weight: 0.5 },
    promotion_gates: {
      match_cluster_interval_lower_above_zero: false,
      match_cluster_probability_at_least_0975: false,
    },
  });
  expect(matchup.partition_scores.all_knockout.improvement_vs_opponent_only.log_loss_reduction_rate).toBeCloseTo(0.0101179036, 9);
  expect(matchup.bootstrap.mean_log_score_gain_per_corner_interval.lower_95).toBeLessThan(0);
  expect(matchup.bootstrap.probability_gain_above_zero).toBeCloseTo(0.9226, 4);
});

test("BG-13 focus, status, and immutable next-meeting semantics", async ({ page }) => {
  await openInitial(page);
  const zone = page.getByRole("button", { name: lanes[0].pitch });
  await zone.focus();
  await page.keyboard.press("Enter");
  await expect(zone).toBeFocused();
  await expect(page.getByTestId("selection-count")).toHaveText("1/2");
  await expect(page.locator("#app")).not.toHaveAttribute("aria-live");
  await page.getByRole("button", { name: lanes[2].pitch }).click();
  await page.getByRole("button", { name: criterionName }).click();
  const policyId = await lockPolicy(page);
  await revealRoundOf16(page);
  await revealFinal(page);
  const finalBefore = (await page.getByTestId("final-receipt").innerText()).trim();
  await page.getByLabel("다음 회의에서 우선 구역 수정").check();
  await page.getByLabel("이유 (120자 이내)").fill("선택 밖 전달을 다음 회의에서 다시 검토");
  await page.getByRole("button", { name: "다음 회의 메모 저장" }).click();
  const note = page.getByTestId("meeting-note-receipt");
  await expect(note).toBeFocused();
  await expect(note).toContainText(`처음 확정한 선택 ${policyId} · 선택 변경 0회 · 확인 결과는 그대로입니다.`);
  expect((await page.getByTestId("final-receipt").innerText()).trim()).toBe(finalBefore);
});

test("BG-14 screenshot transcript covers initial, selected, and counterexample", async ({ page }, testInfo) => {
  const attachScreenshot = async (name: "artifact-initial" | "artifact-selected" | "artifact-counterexample") => {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(name, { path, contentType: "image/png" });
  };
  await openInitial(page);
  await attachScreenshot("artifact-initial");
  await choosePolicy(page);
  await attachScreenshot("artifact-selected");
  await lockPolicy(page);
  await revealRoundOf16(page);
  await attachScreenshot("artifact-counterexample");
  await revealFinal(page);
  await expect(page.getByTestId("final-receipt")).toContainText("선택 변경 0회");
  await expect(page.getByTestId("counterexample")).toContainText("선택 밖 코너 기록");
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
  const invalidReportResponse = await request.get("http://127.0.0.1:4174/data/policy-lab-spike.json");
  const invalidReport = await invalidReportResponse.json();
  expect(invalidReport.policy_campaign.product_status).toBe("PASS");
  expect(invalidReport.team_scouting.status).toBe("PASS");
  expect(invalidReport.team_scouting.matchup_challenger.status).toBe("PASS");
  await page.goto("http://127.0.0.1:4174");
  await expect(page.getByRole("alert")).toContainText("Policy Lab을 열 수 없습니다.");
  await expect(page.getByRole("button", { name: "이 선택을 확정하고 16경기 확인" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "선택을 보류하고 16경기 확인" })).toHaveCount(0);
  await expect(page.getByTestId("threshold-verdict")).toHaveCount(0);
  await expect(page.getByTestId("final-receipt")).toHaveCount(0);
  await expect(page.locator(".pitch")).toHaveCount(0);
  await expect(page.getByText(/합성 결과|대체 결과/u)).toHaveCount(0);
});
