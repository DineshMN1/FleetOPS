import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (sessionToken) {
    deleteSession(sessionToken);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}
