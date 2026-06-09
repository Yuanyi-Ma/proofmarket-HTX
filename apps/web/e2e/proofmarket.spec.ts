import { expect, test, type Page } from "@playwright/test";

const buttons = {
  createTask: "Create task",
  generatePlan: "Generate procurement plan",
  submitPact: "Submit Pact",
  fundEscrow: "Fund escrow",
  runExpert: "Run expert provider",
  runShallow: "Run shallow provider",
  verifyEvidence: "Verify evidence",
  releasePayment: "Release payment",
  triggerDenial: "Trigger Cobo denial",
  winChallenge: "Win challenge",
  refundOrSlash: "Refund or slash"
} as const;

function section(page: Page, heading: string) {
  return page.locator(".section").filter({
    has: page.getByRole("heading", { name: heading })
  });
}

async function createPlannedTask(page: Page) {
  await page.goto("/");

  for (const name of Object.values(buttons)) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }

  await page.getByRole("button", { name: buttons.createTask }).click();
  await expect(page.getByText(/task_\d+ created/i)).toBeVisible();

  await page.getByRole("button", { name: buttons.generatePlan }).click();
  await expect(section(page, "Provider market").locator("[data-provider-card]")).toHaveCount(3);
  await expect(section(page, "Provider market").getByText("Recommended", { exact: true })).toBeVisible();
  await expect(section(page, "Provider market").getByText("Execution Research Expert Agent", { exact: true })).toBeVisible();
  await expect(section(page, "Procurement plan").getByText("Exactly three candidates will be shown.")).not.toBeVisible();
}

async function activatePact(page: Page) {
  await page.getByRole("button", { name: buttons.submitPact }).click();
  await expect(section(page, "Cobo Pact").getByText("active", { exact: true })).toBeVisible();
}

test.describe("ProofMarket demo task flows", () => {
  test("settles the expert provider happy path", async ({ page }) => {
    await createPlannedTask(page);
    await activatePact(page);

    await page.getByRole("button", { name: buttons.fundEscrow }).click();
    await expect(section(page, "Cobo Pact").getByText(/result funded escrow/i).first()).toBeVisible();

    await page.getByRole("button", { name: buttons.runExpert }).click();
    await expect(section(page, "Evidence package").getByText(/provider answer package/i).first()).toBeVisible();
    await expect(section(page, "Evidence package").getByText(/^0x[0-9a-f]{64}$/).first()).toBeVisible();

    await page.getByRole("button", { name: buttons.verifyEvidence }).click();
    await expect(section(page, "Evidence package").getByText("Verified").first()).toBeVisible();

    await page.getByRole("button", { name: buttons.releasePayment }).click();
    await expect(section(page, "Final answer").getByText(/payment released/i).first()).toBeVisible();
    await expect(section(page, "Final answer").getByText(/reputation increase recorded/i).first()).toBeVisible();
    await expect(
      section(page, "Execution timeline")
        .locator(".timeline-row.current")
        .filter({ hasText: "Settled" })
    ).toBeVisible();
    await expect(section(page, "Evidence package").getByText(/^0x[0-9a-f]{64}$/).first()).toBeVisible();
  });

  test("challenges shallow provider evidence and resolves refund or slash", async ({
    page
  }) => {
    await createPlannedTask(page);
    await activatePact(page);

    await page.getByRole("button", { name: buttons.fundEscrow }).click();
    await page.getByRole("button", { name: buttons.runShallow }).click();
    await page.getByRole("button", { name: buttons.verifyEvidence }).click();

    await expect(section(page, "Evidence package").getByText(/Challenged: CoverageMiss/i).first()).toBeVisible();
    await expect(section(page, "Challenge panel").getByText("CoverageMiss", { exact: true })).toBeVisible();
    await expect(section(page, "Challenge panel").getByText(/Block-STM, arXiv:2203\.06871/i).first()).toBeVisible();

    await page.getByRole("button", { name: buttons.winChallenge }).click();
    await expect(section(page, "Challenge panel").getByText(/Challenge won after provider fault verdict/i).first()).toBeVisible();

    await page.getByRole("button", { name: buttons.refundOrSlash }).click();
    await expect(section(page, "Challenge panel").getByText(/Refund or provider slash executed/i).first()).toBeVisible();
    await expect(section(page, "Challenge panel").getByText(/provider reputation decrease recorded/i)).toBeVisible();
  });

  test("records Cobo denial on a fresh pact without moving funds", async ({
    page
  }) => {
    await createPlannedTask(page);
    await activatePact(page);

    await page.getByRole("button", { name: buttons.triggerDenial }).click();

    await expect(section(page, "Cobo Pact").getByText(/rejected by\s+Cobo/i).first()).toBeVisible();
    await expect(section(page, "Cobo Pact").getByText(/non-whitelisted/i).first()).toBeVisible();
    await expect(section(page, "Cobo Pact").getByText(/moved funds:\s*0 test USDC/i)).toBeVisible();
    await expect(section(page, "Cobo Pact").getByText(/No escrow job was funded/i)).toBeVisible();
    await expect(section(page, "Cobo Pact").getByText(/amount 1 test USDC, result funded escrow/i)).not.toBeVisible();
  });
});
