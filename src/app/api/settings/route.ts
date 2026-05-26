import { NextResponse } from "next/server";
import { settingsStore } from "@/lib/settings-store";
import { getSessionId } from "@/lib/middleware/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, apiUrl, model, sdkType } = body;
    const sessionId = await getSessionId();

    settingsStore.set(sessionId, { apiKey, apiUrl, model, sdkType });

    try {
      const response = await fetch(`${apiUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return NextResponse.json({ ok: response.ok });
    } catch {
      return NextResponse.json({ ok: false });
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET() {
  const sessionId = await getSessionId();
  const settings = settingsStore.get(sessionId);
  return NextResponse.json({ configured: !!settings?.apiKey });
}
