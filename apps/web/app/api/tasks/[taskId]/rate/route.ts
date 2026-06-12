import { getTaskService } from "../../../../../lib/api";
import { jsonOrError } from "../../../../../lib/routeError";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { score?: number };

  return jsonOrError(() => getTaskService().rate(taskId, body.score ?? 5));
}
