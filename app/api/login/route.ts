import { NextResponse } from "next/server";
import { verifyUser, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const user = verifyUser(email, password) as
    | { id: number; email: string }
    | false;

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSession(user.id);

  const response = NextResponse.json({ success: true });
  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}
