import { expect, test } from "@playwright/test";

// Drives the six-step wizard in fixture mode. Each step waits for the next
// primary action to become visible because busy states change button labels.

test.describe("ProofMarket six-step wizard (fixture mode)", () => {
  test("happy path: question → plan → authorization → purchase → verification → settlement", async ({
    page
  }) => {
    await page.goto("/console");

    await expect(
      page.getByRole("heading", { name: "Ask Your Research Question" })
    ).toBeVisible();
    const generatePlan = page.getByRole("button", { name: "Generate Procurement Plan" });
    await expect(generatePlan).toBeEnabled();
    await generatePlan.click();

    const confirmPlan = page.getByRole("button", { name: "Confirm Plan and Authorize" });
    await expect(confirmPlan).toBeVisible();
    await expect(page.getByText("Purchase decision").first()).toBeVisible();
    await confirmPlan.click();

    const executeOnchain = page.getByRole("button", { name: "Execute Purchase" });
    await expect(executeOnchain).toBeVisible();
    await expect(
      page.getByText("Authorization active").first()
    ).toBeVisible();
    await expect(executeOnchain).toBeEnabled();
    await executeOnchain.click();

    const getEvidence = page.getByRole("button", { name: "Get Evidence Package" });
    await expect(getEvidence).toBeVisible();
    await getEvidence.click();

    const verifyEvidence = page.getByRole("button", { name: "Verify Evidence" });
    await expect(verifyEvidence).toBeVisible();
    await expect(page.getByText("Package hash").first()).toBeVisible();
    await verifyEvidence.click();

    const settle = page.getByRole("button", { name: /^(Settle Now|Confirm Settlement)$/ });
    await expect(settle).toBeVisible();
    await settle.click();

    await expect(page.getByRole("heading", { name: "Settlement" })).toBeVisible();
    await expect(page.getByText("Final Answer", { exact: true })).toBeVisible();
    await page.getByText("Transactions and Receipts").click();
    await expect(page.getByText("Policy ID", { exact: true })).toBeVisible();
    await expect(page.getByText("Package hash").first()).toBeVisible();
    await expect(page.getByText("Verdict hash")).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Start New Task" })
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "View Full Audit" })
    ).toBeVisible();
  });
});
