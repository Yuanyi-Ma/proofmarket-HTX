import { describe, expect, it } from "vitest";
import { encodeEventTopics } from "viem";
import { escrowAbi } from "../src/escrowAbi";
import { createChainReader } from "../src/chainReader";
import type { TransactionReceipt, Log } from "viem";

const addr = (c: string) => `0x${c.padEnd(40, "0")}` as `0x${string}`;
const escrowAddr = addr("cafe");
const clientAddr = addr("c1");
const providerAddr = addr("c2");
const otherAddr = addr("dead");

/** Build a minimal synthetic TransactionReceipt */
function makeReceipt(logs: Log[]): TransactionReceipt {
  return {
    transactionHash: "0xabc" as `0x${string}`,
    blockHash: "0x0" as `0x${string}`,
    blockNumber: 1n,
    contractAddress: null,
    cumulativeGasUsed: 0n,
    effectiveGasPrice: 0n,
    from: clientAddr,
    gasUsed: 0n,
    logs,
    logsBloom: "0x0" as `0x${string}`,
    status: "success",
    to: escrowAddr,
    transactionIndex: 0,
    type: "eip1559",
    blobGasPrice: undefined,
    blobGasUsed: undefined,
    root: undefined
  } as unknown as TransactionReceipt;
}

describe("extractJobId", () => {
  const reader = createChainReader("http://localhost:8545");

  it("extracts jobId 7n from a JobCreated log", () => {
    const topics = encodeEventTopics({
      abi: escrowAbi,
      eventName: "JobCreated",
      args: { jobId: 7n, client: clientAddr, provider: providerAddr }
    });

    const matchingLog: Log = {
      address: escrowAddr,
      data: "0x" as `0x${string}`,
      topics: topics as [`0x${string}`, ...`0x${string}`[]],
      blockHash: "0x0" as `0x${string}`,
      blockNumber: 1n,
      logIndex: 0,
      removed: false,
      transactionHash: "0xabc" as `0x${string}`,
      transactionIndex: 0
    };

    // Unrelated log from a different contract
    const unrelatedLog: Log = {
      address: otherAddr,
      data: "0x" as `0x${string}`,
      topics: topics as [`0x${string}`, ...`0x${string}`[]],
      blockHash: "0x0" as `0x${string}`,
      blockNumber: 1n,
      logIndex: 1,
      removed: false,
      transactionHash: "0xabc" as `0x${string}`,
      transactionIndex: 0
    };

    const receipt = makeReceipt([unrelatedLog, matchingLog]);
    expect(reader.extractJobId(receipt, escrowAddr)).toBe(7n);
  });

  it("ignores logs from a different contract address", () => {
    const topics = encodeEventTopics({
      abi: escrowAbi,
      eventName: "JobCreated",
      args: { jobId: 7n, client: clientAddr, provider: providerAddr }
    });

    const wrongAddrLog: Log = {
      address: otherAddr,
      data: "0x" as `0x${string}`,
      topics: topics as [`0x${string}`, ...`0x${string}`[]],
      blockHash: "0x0" as `0x${string}`,
      blockNumber: 1n,
      logIndex: 0,
      removed: false,
      transactionHash: "0xabc" as `0x${string}`,
      transactionIndex: 0
    };

    const receipt = makeReceipt([wrongAddrLog]);
    expect(() => reader.extractJobId(receipt, escrowAddr)).toThrow(/No JobCreated/);
  });

  it("throws when no JobCreated log exists", () => {
    const receipt = makeReceipt([]);
    expect(() => reader.extractJobId(receipt, escrowAddr)).toThrow(/No JobCreated/);
  });

  it("skips a JobFunded log from the escrow address and returns jobId from the later JobCreated log", () => {
    // JobFunded is a known ABI event — decodeEventLog succeeds and returns eventName "JobFunded",
    // which is not "JobCreated" so it is skipped without throwing. This pins the
    // "skip sibling events that decode cleanly but aren't JobCreated" path.
    const fundedTopics = encodeEventTopics({
      abi: escrowAbi,
      eventName: "JobFunded",
      args: { jobId: 42n }
    });
    const jobFundedLog: Log = {
      address: escrowAddr,
      // Non-indexed `amount` field must be ABI-encoded in data
      data: ("0x" + "0000000000000000000000000000000000000000000000000000000000000064") as `0x${string}`,
      topics: fundedTopics as [`0x${string}`, ...`0x${string}`[]],
      blockHash: "0x0" as `0x${string}`,
      blockNumber: 1n,
      logIndex: 0,
      removed: false,
      transactionHash: "0xabc" as `0x${string}`,
      transactionIndex: 0
    };

    const createdTopics = encodeEventTopics({
      abi: escrowAbi,
      eventName: "JobCreated",
      args: { jobId: 99n, client: clientAddr, provider: providerAddr }
    });
    const jobCreatedLog: Log = {
      address: escrowAddr,
      data: "0x" as `0x${string}`,
      topics: createdTopics as [`0x${string}`, ...`0x${string}`[]],
      blockHash: "0x0" as `0x${string}`,
      blockNumber: 1n,
      logIndex: 1,
      removed: false,
      transactionHash: "0xabc" as `0x${string}`,
      transactionIndex: 0
    };

    const receipt = makeReceipt([jobFundedLog, jobCreatedLog]);
    expect(reader.extractJobId(receipt, escrowAddr)).toBe(99n);
  });

  it("swallows AbiEventSignatureNotFoundError for an escrow-address log with an unknown topic0 and continues to the JobCreated log", () => {
    // A log from the escrow address whose topic0 matches no event in the ABI causes
    // decodeEventLog to throw AbiEventSignatureNotFoundError. The narrowed catch must
    // swallow it and keep scanning — not rethrow. This pins the error-swallow path.
    const unknownTopic0 =
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as `0x${string}`;
    const unknownLog: Log = {
      address: escrowAddr,
      data: "0x" as `0x${string}`,
      topics: [unknownTopic0],
      blockHash: "0x0" as `0x${string}`,
      blockNumber: 1n,
      logIndex: 0,
      removed: false,
      transactionHash: "0xabc" as `0x${string}`,
      transactionIndex: 0
    };

    const createdTopics = encodeEventTopics({
      abi: escrowAbi,
      eventName: "JobCreated",
      args: { jobId: 55n, client: clientAddr, provider: providerAddr }
    });
    const jobCreatedLog: Log = {
      address: escrowAddr,
      data: "0x" as `0x${string}`,
      topics: createdTopics as [`0x${string}`, ...`0x${string}`[]],
      blockHash: "0x0" as `0x${string}`,
      blockNumber: 1n,
      logIndex: 1,
      removed: false,
      transactionHash: "0xabc" as `0x${string}`,
      transactionIndex: 0
    };

    const receipt = makeReceipt([unknownLog, jobCreatedLog]);
    expect(reader.extractJobId(receipt, escrowAddr)).toBe(55n);
  });
});
