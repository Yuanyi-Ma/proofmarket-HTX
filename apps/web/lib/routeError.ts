import { NextResponse } from "next/server";

/**
 * Runs a task-service call and converts any thrown error into a JSON 500
 * with `{ error: message }` instead of letting Next.js return an opaque
 * HTML error page. Every route under app/api/tasks/ wraps its call in this.
 */
export async function jsonOrError<T>(run: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await run());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
