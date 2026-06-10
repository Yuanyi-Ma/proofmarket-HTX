/**
 * Headless driver for the REAL deterministic challenge path against Sepolia.
 * Drives a fresh task to Delivered, then walks the challenge:
 *   openChallenge -> winChallenge (resolver vote) -> refundOrSlash (on-chain resolve).
 * Server must be running with PROOFMARKET_MODE=real. WEB_URL overrides localhost:3000.
 */
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

type TaskLike = {
  id: string;
  status: string;
  plan?: { recommendedProviderId?: string } | null;
  challenge?: Record<string, unknown> | null;
  txRecords?: Array<{ label: string; txHash: string; status: string }>;
  audit?: Array<{ type: string; message: string }>;
};

async function readTaskResponse(response: Response): Promise<TaskLike> {
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : text || `HTTP ${response.status}`;
    console.error(`HTTP ${response.status} from ${response.url}:\n${message}`);
    process.exit(1);
  }
  return payload as TaskLike;
}

function post(path: string, body: unknown = {}): Promise<Response> {
  return fetch(`${WEB_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function tx(label: string, hash: string): string {
  return `        ${label}: ${hash} → https://sepolia.etherscan.io/tx/${hash}`;
}

async function main() {
  console.log("=== ProofMarket Real-Mode Challenge Driver ===");
  console.log(`Web: ${WEB_URL}\n`);

  console.log("[1] Create task");
  let task = await readTaskResponse(await post("/api/tasks", { question: "请调研近几年区块链交易执行加速的最新研究进展。", budget: "5 test USDC" }));
  const id = task.id;
  console.log(`      task=${id} status=${task.status}`);

  console.log("[2] Plan");
  task = await readTaskResponse(await post(`/api/tasks/${id}/plan`));
  const providerId = task.plan?.recommendedProviderId ?? "execution-research-expert";
  console.log(`      provider=${providerId}`);

  console.log("[3] Pact");
  task = await readTaskResponse(await post(`/api/tasks/${id}/pact`));
  for (let i = 0; i < 30 && task.status !== "PactActive"; i += 1) {
    await new Promise((r) => setTimeout(r, 10000));
    task = await readTaskResponse(await post(`/api/tasks/${id}/pact-status`));
    if (task.status !== "PactActive") console.log("      waiting for Cobo approval…");
  }
  console.log(`      status=${task.status}`);

  console.log("[4] Execute escrow (4 txs)");
  task = await readTaskResponse(await post(`/api/tasks/${id}/execute`));
  for (const r of task.txRecords ?? []) console.log(tx(r.label, r.txHash));
  console.log(`      status=${task.status}`);

  console.log("[5] Provider (deliver evidence)");
  task = await readTaskResponse(await post(`/api/tasks/${id}/provider`, { providerId }));
  console.log(`      status=${task.status}`);

  console.log("[6] Open challenge (lock deposit + freeze job)");
  task = await readTaskResponse(await post(`/api/tasks/${id}/open-challenge`));
  for (const r of task.txRecords ?? []) if (["approveDeposit", "openChallenge"].includes(r.label)) console.log(tx(r.label, r.txHash));
  console.log(`      status=${task.status} challenge=${JSON.stringify(task.challenge)}`);

  console.log("[7] Request vote (deterministic ProviderFault)");
  task = await readTaskResponse(await post(`/api/tasks/${id}/challenge-win`));
  console.log(`      status=${task.status}`);

  console.log("[8] Resolve (slash stake + refund buyer + return deposit)");
  task = await readTaskResponse(await post(`/api/tasks/${id}/refund-or-slash`));
  for (const r of task.txRecords ?? []) if (r.label === "resolve") console.log(tx(r.label, r.txHash));
  console.log(`      status=${task.status}`);

  console.log("\n=== Audit ===");
  for (const e of task.audit ?? []) console.log(`  ${e.type}: ${e.message}`);
  console.log(`\nDone. Final status: ${task.status}. Audit: data/demo-state/audit-${id}.jsonl`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
