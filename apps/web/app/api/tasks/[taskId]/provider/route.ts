import { NextResponse } from "next/server";
import { getTaskService } from "../../../../../lib/api";
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
  const hasProviderId = Object.prototype.hasOwnProperty.call(body, "providerId");
  const providerId =
    hasProviderId && body.providerId !== undefined
      ? body.providerId
      : "execution-research-expert";

  if (typeof providerId !== "string" || !isProviderId(providerId)) {
    return NextResponse.json(
      {
        error: "Invalid providerId",
        validProviderIds: VALID_PROVIDER_IDS
      },
      { status: 400 }
    );
  }

  return NextResponse.json(await getTaskService().runProvider(taskId, providerId));
}
