// Resume the success-path shots (05-08) for an already JobFunded task whose
// original capture browser lost the execute POST response. Server-side task
// state is authoritative; /console?taskId= re-enters the wizard at step 4.
// Usage: node capture-success-resume.mjs <taskId>
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const SHOTS =
  "/Users/luke/agents/product_designer/proofmarket/spec/proofmarket-demo/demo-shots";
const taskId = process.argv[2];
if (!taskId) throw new Error("usage: node capture-success-resume.mjs <taskId>");

const log = (m) => console.log(`[resume] ${m}`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1.5 });

const btn = (name) => page.getByRole("button", { name, exact: true });
async function waitBtn(name, timeout) {
  await btn(name).waitFor({ state: "visible", timeout });
}
async function clickBtn(name) {
  await btn(name).click();
}
async function shot(name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  log(`shot ${name}`);
}

try {
  await page.goto(`${BASE}/console?taskId=${taskId}`, { waitUntil: "networkidle" });
  await waitBtn("获取研究简报", 60_000);
  await page.waitForTimeout(800);
  await shot("05-step4-onchain-funded");

  log("run provider (submit on-chain)…");
  await clickBtn("获取研究简报");
  await waitBtn("核验简报", 360_000);
  await page.waitForTimeout(800);
  await shot("06-step5-evidence");

  log("verify…");
  await clickBtn("核验简报");
  await page.getByTestId("settle-window-note").waitFor({ state: "visible", timeout: 90_000 });
  await page.waitForTimeout(500);
  await shot("07-step6-verified");

  log("waiting out the challenge window W_c…");
  await waitBtn("确认结算", 900_000);
  await page.waitForTimeout(500);
  await shot("07b-step6-window-closed");

  log("settle (on-chain)…");
  let settled = false;
  for (let attempt = 1; attempt <= 3 && !settled; attempt++) {
    await clickBtn("确认结算");
    try {
      await page.getByText("最终回答").waitFor({ state: "visible", timeout: 200_000 });
      settled = true;
    } catch {
      log(`settle attempt ${attempt} did not land, retrying…`);
      await waitBtn("确认结算", 30_000);
    }
  }
  if (!settled) throw new Error("settle failed after 3 attempts");
  await page.waitForTimeout(800);
  await shot("08-step6-settled");
  log("DONE — success path resumed and completed");
} catch (error) {
  log(`FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
