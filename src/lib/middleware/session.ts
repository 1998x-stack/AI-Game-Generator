import { randomUUID } from "crypto";
import { cookies } from "next/headers";

export async function getSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get("session_id");
  if (existing?.value) return existing.value;

  const newId = randomUUID();
  cookieStore.set("session_id", newId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return newId;
}
