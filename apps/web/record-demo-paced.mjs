import { chromium } from "@playwright/test";
import {
  mkdirSync,
  writeFileSync,
  renameSync,
  readdirSync,
  readFileSync
} from "node:fs";
import path from "node:path";

const BASE = process.env.RECORD_BASE ?? "http://127.0.0.1:3002";
const WIDTH = Number(process.env.RECORD_WIDTH ?? 1280);
const HEIGHT = Number(process.env.RECORD_HEIGHT ?? 720);
const PACE = Number(process.env.RECORD_PACE ?? 1);
const OUT_ROOT =
  process.env.RECORD_OUT_ROOT ??
  "/Users/luke/agents/product_designer/proofmarket/spec/proofmarket-demo/recordings";
const ASSET_ROOT =
  "/Users/luke/agents/product_designer/proofmarket/spec/proofmarket-demo/demo-shots";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = path.join(OUT_ROOT, `paced-success-${stamp}`);
mkdirSync(OUT_DIR, { recursive: true });

const notes = [];
const log = (message) => {
  const line = `[${new Date().toISOString()}] ${message}`;
  notes.push(line);
  console.log(`[paced-record] ${message}`);
};

const ms = (value) => Math.round(value * PACE);

function imageSlideHtml(fileName, title) {
  const imagePath = path.join(ASSET_ROOT, fileName);
  const image = readFileSync(imagePath).toString("base64");
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #f7f8fa;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      img {
        display: block;
        width: min(100%, calc(100vh * 16 / 9));
        max-height: 100%;
        object-fit: contain;
        box-shadow: 0 20px 50px rgba(15, 23, 42, .08);
      }
    </style>
  </head>
  <body>
    <main>
      <img alt="${title}" src="data:image/png;base64,${image}" />
    </main>
  </body>
