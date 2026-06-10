import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { verifyPackage } from "@proofmarket/agents/src/verifierAgent";
import { runProvider } from "@proofmarket/agents/src/providers";
import type { ProviderAnswerPackage, ProviderId } from "@proofmarket/shared/src/types";

const VALID_PROVIDER_IDS = new Set<ProviderId>([
  "execution-research-expert",
  "shallow-search-provider",
  "general-web-summary"
]);

const JOB_ID_RE = /^\d+$/;
const DELIVERABLE_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const BODY_SIZE_LIMIT = 1 * 1024 * 1024; // 1 MiB

export type SubmitOnChain = (input: {
  jobId: bigint;
  deliverableHash: `0x${string}`;
}) => Promise<{ txHash: string }>;

export type RunningServer = { url: string; close(): Promise<void> };

function readBody(
  request: IncomingMessage
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    request.on("data", (chunk: Buffer | string) => {
      size += typeof chunk === "string" ? chunk.length : chunk.byteLength;
      if (size > BODY_SIZE_LIMIT) {
        request.destroy();
        reject(Object.assign(new Error("request entity too large"), { code: "ENTITY_TOO_LARGE" }));
        return;
      }
      data += chunk;
    });
    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export async function startServicesServer(options: {
  port: number;
  submitOnChain: SubmitOnChain | null;
}): Promise<RunningServer> {
  const server: Server = createServer(async (request, response) => {
    try {
      let body: Record<string, unknown>;
      try {
        body = await readBody(request);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === "ENTITY_TOO_LARGE") {
          if (!response.headersSent) send(response, 413, { error: "request entity too large" });
          return;
        }
        throw error;
      }

      if (request.method === "POST" && request.url === "/provider/run") {
        const rawProviderId = String(body.providerId ?? "");
        if (!VALID_PROVIDER_IDS.has(rawProviderId as ProviderId)) {
          send(response, 400, { error: `unknown providerId: ${rawProviderId}` });
          return;
        }
        const providerId = rawProviderId as ProviderId;
        const taskId = String(body.taskId ?? "");
        const pkg = runProvider(taskId, providerId);
        send(response, 200, { ...pkg, jobId: String(body.jobId ?? "") });
        return;
      }

      if (request.method === "POST" && request.url === "/provider/submit") {
        if (!options.submitOnChain) {
          send(response, 503, { error: "provider signer not configured" });
          return;
        }
        const rawJobId = String(body.jobId ?? "");
        if (!JOB_ID_RE.test(rawJobId)) {
          send(response, 400, { error: `jobId must be a numeric string, got: ${rawJobId}` });
          return;
        }
        const rawHash = String(body.deliverableHash ?? "");
        if (!DELIVERABLE_HASH_RE.test(rawHash)) {
          send(response, 400, { error: `deliverableHash must match /^0x[0-9a-fA-F]{64}$/, got: ${rawHash}` });
          return;
        }
        const result = await options.submitOnChain({
          jobId: BigInt(rawJobId),
          deliverableHash: rawHash as `0x${string}`
        });
        send(response, 200, { txHash: result.txHash });
        return;
      }

      if (request.method === "POST" && request.url === "/judge/verify") {
        // Validate evidencePackage: must be an object with an answers array and a packageHash string.
        const raw = body.evidencePackage;
        if (
          raw === null ||
          typeof raw !== "object" ||
          Array.isArray(raw) ||
          !Array.isArray((raw as Record<string, unknown>).answers) ||
          typeof (raw as Record<string, unknown>).packageHash !== "string"
        ) {
          send(response, 400, {
            error: "evidencePackage must be an object with an answers array and a packageHash string"
          });
          return;
        }

        const evidencePackage = raw as unknown as ProviderAnswerPackage;
        const jobId = String(body.jobId ?? "");

        let result: ReturnType<typeof verifyPackage>;
        try {
          result = verifyPackage(evidencePackage);
        } catch (err) {
          // verifyPackage throws "Provider package hash mismatch" when the package
          // has been tampered with.  This is a non-valid outcome — route to Challenged.
          // We return HTTP 200 (not 400) because the request was structurally valid;
          // the package itself was fraudulent.  realTaskService branches on decision,
          // so returning a non-valid decision here correctly routes to Challenged.
          send(response, 200, {
            judgeId: "judge-demo-001",
            jobId,
            decision: "provider_fault",
            reasonCode: "PACKAGE_HASH_MISMATCH",
            reason: err instanceof Error ? err.message : String(err),
            verdictHash: null,
            voting: { mode: "not_triggered", voteId: null, onchainTxHash: null }
          });
          return;
        }

        const isValid = result.verdict === "valid";
        let reasonCode: string;
        if (isValid) {
          reasonCode = "EVIDENCE_VERIFIED";
        } else if (result.verdict === "provider_fault" && result.challengeType === "CoverageMiss") {
          reasonCode = "COVERAGE_MISS";
        } else {
          reasonCode = "PROVIDER_FAULT";
        }
        const verdict = {
          judgeId: "judge-demo-001",
          jobId,
          decision: isValid ? ("valid" as const) : ("provider_fault" as const),
          reasonCode,
          reason: result.reason,
          ...(result.verdict === "provider_fault" ? { challengeType: result.challengeType } : {}),
          verdictHash: result.resultHash,
          voting: { mode: "not_triggered", voteId: null, onchainTxHash: null }
        };
        send(response, 200, verdict);
        return;
      }

      send(response, 404, { error: `no route: ${request.method} ${request.url}` });
    } catch (error) {
      send(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port;
  return {
    url: `http://localhost:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
}
