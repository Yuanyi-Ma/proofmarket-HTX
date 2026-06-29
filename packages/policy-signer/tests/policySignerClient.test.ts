import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { buildRealPolicySubmission } from "../src/policy";
import { createLocalPolicySignerClient } from "../src/policySignerClient";

const escrowAddress = `0x${"4".repeat(40)}`;
const tokenAddress = `0x${"3".repeat(40)}`;
const disallowedAddress = `0x${"d".repeat(40)}`;

const submission = buildRealPolicySubmission({
  escrowAddress,
  tokenAddress,
  budgetAmount: "5",
  taskId: "task_001"
});

describe("createLocalPolicySignerClient", () => {
  it("submits a policy and returns an active policy id", async () => {
    const client = createLocalPolicySignerClient();
    const result = await client.submitPolicy(submission);

    expect(result.policyId).toBe("policy_001");
    expect(result.status).toBe("active");
    expect(result.raw).not.toContain("Cobo");
  });

  it("signs an allowed contract call and exposes the transaction hash by request id", async () => {
    const client = createLocalPolicySignerClient();
    const policy = await client.submitPolicy(submission);
    const call = await client.callContract({
      policyId: policy.policyId,
      contract: escrowAddress,
      calldata: "0xdeadbeef",
      requestId: "task_001-createJob-0",
      description: "createJob"
    });
    const tx = await client.getTx(call.policySignerRequestId);

    expect(call.policySignerRequestId).toBe("task_001-createJob-0");
    expect(tx.parsed.tx_hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(tx.raw).toContain("task_001-createJob-0");
  });

  it("refuses to sign a non-whitelisted contract call", async () => {
    const client = createLocalPolicySignerClient();
    const policy = await client.submitPolicy(submission);

    await expect(
      client.callContract({
        policyId: policy.policyId,
        contract: disallowedAddress,
        calldata: "0x00",
        requestId: "bad-target",
        description: "transfer"
      })
    ).rejects.toThrow(/outside the policy allowlist/);
  });

  it("refuses to sign after the policy transaction cap is reached", async () => {
    const client = createLocalPolicySignerClient();
    const policy = await client.submitPolicy(submission);

    for (let index = 0; index < 10; index += 1) {
      await client.callContract({
        policyId: policy.policyId,
        contract: tokenAddress,
        calldata: "0x00",
        requestId: `allowed-${index}`,
        description: "approve"
      });
    }

    await expect(
      client.callContract({
        policyId: policy.policyId,
        contract: tokenAddress,
        calldata: "0x00",
        requestId: "over-cap",
        description: "approve"
      })
    ).rejects.toThrow(/reached 10 transactions/);
  });

  it("refuses to sign expired policies", async () => {
    let now = 1_000;
    const client = createLocalPolicySignerClient({ now: () => now });
    const policy = await client.submitPolicy(submission);

    now += 5_401_000;

    await expect(
      client.callContract({
        policyId: policy.policyId,
        contract: escrowAddress,
        calldata: "0x00",
        requestId: "expired",
        description: "createJob"
      })
    ).rejects.toThrow(/expired/);
    await expect(client.getPolicyStatus(policy.policyId)).resolves.toMatchObject({
      status: "expired"
    });
  });

  it("records a direct-transfer refusal without signing a transaction", async () => {
    const client = createLocalPolicySignerClient();
    const policy = await client.submitPolicy(submission);

    const denial = await client.attemptDeniedTransfer({
      policyId: policy.policyId,
      dstAddress: disallowedAddress,
      amount: "0.001"
    });

    expect(denial).toMatchObject({
      denied: true,
      exitCode: 403,
      attemptedAction: `tx transfer 0.001 SETH -> ${disallowedAddress}`
    });
    expect(denial.rawOutput).toContain("direct transfer refused before signing");
  });

  it("fails fast when the configured signer address does not match the private key", () => {
    expect(() =>
      createLocalPolicySignerClient({
        privateKey: `0x${"1".repeat(64)}`,
        srcAddress: `0x${"2".repeat(40)}`
      })
    ).toThrow(/does not match configured signer address/);
  });

  it("records Injective EVM testnet chain metadata when configured", async () => {
    const privateKey = `0x${"1".repeat(64)}` as const;
    const account = privateKeyToAccount(privateKey);
    const client = createLocalPolicySignerClient({
      privateKey,
      srcAddress: account.address,
      chainId: 1439
    });

    const policy = await client.submitPolicy(submission);
    const raw = JSON.parse(policy.raw) as { chainId: number; chainName: string };

    expect(raw.chainId).toBe(1439);
    expect(raw.chainName).toBe("Injective EVM Testnet");
  });

  it("labels denied direct transfers with Injective native INJ when configured", async () => {
    const privateKey = `0x${"1".repeat(64)}` as const;
    const account = privateKeyToAccount(privateKey);
    const client = createLocalPolicySignerClient({
      privateKey,
      srcAddress: account.address,
      chainId: 1439
    });
    const policy = await client.submitPolicy(submission);

    const denial = await client.attemptDeniedTransfer({
      policyId: policy.policyId,
      dstAddress: disallowedAddress,
      amount: "0.001"
    });

    expect(denial.attemptedAction).toBe(`tx transfer 0.001 INJ -> ${disallowedAddress}`);
  });
});
