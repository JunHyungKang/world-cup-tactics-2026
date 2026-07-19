import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const headline = "코너 수비에 한 명 더. 역습에는 한 명 덜.";
const roleName = "역습 역할 1명을 수비 임무로 옮기기";
const duties = ["숏 코너 견제", "니어포스트 수비", "중앙·파포스트 수비", "세컨드볼 대비"];
const viewports = [
  { width: 1440, height: 900 }, { width: 768, height: 1024 },
  { width: 390, height: 844 }, { width: 320, height: 568 },
];

async function openInitial(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
}

async function snapshot(page: Page) {
  return JSON.parse(await page.getByTestId("semantic-snapshot").textContent() ?? "null");
}

async function reset(page: Page) {
  const button = page.getByRole("button", { name: "초기화", exact: true });
  if (await button.count()) await button.click();
}

async function assertTarget(locator: Locator, page: Page, viewport: { width: number; height: number }) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  const centerOwnsTarget = await locator.evaluate((element, { x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit && (hit === element || element.contains(hit)));
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 });
  expect(centerOwnsTarget).toBe(true);
}

async function assertInsideViewport(locator: Locator, viewport: { width: number; height: number }) {
  const box = await locator.boundingBox(); expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

async function dragRole(page: Page, duty: string) {
  const from = await page.getByRole("button", { name: roleName }).boundingBox();
  const to = await page.getByRole("button", { name: duty, exact: true }).boundingBox();
  expect(from).not.toBeNull(); expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 8 });
  const ghost = page.getByTestId("role-drag-ghost");
  await expect(ghost).toBeVisible();
  const ghostBox = await ghost.boundingBox();
  expect(ghostBox).not.toBeNull();
  expect(Math.abs(ghostBox!.x + ghostBox!.width / 2 - (to!.x + to!.width / 2))).toBeLessThan(2);
  expect(Math.abs(ghostBox!.y + ghostBox!.height / 2 - (to!.y + to!.height / 2))).toBeLessThan(2);
  expect(await ghost.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
  expect(await page.getByRole("button", { name: duty, exact: true }).evaluate((element, point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return hit === element || Boolean(hit && element.contains(hit));
  }, { x: to!.x + to!.width / 2, y: to!.y + to!.height / 2 })).toBe(true);
  await page.mouse.up();
  await expect(ghost).toHaveCount(0);
}

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const critical = page.locator("[data-layout-critical]");
  for (let index = 0; index < await critical.count(); index += 1) {
    const box = await critical.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  }
}

test("BG-01 first-fold bounds and hit targets", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openInitial(page);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await assertInsideViewport(page.getByRole("heading", { name: headline }), viewport);
    await assertInsideViewport(page.getByText("2018 브라질 경기 기록 · 결과 예측 아님 · 프로젝트에서 정의한 구역"), viewport);
    await assertTarget(page.getByRole("button", { name: roleName }), page, viewport);
    for (const duty of duties) await assertTarget(page.getByRole("button", { name: duty, exact: true }), page, viewport);
    await assertNoOverflow(page);
  }
});

test("BG-02 pointer touch keyboard paths", async ({ page }, testInfo) => {
  await openInitial(page);
  await dragRole(page, duties[3]);
  await expect(page.getByRole("status")).toContainText(duties[3]);
  await reset(page);
  const nativeDuty = page.getByRole("button", { name: duties[3], exact: true });
  if (["webkit", "mobile"].includes(testInfo.project.name)) await nativeDuty.tap(); else await nativeDuty.click();
  await expect(page.getByRole("status")).toContainText(duties[3]);
  await reset(page);
  const role = page.getByRole("button", { name: roleName });
  await role.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toContainText(duties[0]);
});

test("BG-03 semantic parity across inputs", async ({ page }, testInfo) => {
  await openInitial(page);
  await dragRole(page, duties[0]); const pointer = await snapshot(page);
  await reset(page);
  const nativeDuty = page.getByRole("button", { name: duties[0], exact: true });
  if (["webkit", "mobile"].includes(testInfo.project.name)) await nativeDuty.tap(); else await nativeDuty.click();
  const native = await snapshot(page);
  await reset(page); const role = page.getByRole("button", { name: roleName });
  await role.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Space"); const keyboard = await snapshot(page);
  expect(native).toEqual(pointer); expect(keyboard).toEqual(pointer);
});

