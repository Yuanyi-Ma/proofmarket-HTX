import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCodexResearchAgent } from "../src/codexResearchAgent";

function fakeCodex(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), "fake-codex-"));
  const file = join(dir, "codex");
  writeFileSync(file, `#!/bin/bash\n${script}`);
  chmodSync(file, 0o755);
  return file;
}

function fakeCodexWithLastMessage(message: string): string {
  return fakeCodex(`cat > /dev/null
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-last-message" ]; then out="$2"; shift 2; else shift; fi
done
printf '%s' '${message.replace(/'/g, "'\\''")}' > "$out"
echo "codex log line"`);
}

const context = {
  taskId: "task_001",
  question: "Survey recent research on blockchain transaction execution acceleration.",
  budgetAmount: "5",
  providerCatalog: [
    {
      providerId: "execution-research-expert",
      displayName: "Execution Research Expert Agent",
      specialties: ["parallel execution", "Block-STM"],
      price: "5 mUSDC"
    },
    {
      providerId: "shallow-search-provider",
      displayName: "Shallow Search Provider Agent",
      specialties: ["general web summaries"],
      price: "1 mUSDC"
    }
  ],
  policySummary: "Escrow + MockUSDC allowlist on Injective EVM testnet."
};

const validPlan = JSON.stringify({
  taskId: "task_001",
  recommendedProviderId: "execution-research-expert",
  reason: "自报资料覆盖与问题吻合，且链上信誉最高，交付完整简报的概率最高。",
  ranking: [
    {
      providerId: "execution-research-expert",
      reason: "链上信誉和覆盖范围最匹配。"
    },
    {
      providerId: "shallow-search-provider",
      reason: "价格较低，但挑战历史风险更高。"
    }
  ],
  maxPayment: "5",
  requiredEvidenceSchema: {
    minItems: 3,
    requiredFields: ["sourceTitle", "sourceLocator", "claim", "relevanceExplanation"]
  },
  chainActions: ["createJob", "fund", "submitEvidenceHash", "complete"]
});

describe("runCodexResearchAgent", () => {
  it("parses the last-message file instead of stdout logs", async () => {
    const bin = fakeCodexWithLastMessage(validPlan);
    const run = await runCodexResearchAgent(context, { codexBin: bin });

    expect(run.agentName).toBe("Codex CLI");
    expect(run.plan.recommendedProviderId).toBe("execution-research-expert");
    expect(run.rawStdout).toContain("codex log line");
    expect(run.attempts).toBe(1);
  });

  it("extracts JSON when Codex wraps it in a fenced block", async () => {
    const bin = fakeCodexWithLastMessage(`Here is the plan:\n\`\`\`json\n${validPlan}\n\`\`\``);
    const run = await runCodexResearchAgent(context, { codexBin: bin });

    expect(run.plan.taskId).toBe("task_001");
  });

  it("retries once then fails on invalid output", async () => {
    const bin = fakeCodexWithLastMessage('{"taskId":"task_001"}');

    await expect(runCodexResearchAgent(context, { codexBin: bin })).rejects.toThrow(
      /after retry/i
    );
  });

  it("counts attempts on flaky-then-good runs", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "fake-codex-state-"));
    const stateFile = join(stateDir, "state");
    const bin = fakeCodex(`cat > /dev/null
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-last-message" ]; then out="$2"; shift 2; else shift; fi
done
if [ ! -f ${stateFile} ]; then touch ${stateFile}; printf '%s' 'garbage' > "$out"; else printf '%s' '${validPlan.replace(/'/g, "'\\''")}' > "$out"; fi`);

    const run = await runCodexResearchAgent(context, { codexBin: bin });
    expect(run.attempts).toBe(2);
  });
});
