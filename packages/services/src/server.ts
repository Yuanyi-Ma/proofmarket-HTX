import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { runProvider } from "@proofmarket/agents/src/providers";
import { stableHash } from "@proofmarket/shared/src/hash";
import type { ProviderId } from "@proofmarket/shared/src/types";

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
        const verdict = {
          judgeId: "judge-demo-001",
          jobId: String(body.jobId ?? ""),
          decision: "valid" as const,
          reasonCode: "PRESET_SUCCESS_PATH",
          verdictHash: stableHash({
            jobId: String(body.jobId ?? ""),
            evidencePackageHash: String(body.evidencePackageHash ?? ""),
            decision: "valid"
          }),
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