</html>`;
}

async function main() {
  log(`OUT_DIR ${OUT_DIR}`);
  log(`base=${BASE} viewport=${WIDTH}x${HEIGHT} pace=${PACE}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: OUT_DIR,
      size: { width: WIDTH, height: HEIGHT }
    }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(90_000);

  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      log(`BROWSER ${msg.type().toUpperCase()}: ${msg.text()}`);
    }
  });
  page.on("pageerror", (error) => log(`PAGE ERROR: ${error.message}`));

  async function installCursor() {
    await page.evaluate(() => {
      if (document.getElementById("record-cursor")) return;
      const cursor = document.createElement("div");
      cursor.id = "record-cursor";
      cursor.style.cssText = [
        "position:fixed",
        "left:0",
        "top:0",
        "width:18px",
        "height:18px",
        "border-radius:999px",
        "border:2px solid #111827",
        "background:rgba(255,255,255,.9)",
        "box-shadow:0 0 0 4px rgba(37,99,235,.18),0 4px 12px rgba(15,23,42,.18)",
        "transform:translate(30px,30px)",
        "z-index:2147483647",
        "pointer-events:none",
        "transition:box-shadow .16s ease, opacity .16s ease",
        "opacity:.92"
      ].join(";");
      document.body.appendChild(cursor);

      const place = (x, y) => {
        cursor.style.transform = `translate(${Math.round(x - 9)}px, ${Math.round(y - 9)}px)`;
      };
      document.addEventListener("mousemove", (event) => place(event.clientX, event.clientY));
      document.addEventListener("mousedown", () => {
        cursor.style.boxShadow =
          "0 0 0 10px rgba(37,99,235,.28),0 4px 12px rgba(15,23,42,.18)";
      });
      document.addEventListener("mouseup", () => {
        cursor.style.boxShadow =
          "0 0 0 4px rgba(37,99,235,.18),0 4px 12px rgba(15,23,42,.18)";
      });
    });
  }

  async function waitText(text, timeout = 90_000) {
    await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });
  }

  async function waitBtn(name, timeout = 90_000) {
    await page.getByRole("button", { name, exact: true }).waitFor({
      state: "visible",
      timeout
    });
  }

  async function settleButton() {
    const noChallenge = page.getByRole("button", {
      name: "我不挑战，直接结算",
      exact: true
    });
    if (await noChallenge.count()) return noChallenge;
    return page.getByRole("button", { name: "确认结算", exact: true });
  }

  async function pause(label, duration) {
    log(`PAUSE ${label} ${duration}ms`);
    await page.waitForTimeout(ms(duration));
  }

  async function moveMouse(x, y, steps = 24) {
    await installCursor().catch(() => {});
    await page.mouse.move(x, y, { steps });
    await page.waitForTimeout(ms(180));
  }

  async function hoverLocator(locator, label, steps = 24) {
    await locator.waitFor({ state: "visible" });
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) return;
    const x = Math.max(18, Math.min(WIDTH - 18, box.x + Math.min(box.width * 0.55, box.width - 12)));
    const y = Math.max(18, Math.min(HEIGHT - 18, box.y + Math.min(box.height * 0.55, box.height - 12)));
    log(`HOVER ${label}`);
    await moveMouse(x, y, steps);
  }

  async function clickLocator(locator, label) {
    await locator.waitFor({ state: "visible" });
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error(`no bounding box for ${label}`);
    const x = Math.max(16, Math.min(WIDTH - 16, box.x + box.width / 2));
    const y = Math.max(16, Math.min(HEIGHT - 16, box.y + box.height / 2));
    log(`CLICK ${label}`);
    await moveMouse(x, y, 30);
    await page.waitForTimeout(ms(350));
    await page.mouse.down();
    await page.waitForTimeout(ms(90));
    await page.mouse.up();
    await page.waitForTimeout(ms(450));
  }

  async function clickBtn(name) {
    await clickLocator(page.getByRole("button", { name, exact: true }), name);
  }

  async function clickLink(name) {
    await clickLocator(page.getByRole("link", { name, exact: true }).first(), name);
  }

  async function wheel(amount, steps = 4, delay = 180) {
    const each = amount / steps;
    for (let i = 0; i < steps; i += 1) {
      await page.mouse.wheel(0, each);
      await page.waitForTimeout(ms(delay));
    }
  }

  async function scrollNear(selector, label, offset = 96) {
    log(`SCROLL_NEAR ${label}`);
    await moveMouse(WIDTH - 230, Math.round(HEIGHT * 0.55), 18);
    for (let i = 0; i < 18; i += 1) {
      const state = await page.evaluate(
        ({ selector, offset }) => {
          const target = document.querySelector(selector);
          if (!target) return { found: false, delta: 0 };
          const rect = target.getBoundingClientRect();
          return {
            found: true,
            delta: rect.top - offset
          };
        },
        { selector, offset }
      );
      if (!state.found) throw new Error(`selector not found: ${selector}`);
      if (Math.abs(state.delta) < 26) break;
      await wheel(Math.max(-520, Math.min(520, state.delta)), 5, 90);
    }
    await page.waitForTimeout(ms(350));
  }

  async function humanScroll(amount, label, hold = 1000) {
    log(`SCROLL ${label}`);
    await moveMouse(WIDTH - 210, Math.round(HEIGHT * 0.56), 18);
    await wheel(amount, Math.max(3, Math.ceil(Math.abs(amount) / 180)), 120);
    await pause(label, hold);
  }

  async function mark(label, delay = 900) {
    log(`MARK ${label} url=${page.url()}`);
    await pause(label, delay);
  }

  async function waitForButtonOrError(name, timeout = 240_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const buttonCount = await page.getByRole("button", { name, exact: true }).count();
      if (buttonCount > 0) return;
      const body = await page.locator("main").textContent().catch(() => "");
      if (body?.includes("请求出错") || body?.includes("路由错误")) {
        throw new Error(`page error while waiting for ${name}: ${body.slice(0, 500)}`);
      }
      await page.waitForTimeout(2000);
    }
    throw new Error(`timeout waiting for button: ${name}`);
  }

  async function showOpeningSlides() {
    log("=== OPENING SLIDE 1 ===");
    await page.setContent(imageSlideHtml("14-opening-evidence-gap.png", "开场 · 断裂的证据桥"));
    await pause("opening-evidence-gap", 24_000);

    log("=== OPENING SLIDE 2 ===");
    await page.setContent(imageSlideHtml("15-opening-proofmarket-network.png", "开场 · ProofMarket 专家网络"));
    await pause("opening-proofmarket-network", 26_000);
  }

  async function showLanding() {
    log("=== LANDING ===");
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await waitText("给 Agent 用的可信专业资料网络", 30_000);
    await installCursor();
    await moveMouse(150, 150, 16);
    await mark("landing-hero", 6500);
    await hoverLocator(page.locator(".lp-param-card"), "协议参数卡片");
    await pause("landing-protocol-params", 5500);

    await scrollNear(".lp-stats-band", "平台数据");
    await pause("landing-stats", 6500);
    await scrollNear("#providers", "专家与资料库");
    await pause("landing-provider-intro", 4500);
    await hoverLocator(page.locator(".lp-table tbody tr").first(), "第一位专家");
    await pause("landing-provider-row-1", 5000);
    await humanScroll(360, "更多专家", 5500);
    await scrollNear("#how", "工作原理");
    await pause("landing-how-it-works", 4500);
    await clickLink("系统状态");
  }

  async function showSystemStatus() {
    log("=== SYSTEM STATUS ===");
    await waitText("系统状态", 90_000);
    await waitText("就绪检查", 90_000);
    await installCursor();
    await mark("system-ready-check", 6500);
    await scrollNear("section:nth-of-type(2)", "合约与协议参数");
    await pause("system-contracts", 6500);
    await scrollNear("section[aria-label='陪审团']", "AI 陪审团");
    await pause("system-jury", 8500);
    await humanScroll(420, "陪审方细节", 5000);
    await scrollNear("section[aria-label='领域专家']", "领域专家");
    await pause("system-providers", 5500);
    await clickLink("进入控制台");
  }

  async function showStep1() {
    log("=== STEP 1 ===");
    await waitBtn("生成购买方案", 30_000);
    await installCursor();
    await mark("step1-question", 6500);
    await hoverLocator(page.getByRole("textbox", { name: "研究问题" }), "研究问题输入框");
    await pause("step1-question-field", 2500);
    await hoverLocator(page.getByRole("textbox", { name: "预算上限" }), "预算上限输入框");
    await pause("step1-budget-field", 1800);
    await clickBtn("生成购买方案");
  }

  async function showStep2() {
    log("=== STEP 2 ===");
    await waitForButtonOrError("确认方案，去授权", 360_000);
    await mark("step2-plan-summary", 6500);
    await scrollNear(".candidate-list", "候选专家列表");
    await pause("step2-candidates", 7500);
    await hoverLocator(page.locator('[data-provider-row="execution-research-expert"]'), "推荐专家");
    await pause("step2-recommended-expert", 4500);
    await humanScroll(360, "购买条款", 4500);
    await clickBtn("确认方案，去授权");
  }

  async function showStep3() {
    log("=== STEP 3 ===");
    await waitForButtonOrError("执行采购", 150_000);
    await mark("step3-policy-summary", 7500);
    await humanScroll(360, "受限签名策略", 4000);
    await clickBtn("测试越权防护");
    await waitText("越权操作已被受限签名器拒签", 120_000);
    await mark("step3-denial", 6500);
    await humanScroll(420, "查看拦截详情", 3500);
    await clickBtn("执行采购");
  }

  async function showStep4() {
    log("=== STEP 4 ===");
    await waitForButtonOrError("获取研究简报", 900_000);
    await mark("step4-onchain-funded", 7500);
    await humanScroll(460, "交易记录", 6500);
    await clickBtn("获取研究简报");
  }

  async function showStep5() {
    log("=== STEP 5 ===");
    await waitForButtonOrError("核验简报", 420_000);
    await mark("step5-brief-summary", 6500);
    await scrollNear(".evidence-items-list", "来源条目");
    await pause("step5-sources", 7500);
    await scrollNear("[data-testid='agent-spot-check']", "我方 Agent 抽查核验");
    await pause("step5-spot-check", 7500);
    await humanScroll(400, "链上存证", 4500);
    await clickBtn("核验简报");
  }

  async function showStep6() {
    log("=== STEP 6 ===");
    await page.getByTestId("settle-window-note").waitFor({ state: "visible", timeout: 120_000 });
    await mark("step6-verified-window-open", 7500);
    const settle = await settleButton();
    await hoverLocator(settle, "不挑战直接结算按钮");
    await pause("step6-no-challenge-choice", 3500);
    await clickLocator(settle, "我不挑战，直接结算");
    await waitText("最终回答", 300_000);
    await mark("step6-settled-answer", 6500);
    await scrollNear("[data-testid='rating-panel']", "服务评分");
    await pause("step6-rating-panel", 5000);
    await clickBtn("提交评分");
    await waitText("已评分，已记入专家链上信誉", 360_000);
    await mark("step6-rated", 6500);
    await humanScroll(420, "交易与凭证", 4500);
  }

  async function closeAndPersist(status, error = null) {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});

    const webm = readdirSync(OUT_DIR).find((file) => file.endsWith(".webm"));
    let finalWebm = null;
    if (webm) {
      finalWebm = path.join(
        OUT_DIR,
        status === "success"
          ? "proofmarket-paced-raw.webm"
          : "proofmarket-paced-raw-failed.webm"
      );
      renameSync(path.join(OUT_DIR, webm), finalWebm);
      log(`${status === "success" ? "VIDEO" : "FAILED_VIDEO"} ${finalWebm}`);
    }

    writeFileSync(
      path.join(OUT_DIR, "notes.md"),
      [
        "# ProofMarket Paced Raw Recording",
        "",
        `- status: ${status}`,
        `- base: ${BASE}`,
        `- viewport: ${WIDTH}x${HEIGHT}`,
        `- pace: ${PACE}`,
        finalWebm ? `- video_webm: ${finalWebm}` : "- video_webm: null",
        error ? `- error: ${error?.message ?? error}` : null,
        "",
        "## Timeline",
        "",
        ...notes.map((line) => `- ${line}`)
      ]
        .filter(Boolean)
        .join("\n") + "\n"
    );
    if (finalWebm) console.log(finalWebm);
  }

  try {
    await showOpeningSlides();
    await showLanding();
    await showSystemStatus();
    await showStep1();
    await showStep2();
    await showStep3();
    await showStep4();
    await showStep5();
    await showStep6();

    log("DONE paced success recording");
    await closeAndPersist("success");
  } catch (error) {
    log(`FAILED ${error?.message ?? error}`);
    await page.screenshot({ path: path.join(OUT_DIR, "failure-state.png"), fullPage: true }).catch(() => {});
    await closeAndPersist("failed", error);
    throw error;
  }
}

main().catch((error) => {
  console.error("[paced-record] FAILED:", error?.message ?? error);
  process.exit(1);
});