test("BG-04 immutable evidence and replay prefix", async ({ page }) => {
  test.slow();
  await openInitial(page);
  const fingerprint = await page.getByTestId("evidence-fingerprint").textContent();
  const fixed = await page.getByTestId("fixed-aggregates").textContent();
  for (const duty of duties) {
    await page.getByRole("button", { name: duty, exact: true }).click();
    const next = page.getByRole("button", { name: "다음 장면", exact: true });
    for (let step = 0; step < 100; step += 1) {
      const frame = await snapshot(page);
      expect(frame.renderedEventIds).toEqual(frame.orderedEventIds.slice(0, frame.frameIndex + 1));
      if (!await next.count() || !await next.isEnabled()) break;
      await next.click();
    }
    const counter = page.getByRole("button", { name: /반례 보기/u });
    if (await counter.count()) {
      await counter.click();
      for (let step = 0; step < 100; step += 1) {
        const frame = await snapshot(page);
        expect(frame.renderedEventIds).toEqual(frame.orderedEventIds.slice(0, frame.frameIndex + 1));
        expect(await page.getByTestId("evidence-fingerprint").textContent()).toBe(fingerprint);
        expect(await page.getByTestId("fixed-aggregates").textContent()).toBe(fixed);
        const counterNext = page.getByRole("button", { name: "다음 장면", exact: true });
        if (!await counterNext.count() || !await counterNext.isEnabled()) break;
        await counterNext.click();
      }
    }
    const state = await snapshot(page);
    expect(state.renderedEventIds).toEqual(state.orderedEventIds.slice(0, state.frameIndex + 1));
    expect(await page.getByTestId("evidence-fingerprint").textContent()).toBe(fingerprint);
    expect(await page.getByTestId("fixed-aggregates").textContent()).toBe(fixed);
    await reset(page);
  }
});

test("BG-05 every duty preset or honest unavailable", async ({ page }) => {
  await openInitial(page);
  await expect(page.getByRole("button", { name: /반례 보기/u })).toHaveCount(0);
  for (const duty of duties) {
    await page.getByRole("button", { name: duty, exact: true }).click();
    const state = await snapshot(page);
    expect(state.duty).not.toBe("outlet");
    const hasPreset = state.windowId !== null;
    expect(hasPreset || await page.getByText("검증된 예시 기록이 없습니다.", { exact: true }).first().isVisible()).toBe(true);
    if (state.counterexampleWindowId === null) await expect(page.getByRole("button", { name: /반례 보기/u })).toHaveCount(0);
    else {
      const counter = page.getByRole("button", { name: /반례 보기/u });
      await expect(counter).toBeVisible(); await counter.click();
      expect((await snapshot(page)).windowKind).toBe("counterexample");
    }
    await reset(page);
  }
  expect((await snapshot(page)).duty).toBe("outlet");
});

test("BG-06 shot is marker not placeholder path", async ({ page }) => {
  test.setTimeout(120_000);
  await openInitial(page);
  for (const duty of duties) {
    await page.getByRole("button", { name: duty, exact: true }).click();
    const next = page.getByRole("button", { name: "다음 장면", exact: true });
    for (let step = 0; step < 100; step += 1) {
      expect(await page.locator('path[data-event-kind="Shot"], line[data-event-kind="Shot"]').count()).toBe(0);
      const state = await snapshot(page);
      if (state.currentEvent?.kind === "Shot") await expect(page.locator('[data-event-kind="Shot"][data-render-kind="marker"]').first()).toBeAttached();
      if (!await next.count() || !await next.isEnabled()) break;
      await next.click();
    }
    const counter = page.getByRole("button", { name: /반례 보기/u });
    if (await counter.count()) {
      await counter.click();
      const counterNext = page.getByRole("button", { name: "다음 장면", exact: true });
      for (let step = 0; step < 100; step += 1) {
        expect(await page.locator('path[data-event-kind="Shot"], line[data-event-kind="Shot"]').count()).toBe(0);
        const state = await snapshot(page);
        if (state.currentEvent?.kind === "Shot") await expect(page.locator('[data-event-kind="Shot"][data-render-kind="marker"]').first()).toBeAttached();
        if (!await counterNext.count() || !await counterNext.isEnabled()) break;
        await counterNext.click();
      }
    }
    await reset(page);
  }
});

