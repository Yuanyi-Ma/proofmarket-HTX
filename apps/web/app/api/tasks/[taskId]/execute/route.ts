import { NextResponse } from "next/server";
import { getTaskService } from "../../../../../lib/api";
import { jsonOrError } from "../../../../../lib/routeError";
import type { ProviderId } from "@proofmarket/shared/src/types";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

const VALID_PROVIDER_IDS = [
  "execution-research-expert",
  "shallow-search-provider",
  "general-web-summary"
] as const satisfies readonly ProviderId[];

function isProviderId(value: string): value is ProviderId {
  return VALID_PROVIDER_IDS.includes(value as ProviderId);
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    providerId?: unknown;
  };
  const providerId = body.providerId;

  if (providerId !== undefined) {
    if (typeof providerId !== "string" || !isProviderId(providerId)) {
      return NextResponse.json(
        {
          error: "Invalid providerId",
          validProviderIds: VALID_PROVIDER_IDS
        },
        { status: 400 }
      );
    }
    return jsonOrError(() => getTaskService().executeEscrow(taskId, providerId));
  }

  return jsonOrError(() => getTaskService().executeEscrow(taskId));
}
