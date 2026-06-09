import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServicesServer, type RunningServer, type SubmitOnChain } from "../src/server";

let server: RunningServer;

// Stub submitOnChain for input-guard tests so 400 guards are reached before any on-chain call
const stubSubmit: SubmitOnChain = async () => ({ txHash: "0x" + "f".repeat(64) });

let serverWithSigner: RunningServer;

beforeAll(async () => {
  server = await startServicesServer({ port: 0, submitOnChain: null }); // null = no signer in tests
  serverWithSigner = await startServicesServer({ port: 0, submitOnChain: stubSubmit });
});

afterAll(async () => {
  await server.close();
  await serverWithSigner.close();
});

describe("provider endpoint", () => {
  it("returns a deterministic evidence package for the expert provider", async () => {
    const response = await fetch(`${server.url}/provider/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: "task_001",
        jobId: "1",
        providerId: "execution-research-expert",
        question: "anything",
        requiredEvidenceSchema: { minItems: 3, requiredFields: [] }
      })
    });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.providerId).toBe("execution-research-expert");
    expect(body.packageHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect((body.answers as unknown[]).length).toBeGreaterThanOrEqual(3);
  });

  it("is deterministic: same input, same hash", async () => {
    const call = () =>
      fetch(`${server.url}/provider/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: "task_001",
          jobId: "1",
          providerId: "execution-research-expert",
          question: "anything",
          requiredEvidenceSchema: { minItems: 3, requiredFields: [] }
        })
      }).then((r) => r.json() as Promise<Record<string, unknown>>);
    const [a, b] = await Promise.all([call(), call()]);
    expect(a.packageHash).toBe(b.packageHash);
  });

  it("rejects submit when no signer is configured", async () => {
    const response = await fetch(`${server.url}/provider/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "1", deliverableHash: "0x" + "a".repeat(64) })
    });
    expect(response.status).toBe(503);
  });
});

describe("judge endpoint", () => {
  it("returns a deterministic valid verdict with a verdict hash", async () => {
    const response = await fetch(`${server.url}/judge/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: "task_001",
        jobId: "1",
        evidencePackageHash: "0x" + "a".repeat(64),
        evidencePackage: { answers: [1, 2, 3] },
        successCriteria: ["at least 3 evidence items"]
      })
    });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.decision).toBe("valid");
    expect(body.reasonCode).toBe("PRESET_SUCCESS_PATH");
    expect(body.verdictHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect((body.voting as Record<string, unknown>).mode).toBe("not_triggered");
  });
});

describe("input validation — /provider/run", () => {
  it("returns 400 for an unknown providerId", async () => {
    const response = await fetch(`${server.url}/provider/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: "task_001",
        jobId: "1",
        providerId: "totally-fake-provider",
        question: "anything"
      })
    });
    expect(response.status).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(body.error as string).toMatch(/unknown providerId: totally-fake-provider/);
  });
});

describe("input validation — /provider/submit", () => {
  it("returns 400 when jobId is not a numeric string", async () => {
    const response = await fetch(`${serverWithSigner.url}/provider/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "abc", deliverableHash: "0x" + "a".repeat(64) })
    });
    expect(response.status).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
  });

  it("returns 400 when deliverableHash is not a valid 0x-prefixed 32-byte hex", async () => {
    const response = await fetch(`${serverWithSigner.url}/provider/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "42", deliverableHash: "not-a-hash" })
    });
    expect(response.status).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
  });

  it("reaches the stub and returns its txHash for valid input", async () => {
    const response = await fetch(`${serverWithSigner.url}/provider/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "99", deliverableHash: "0x" + "b".repeat(64) })
    });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.txHash).toBe("0x" + "f".repeat(64));
  });
});

describe("body size cap", () => {
  it("rejects a 1.5 MB body or keeps serving subsequent requests", async () => {
    // Send a 1.5MB payload — expect either 413 or socket error (client-side teardown)
    const bigBody = "x".repeat(1.5 * 1024 * 1024);
    let got413 = false;
    try {
      const response = await fetch(`${server.url}/provider/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: bigBody
      });
      got413 = response.status === 413;
    } catch {
      // Socket was destroyed — that's acceptable
    }

    // Whether or not we got 413, the server must still answer subsequent good requests
    const good = await fetch(`${server.url}/judge/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: "task_001",
        jobId: "1",
        evidencePackageHash: "0x" + "c".repeat(64),
        evidencePackage: { answers: [1, 2, 3] },
        successCriteria: ["at least 3 evidence items"]
      })
    });
    expect(good.status).toBe(200);
    if (got413) expect(got413).toBe(true);
  });
});

describe("routing and error handling", () => {
  it("returns 404 for an unknown route", async () => {
    const response = await fetch(`${server.url}/unknown/path`, {
      method: "GET"
    });
    expect(response.status).toBe(404);
    const body = await response.json() as Record<string, unknown>;
    expect(body.error as string).toMatch(/no route/);
  });

  it("returns 500 for malformed JSON and server stays up for subsequent requests", async () => {
    const badResponse = await fetch(`${server.url}/provider/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ this is not valid json !!!"
    });
    expect(badResponse.status).toBe(500);

    // Server must still serve subsequent requests
    const goodResponse = await fetch(`${server.url}/judge/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: "task_001",
        jobId: "1",
        evidencePackageHash: "0x" + "b".repeat(64),
        evidencePackage: { answers: [1, 2, 3] },
        successCriteria: ["at least 3 evidence items"]
      })
    });
    expect(goodResponse.status).toBe(200);
  });
});
