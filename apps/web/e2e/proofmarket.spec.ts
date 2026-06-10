import { expect, test } from "@playwright/test";

// 驱动 fixture 模式下的 6 步向导（playwright webServer 默认不带
// PROOFMARKET_MODE=real，走本地状态机）。每一步以「下一步的主按钮可见」
// 作为完成信号——按钮在 busy 时会换文案并禁用，等下一步出现最稳。

test.describe("ProofMarket 六步向导（fixture 模式）", () => {
  test("成功路径：提问 → 方案 → 授权 → 链上采购 → 核验 → 结算完成", async ({
    page
  }) => {
    await page.goto("/");

    // 第 1 步：提出问题（问题与预算已预填）
    await expect(
      page.getByRole("heading", { name: "提出你的研究问题" })
    ).toBeVisible();
    const generatePlan = page.getByRole("button", { name: "生成采购方案" });
    await expect(generatePlan).toBeEnabled();
    await generatePlan.click();

    // 第 2 步：采购方案（创建任务后自动生成方案）
    const confirmPlan = page.getByRole("button", { name: "确认方案，去授权" });
    await expect(confirmPlan).toBeVisible();
    await expect(page.getByText("Agent 推荐").first()).toBeVisible();
    await confirmPlan.click();

    // 第 3 步：授权支付（fixture 模式 pact 自动激活）
    const executeOnchain = page.getByRole("button", { name: "执行链上采购" });
    await expect(executeOnchain).toBeVisible();
    await expect(
      page.getByText("已授权（演示钱包自动批准）").first()
    ).toBeVisible();
    await expect(executeOnchain).toBeEnabled();
    await executeOnchain.click();

    // 第 4 步：链上采购完成后可获取证据
    const getEvidence = page.getByRole("button", { name: "获取证据" });
    await expect(getEvidence).toBeVisible();
    await getEvidence.click();

    // 第 5 步：证据与核验
    const verifyEvidence = page.getByRole("button", { name: "核验证据" });
    await expect(verifyEvidence).toBeVisible();
    await expect(page.getByText("证据包哈希").first()).toBeVisible();
    await verifyEvidence.click();

    // 第 6 步：核验通过后结算
    const settle = page.getByRole("button", { name: "确认结算" });
    await expect(settle).toBeVisible();
    await settle.click();

    // 结算完成：标题「完成」+ 凭证清单
    await expect(page.getByRole("heading", { name: "完成" })).toBeVisible();
    await expect(page.getByText("凭证清单")).toBeVisible();
    await expect(page.getByText("Pact ID", { exact: true })).toBeVisible();
    await expect(page.getByText("证据包哈希").first()).toBeVisible();
    await expect(page.getByText("Verdict 哈希")).toBeVisible();

    // 操作按钮：一个「开始新任务」+ 一个「查看完整审计」
    await expect(
      page.getByRole("button", { name: "开始新任务" })
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "查看完整审计" })
    ).toBeVisible();
  });
});
