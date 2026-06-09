import { NextResponse } from "next/server";
import { getTaskService } from "../../../../../lib/api";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { taskId } = await context.params;
  const service = getTaskService();

  await service.submitPact(taskId);

  return NextResponse.json(await service.activatePact(taskId));
}