test("BG-07 clean-profile keyless refresh", async ({ page, context, baseURL }) => {
  const errors: string[] = []; const foreign: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL!).origin) foreign.push(request.url());
  });
  await openInitial(page);
  await page.evaluate(() => { localStorage.setItem("dirty", "duty"); sessionStorage.setItem("dirty", "duty"); });
  await context.addCookies([{ name: "dirty", value: "duty", domain: new URL(baseURL!).hostname, path: "/", secure: true }]);
  await page.reload();
  expect((await snapshot(page)).duty).toBe("outlet");
  expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations() ?? []).length)).toBe(0);
  expect(foreign).toEqual([]); expect(errors).toEqual([]);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test("BG-08 responsive states and invalid fixture layout", async ({ page }) => {
  test.slow();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport); await openInitial(page); await assertNoOverflow(page);
    for (const duty of duties) {
      await page.getByRole("button", { name: duty, exact: true }).click(); await assertNoOverflow(page);
      const play = page.getByRole("button", { name: "재생", exact: true });
      if (await play.count()) {
        await play.click();
        await assertNoOverflow(page);
        const pause = page.getByRole("button", { name: "일시정지", exact: true });
        if (await pause.count()) await pause.click();
      }
      const counter = page.getByRole("button", { name: /반례 보기/u });
      if (await counter.count()) { await counter.click(); await assertNoOverflow(page); }
      await reset(page);
    }
    await page.goto("http://127.0.0.1:4174"); await assertNoOverflow(page);
  }
});

test("BG-09 reduced motion preserves stepped result", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" }); await openInitial(page);
  await page.getByRole("button", { name: duties[0], exact: true }).click();
  await page.getByRole("button", { name: "다음 장면", exact: true }).click();
  const normal = await snapshot(page);
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.reload();
  await page.getByRole("button", { name: duties[0], exact: true }).click();
  const motion = await page.locator("[data-motion]").evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element); return [style.animationDuration, style.transitionDuration];
  }));
  expect(motion.flat().every((value) => value.split(",").every((part) => Number.parseFloat(part) === 0))).toBe(true);
  await page.getByRole("button", { name: "다음 장면", exact: true }).click();
  expect(await snapshot(page)).toEqual(normal);
});

