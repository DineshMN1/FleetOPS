import { NextResponse } from "next/server";
import { hasUsers, createUser, createSession } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  return NextResponse.json({ hasUsers: hasUsers() });
}

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  if (hasUsers()) {
    return NextResponse.json(
      { error: "Registration is disabled. An admin account already exists." },
      { status: 403 }
    );
  }

  const userId = createUser(email, password);
  const token = createSession(userId);

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
