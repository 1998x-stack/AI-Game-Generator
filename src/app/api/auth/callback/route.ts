import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { githubTokenStore } from "@/lib/github-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();
    if (data.error) {
      return NextResponse.json({ error: data.error_description }, { status: 400 });
    }

    // Get username
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const user = await userRes.json();

    // Store token
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value || "default";
    githubTokenStore.set(sessionId, {
      token: data.access_token,
      username: user.login,
    });

    return NextResponse.redirect(new URL("/", request.url).origin);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