test("BG-10 axe and forced-colors states", async ({ page }) => {
  test.slow(); await openInitial(page);
  for (const duty of [null, ...duties]) {
    if (duty) await page.getByRole("button", { name: duty, exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const counter = page.getByRole("button", { name: /반례 보기/u });
    if (duty && await counter.count()) { await counter.click(); expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]); }
    if (duty) await reset(page);
  }
  await page.emulateMedia({ forcedColors: "active" });
  await page.getByRole("button", { name: duties[0], exact: true }).click();
  await expect(page.getByTestId("selected-indicator")).toContainText(/선택|✓/u);
  await page.goto("http://127.0.0.1:4174");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("BG-11 forbidden conclusions absent", async ({ page }) => {
  await openInitial(page);
  for (const duty of [null, ...duties]) {
    if (duty) await page.getByRole("button", { name: duty, exact: true }).click();
    const body = await page.locator("body").innerText();
    for (const phrase of ["막았다", "방어 성공", "예방", "최적", "승률", "xG 변화", "AI 추천"]) expect(body).not.toContain(phrase);
    await expect(page.getByText("결과 예측 아님", { exact: false }).first()).toBeVisible();
    if (duty) await reset(page);
  }
});

test("BG-12 production has no synthetic engine or fixture switch", async ({ page }, testInfo) => {
  await openInitial(page);
  const evidence = await page.evaluate(async () => {
    const marker = await (await fetch("./submission-build.json", { cache: "no-store" })).json();
    const output: string[] = [];
    for (const file of marker.files) if (/\.(?:html|js|css|json|map|txt)$/iu.test(file.path)) output.push(await (await fetch(file.path)).text());
    const bindingResponse = await fetch(marker.productDataBinding.path.replace(/^public\//u, "./"), { cache: "no-store" });
    const bindingBytes = new Uint8Array(await bindingResponse.arrayBuffer());
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bindingBytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const binding = JSON.parse(new TextDecoder().decode(bindingBytes));
    const dataChecks = [];
    for (const artifact of binding.data_files) {
      const response = await fetch(artifact.path.replace(/^public\//u, "./"), { cache: "no-store" });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const dataDigest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      dataChecks.push({ path: artifact.path, status: response.status, digest: dataDigest, expected: artifact.sha256 });
    }
    return { texts: output.join("\n"), marker, bindingStatus: bindingResponse.status, bindingDigest: digest, dataChecks };
  });
  for (const forbidden of ["evaluatePrototypeTactic", "프로토타입 로직", "압박 강도", "test-only-invalid-artifact", "bad-fixture"]) {
    expect(evidence.texts).not.toContain(forbidden);
  }
  expect(evidence.marker.releaseCommit).toBe(testInfo.project.metadata.releaseCommit);
  expect(evidence.marker.buildSha256).toBe(testInfo.project.metadata.buildSha256);
  expect(evidence.bindingStatus).toBe(200);
  expect(evidence.bindingDigest).toBe(evidence.marker.productDataBinding.sha256);
  expect(evidence.dataChecks.length).toBeGreaterThan(0);
  for (const check of evidence.dataChecks) { expect(check.status).toBe(200); expect(check.digest).toBe(check.expected); }
  for (const path of ["docs/data-scope-resolution.json", "docs/product-selection.json", "data/source-manifest.json"]) {
    expect(evidence.marker.eligibilityBindings[path]).toMatch(/^[a-f0-9]{64}$/u);
  }
});

test("BG-13 focus status replay and reset semantics", async ({ page }) => {
  await openInitial(page);
  const role = page.getByRole("button", { name: roleName }); const initial = await snapshot(page);
  await role.focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("button", { name: duties[0], exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(role).toBeFocused(); expect(await snapshot(page)).toEqual(initial);
  await page.keyboard.press("Space"); await page.keyboard.press("Space"); await expect(role).toBeFocused();
  await expect(role).not.toHaveAttribute("aria-expanded"); expect(await page.getByRole("status").count()).toBe(1);
  const announcements = (await snapshot(page)).announcementCount;
  expect(announcements).toBe(1);
  const status = await page.getByRole("status").textContent();
  await page.getByRole("button", { name: "다음 장면", exact: true }).click();
  expect(await page.getByRole("status").textContent()).toBe(status);
  expect((await snapshot(page)).announcementCount).toBe(announcements);
  await reset(page); await expect(role).toBeFocused(); expect((await snapshot(page)).duty).toBe("outlet");
});

test("BG-14 transcript synchronization and non-color focus", async ({ page }, testInfo) => {
  await openInitial(page);
  await testInfo.attach("artifact-initial", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.getByRole("button", { name: duties[0], exact: true }).click();
  await testInfo.attach("artifact-selected", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  for (let step = 0; step < 100; step += 1) {
    const state = await snapshot(page); const transcript = page.getByTestId("current-event-transcript");
    await expect(transcript).toHaveAttribute("data-source-id", state.currentEvent.sourceId);
    await expect(transcript).toHaveAttribute("data-team", state.currentEvent.team);
    await expect(transcript).toHaveAttribute("data-clock", state.currentEvent.clock);
    await expect(transcript).toHaveAttribute("data-contact", String(state.currentEvent.contact));
    await expect(transcript).toContainText(state.currentEvent.contact ? "선택 구역과 겹침" : "선택 구역과 겹치지 않음");
    const next = page.getByRole("button", { name: "다음 장면", exact: true });
    if (!await next.isEnabled()) break; await next.click();
  }
  await page.getByRole("button", { name: /반례 보기/u }).click();
  await testInfo.attach("artifact-counterexample", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  const counterexample = await snapshot(page);
  await expect(page.getByTestId("current-event-transcript")).toContainText(counterexample.currentEvent.contact ? "선택 구역과 겹침" : "선택 구역과 겹치지 않음");
  await expect(page.getByText("이 슈팅 기록에는 선택한 우선 구역과 겹치는 지점이 없습니다. 이 선택이 슈팅을 막았을지는 알 수 없습니다.")).toBeVisible();
  await expect(page.getByTestId("evidence-pitch")).toHaveAttribute("aria-hidden", "true");
  const focused = page.getByRole("button", { name: "초기화", exact: true }); await focused.focus();
  const focus = await focused.evaluate((element) => { const style = getComputedStyle(element); return `${style.outlineStyle} ${style.outlineWidth}`; });
  expect(focus).not.toMatch(/^none 0px$/u);
  const box = await focused.boundingBox(); expect(box).not.toBeNull();
  expect(await focused.evaluate((element, point) => {
    const hit = document.elementFromPoint(point.x, point.y); return hit === element || Boolean(hit && element.contains(hit));
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })).toBe(true);
});

test("BG-15 invalid data fails closed", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174");
  await expect(page.getByRole("alert")).toContainText("검증된 기록을 불러오지 못했습니다. 합성 결과를 대신 표시하지 않습니다");
  await expect(page.getByRole("button", { name: roleName })).toHaveCount(0);
  for (const duty of duties) await expect(page.getByRole("button", { name: duty, exact: true })).toHaveCount(0);
  for (const control of ["재생", "일시정지", "처음부터 재생", "이전 장면", "다음 장면", "초기화"]) {
    await expect(page.getByRole("button", { name: control, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: /반례 보기/u })).toHaveCount(0);
  await expect(page.getByTestId("evidence-receipt")).toHaveCount(0);
  await expect(page.locator("[data-evidence-panel]")).toHaveCount(0);
  await expect(page.getByText(/프로토타입|합성 점수|대체 결과/u)).toHaveCount(0);
});
