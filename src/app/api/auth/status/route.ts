import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { githubTokenStore } from "@/lib/github-store";

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value || "default";
  const data = githubTokenStore.get(sessionId);

  return NextResponse.json({
    loggedIn: !!data,
    username: data?.username || null,
  });
}
