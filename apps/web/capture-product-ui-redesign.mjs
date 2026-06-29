import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.CAPTURE_BASE ?? "http://127.0.0.1:3100";
const SHOTS =
  "/Users/luke/agents/product_designer/proofmarket/spec/proofmarket-demo/product-ui-redesign-shots";

mkdirSync(SHOTS, { recursive: true });

const log = (message) => console.log(`[capture] ${message}`);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1480, height: 1000 },
    deviceScaleFactor: 2
  });
  page.setDefaultTimeout(60_000);

  const shot = async (name) => {
    await page.screenshot({
      path: path.join(SHOTS, `${name}.png`),
      fullPage: true
    });
    log(`shot ${name}`);
  };
  const clickBtn = (name) =>
    page.getByRole("button", { name, exact: true }).click();
  const waitBtn = (name, timeout = 60_000) =>
    page.getByRole("button", { name, exact: true }).waitFor({
      state: "visible",
      timeout
    });
  const settleBtn = () =>
    page.getByRole("button", { name: /^(我不挑战，直接结算|确认结算)$/ });
  const clickSettle = () => settleBtn().click();
  const waitSettle = (timeout = 60_000) =>
    settleBtn().waitFor({ state: "visible", timeout });
  const waitText = (text, timeout = 60_000) =>
    page.getByText(text, { exact: false }).first().waitFor({
      state: "visible",
      timeout
    });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await waitText("给 Agent 用的专业研究采购市场");
  await page.waitForTimeout(250);
  await shot("00-landing");

  await page.goto(`${BASE}/system`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("00-system-init");

  await page.goto(`${BASE}/console`, { waitUntil: "networkidle" });
  await waitBtn("生成购买方案");
  await page.waitForTimeout(250);
  await shot("01-step1-question");

  await clickBtn("生成购买方案");
  await waitBtn("确认方案，去授权");
  await page.waitForTimeout(350);
  await shot("02-step2-plan-candidates");

  await clickBtn("确认方案，去授权");
  await waitBtn("执行采购");
  await page.waitForTimeout(300);
  await shot("03-step3-policy-active");

  await clickBtn("测试越权防护");
  await waitText("越权操作已被受限签名器拒签");
  await page.waitForTimeout(300);
  await shot("04-step3-denial");

  await clickBtn("执行采购");
  await waitBtn("获取研究简报");
  await page.waitForTimeout(300);
  await shot("05-step4-onchain-funded");

  await clickBtn("获取研究简报");
  await waitBtn("核验简报");
  await page.waitForTimeout(350);
  await shot("06-step5-evidence");

  await clickBtn("核验简报");
  await page.getByTestId("settle-window-note").waitFor({
    state: "visible",
    timeout: 60_000
  });
  await page.waitForTimeout(300);
  await shot("07-step6-verified");

  await waitSettle(120_000);
  await page.waitForTimeout(250);
  await shot("07b-step6-settle-ready");

  await clickSettle();
  await waitText("最终回答");
  await page.waitForTimeout(350);
  await shot("08-step6-settled");

  await clickBtn("提交评分");
  await waitText("已评分");
  await page.waitForTimeout(350);
  await shot("09-step6-rated");

  await page.goto(`${BASE}/console`, { waitUntil: "networkidle" });
  await waitBtn("生成购买方案");
  await clickBtn("生成购买方案");
  await waitBtn("确认方案，去授权");
  await page
    .locator('[data-provider-row="shallow-search-provider"] input[type="radio"]')
    .click();
  await page.waitForTimeout(250);
  await shot("10-challenge-step2-select-shallow");

  await clickBtn("确认方案，去授权");
  await waitBtn("执行采购");
  await clickBtn("执行采购");
  await waitBtn("获取研究简报");
  await clickBtn("获取研究简报");
  await waitBtn("核验简报");
  await page.waitForTimeout(350);
  await shot("10b-challenge-branch-point");

  await clickBtn("生成挑战包，发起挑战");
  await waitBtn("请求陪审团裁决", 120_000);
  await page.getByTestId("defense-card").waitFor({
    state: "visible",
    timeout: 60_000
  });
  await page.waitForTimeout(350);
  await shot("11-challenge-opened-materials");

  await clickBtn("请求陪审团裁决");
  await page.waitForTimeout(1_000);
  await shot("11b-jury-deliberating");
  await waitText("陪审团投票", 180_000);
  await page.waitForTimeout(350);
  await shot("12-challenge-vote");

  await page.getByRole("button", { name: /执行裁决/ }).click();
  await waitText("裁决已执行", 180_000);
  await page.waitForTimeout(350);
  await shot("13-challenge-resolved");

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true
  });
  mobile.setDefaultTimeout(60_000);
  const mobileShot = async (name) => {
    await mobile.screenshot({
      path: path.join(SHOTS, `${name}.png`),
      fullPage: true
    });
    log(`shot ${name}`);
  };
  await mobile.goto(`${BASE}/console`, { waitUntil: "networkidle" });
  await mobile
    .getByRole("button", { name: "生成购买方案", exact: true })
    .waitFor({ state: "visible" });
  await mobileShot("m-01-step1-question");
  await mobile
    .getByRole("button", { name: "生成购买方案", exact: true })
    .click();
  await mobile
    .getByRole("button", { name: "确认方案，去授权", exact: true })
    .waitFor({ state: "visible" });
  await mobileShot("m-02-step2-plan-candidates");
  await mobile.close();

  await browser.close();

  const files = readdirSync(SHOTS).filter((file) => file.endsWith(".png")).sort();
  log(`DONE — ${files.length} screenshots in ${SHOTS}`);
}

main().catch((error) => {
  console.error("[capture] FAILED:", error?.message ?? error);
  process.exit(1);
});
