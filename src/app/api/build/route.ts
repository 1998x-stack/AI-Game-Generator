import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/middleware/session";
import { build } from "@/lib/build/bundler";

export async function POST() {
  const sessionId = await getSessionId();
  const result = await build(sessionId);

  if (result.errors.length > 0) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json({ html: result.html, errors: result.errors, warnings: result.warnings });
}
