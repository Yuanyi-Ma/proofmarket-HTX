import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateResearchPlanOutput
} from "@proofmarket/shared/src/realMode";
import {
  buildResearchPrompt,
  type ResearchContext,
  type ResearchRun
} from "./claudeResearchAgent";

function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]);
    const bare = text.match(/\{[\s\S]*\}/);
    if (bare) return JSON.parse(bare[0]);
    throw new Error("no JSON object found in codex result");
  }
}

function runCodex(
  prompt: string,
  options: {
    codexBin: string;
    timeoutMs: number;
    cwd: string;
    serviceTier: string;
    sandbox: string;
    model?: string;
  }
): Promise<{ stdout: string; stderr: string; lastMessage: string }> {
  return new Promise((resolve, reject) => {
    mkdtemp(join(tmpdir(), "proofmarket-codex-"))
      .then((dir) => {
        const outputPath = join(dir, "last-message.txt");
        const args = [
          "exec",
          "-c",
          `service_tier="${options.serviceTier}"`,
          "--ephemeral",
          "--sandbox",
          options.sandbox,
          "-C",
          options.cwd,
          "--output-last-message",
          outputPath
        ];
        if (options.model) {
          args.push("--model", options.model);
        }
        args.push("-");

        const child = execFile(
          options.codexBin,
          args,
          { timeout: options.timeoutMs, maxBuffer: 10 * 1024 * 1024 },
          async (error, stdout, stderr) => {
            let lastMessage = "";
            try {
              lastMessage = await readFile(outputPath, "utf8");
            } catch {
              lastMessage = "";
            }
            await rm(dir, { recursive: true, force: true }).catch(() => {});

            if (error) {
              const err = error as NodeJS.ErrnoException & { killed?: boolean };
              if (err.code === "ENOENT") {
                reject(
                  new Error(
                    `codex binary not found (ENOENT) — set CODEX_BIN or install codex: ${options.codexBin}`
                  )
                );
              } else if (err.killed) {
                reject(new Error(`codex timed out after ${options.timeoutMs}ms (SIGTERM)`));
              } else {
                reject(
                  new Error(
                    `codex failed (exit ${err.code ?? "unknown"}): ${error.message}; stderr=${String(stderr).slice(0, 500)}`
                  )
                );
              }
              return;
            }

            resolve({
              stdout: String(stdout ?? ""),
              stderr: String(stderr ?? ""),
              lastMessage
            });
          }
        );
        child.stdin?.write(prompt);
        child.stdin?.end();
      })
      .catch(reject);
  });
}

export async function runCodexResearchAgent(
  context: ResearchContext,
  options: {
    codexBin?: string;
    timeoutMs?: number;
    cwd?: string;
    serviceTier?: string;
    sandbox?: "read-only" | "workspace-write" | "danger-full-access";
    model?: string;
  } = {}
): Promise<ResearchRun> {
  const codexBin = options.codexBin ?? process.env.CODEX_BIN ?? "codex";
  const timeoutMs =
    options.timeoutMs ?? Number(process.env.PROOFMARKET_CODEX_TIMEOUT_MS ?? 240_000);
  const cwd = options.cwd ?? process.cwd();
  const serviceTier =
    options.serviceTier ?? process.env.PROOFMARKET_CODEX_SERVICE_TIER ?? "fast";
  const sandbox = options.sandbox ?? "read-only";
  const model = options.model ?? process.env.PROOFMARKET_CODEX_MODEL;
  const prompt = buildResearchPrompt(context);
  const providerIds = context.providerCatalog.map((entry) => entry.providerId);

  let lastError: Error | null = null;
  let lastRaw = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { stdout, stderr, lastMessage } = await runCodex(prompt, {
        codexBin,
        timeoutMs,
        cwd,
        serviceTier,
        sandbox,
        model
      });
      lastRaw = lastMessage || stdout;
      const candidate = extractJsonObject(lastMessage || stdout);
      const plan = validateResearchPlanOutput(candidate, {
        taskId: context.taskId,
        budgetAmount: context.budgetAmount,
        providerIds
      });
      return {
        plan,
        rawStdout: JSON.stringify({ stdout, stderr, lastMessage }),
        attempts: attempt,
        agentName: "Codex CLI"
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw new Error(
    `Codex research agent failed after retry: ${lastError?.message}. Raw: ${lastRaw.slice(0, 500)}`
  );
}
