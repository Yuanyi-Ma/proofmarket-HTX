import { getTaskService } from "../../../lib/api";
import { jsonOrError } from "../../../lib/routeError";
import { getDefaultQuestion } from "@proofmarket/shared/src/fixtures";
import { normalizeLocale } from "@proofmarket/shared/src/locale";

const DEFAULT_BUDGET = "5 USDC";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    question?: unknown;
    budget?: unknown;
    locale?: unknown;
  };
  const locale = normalizeLocale(body.locale);
  const question = String(body.question || getDefaultQuestion(locale));
  const budget = String(body.budget || DEFAULT_BUDGET);

  return jsonOrError(() => getTaskService().createTask(question, budget, locale));
}
