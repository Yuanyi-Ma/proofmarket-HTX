import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, renameSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.RECORD_BASE ?? "http://127.0.0.1:3002";
const WIDTH = Number(process.env.RECORD_WIDTH ?? 1440);
const HEIGHT = Number(process.env.RECORD_HEIGHT ?? 810);
const ZOOM = Number(process.env.RECORD_ZOOM ?? 1.08);
const OUT_ROOT =
  process.env.RECORD_OUT_ROOT ??
  "/Users/luke/agents/product_designer/proofmarket/spec/proofmarket-demo/recordings";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = path.join(OUT_ROOT, `raw-success-${stamp}`);
mkdirSync(OUT_DIR, { recursive: true });

const notes = [];
const log = (message) => {
  const line = `[${new Date().toISOString()}] ${message}`;
  notes.push(line);
  console.log(`[record] ${message}`);
};

async function main() {
  log(`OUT_DIR ${OUT_DIR}`);
  log(`base=${BASE} viewport=${WIDTH}x${HEIGHT} zoom=${ZOOM}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: OUT_DIR,
      size: { width: WIDTH, height: HEIGHT }
    }
  });

  await context.addInitScript((zoom) => {
    function install() {
      document.documentElement.style.zoom = String(zoom);
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
        "background:rgba(255,255,255,.86)",
        "box-shadow:0 0 0 4px rgba(37,99,235,.18),0 4px 12px rgba(15,23,42,.18)",
        "transform:translate(28px,28px)",
        "z-index:2147483647",
        "pointer-events:none",
        "transition:transform .22s ease, box-shadow .18s ease, opacity .18s ease",
        "opacity:.92"
      ].join(";");
      document.body.appendChild(cursor);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", install, { once: true });
    } else {
      install();
    }
  }, ZOOM);

  const page = await context.newPage();
  page.setDefaultTimeout(90_000);

  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      log(`BROWSER ${msg.type().toUpperCase()}: ${msg.text()}`);
    }
  });
  page.on("pageerror", (error) => log(`PAGE ERROR: ${error.message}`));

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

  async function moveCursorTo(locator) {
    const box = await locator.boundingBox();
    if (!box) return;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.evaluate(
      ({ x, y }) => {
        const cursor = document.getElementById("record-cursor");
        if (cursor) cursor.style.transform = `translate(${x - 9}px, ${y - 9}px)`;
      },
      { x, y }
    );
    await page.waitForTimeout(260);
  }

  async function pulseCursor() {
    await page.evaluate(() => {
      const cursor = document.getElementById("record-cursor");
      if (!cursor) return;
      cursor.style.boxShadow =
        "0 0 0 10px rgba(37,99,235,.28),0 4px 12px rgba(15,23,42,.18)";
      setTimeout(() => {
        cursor.style.boxShadow =
          "0 0 0 4px rgba(37,99,235,.18),0 4px 12px rgba(15,23,42,.18)";
      }, 160);
    });
  }

  async function clickLocator(locator, label) {
    await locator.waitFor({ state: "visible" });
    await moveCursorTo(locator);
    await pulseCursor();
    log(`click ${label}`);
    await locator.click();
  }

  async function clickBtn(name) {
    const locator = page.getByRole("button", { name, exact: true });
    await clickLocator(locator, name);
  }

  async function mark(label, delay = 900) {
    log(`MARK ${label} url=${page.url()}`);
    await page.waitForTimeout(delay);
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

  try {
    log("=== LANDING ===");
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await waitText("给 Agent 用的可信专业资料网络", 30_000);
    await mark("landing", 1600);

    log("=== SYSTEM STATUS ===");
    await page.goto(`${BASE}/system`, { waitUntil: "domcontentloaded" });
    await waitText("就绪检查", 90_000);
    await mark("system-status", 1800);

    log("=== SUCCESS PATH ===");
    await page.goto(`${BASE}/console`, { waitUntil: "domcontentloaded" });
    await waitBtn("生成购买方案", 30_000);
    await mark("step1-question", 1200);

    await clickBtn("生成购买方案");
    await waitForButtonOrError("确认方案，去授权", 360_000);
    await mark("step2-plan", 1800);

    await clickBtn("确认方案，去授权");
    await waitForButtonOrError("执行采购", 150_000);
    await mark("step3-pact", 1800);

    await clickBtn("测试越权防护");
    await waitText("越权操作已被 Cobo 拦截", 120_000);
    await mark("step3-denial", 2200);

    await clickBtn("执行采购");
    await waitForButtonOrError("获取研究简报", 900_000);
    await mark("step4-funded", 1800);

    await clickBtn("获取研究简报");
    await waitForButtonOrError("核验简报", 420_000);
    await mark("step5-evidence", 2200);

    await clickBtn("核验简报");
    await page.getByTestId("settle-window-note").waitFor({ state: "visible", timeout: 120_000 });
    await mark("step6-verified-window-open", 2000);

    const settle = await settleButton();
    await clickLocator(settle, "我不挑战，直接结算");
    await waitText("最终回答", 300_000);
    await mark("step6-settled", 2200);

    await clickBtn("提交评分");
    await waitText("已评分，已记入专家链上信誉", 360_000);
    await mark("step6-rated", 2200);

    log("DONE success recording");
    await context.close();
    await browser.close();

    const webm = readdirSync(OUT_DIR).find((file) => file.endsWith(".webm"));
    if (!webm) throw new Error(`no .webm found in ${OUT_DIR}`);
    const webmPath = path.join(OUT_DIR, webm);
    const finalWebm = path.join(OUT_DIR, "proofmarket-success-raw.webm");
    renameSync(webmPath, finalWebm);
    log(`VIDEO ${finalWebm}`);

    writeFileSync(
      path.join(OUT_DIR, "notes.md"),
      [
        "# ProofMarket Raw Success Recording",
        "",
        "- status: success",
        `- base: ${BASE}`,
        `- viewport: ${WIDTH}x${HEIGHT}`,
        `- zoom: ${ZOOM}`,
        `- video_webm: ${finalWebm}`,
        "",
        "## Timeline",
        "",
        ...notes.map((line) => `- ${line}`)
      ].join("\n") + "\n"
    );
    console.log(finalWebm);
  } catch (error) {
    log(`FAILED ${error?.message ?? error}`);
    await page.screenshot({ path: path.join(OUT_DIR, "failure-state.png"), fullPage: true }).catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    const webm = readdirSync(OUT_DIR).find((file) => file.endsWith(".webm"));
    if (webm) {
      const failedWebm = path.join(OUT_DIR, "proofmarket-success-raw-failed.webm");
      renameSync(path.join(OUT_DIR, webm), failedWebm);
      log(`FAILED_VIDEO ${failedWebm}`);
    }
    writeFileSync(
      path.join(OUT_DIR, "notes.md"),
      [
        "# ProofMarket Raw Success Recording",
        "",
        "- status: failed",
        `- base: ${BASE}`,
        `- viewport: ${WIDTH}x${HEIGHT}`,
        `- zoom: ${ZOOM}`,
        "",
        "## Timeline",
        "",
        ...notes.map((line) => `- ${line}`)
      ].join("\n") + "\n"
    );
    throw error;
  }
}

main().catch((error) => {
  console.error("[record] FAILED:", error?.message ?? error);
  process.exit(1);
});
