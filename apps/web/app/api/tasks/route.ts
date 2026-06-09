import { NextResponse } from "next/server";
import { getTaskService } from "../../../lib/api";

const DEFAULT_QUESTION = "请调研近几年区块链交易执行加速的最新研究进展。";
const DEFAULT_BUDGET = "5 test USDC";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    question?: unknown;
    budget?: unknown;
  };
  const question = String(body.question || DEFAULT_QUESTION);
  const budget = String(body.budget || DEFAULT_BUDGET);
  const task = getTaskService().createTask(question, budget);

  return NextResponse.json(task);
}
