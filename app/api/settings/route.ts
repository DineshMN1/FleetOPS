import { NextResponse } from "next/server";
import { getOrCreateAppKey, regenerateAppKey } from "@/lib/appkey";
import { validateSession } from "@/lib/auth";
import { cookies } from "next/headers";

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return validateSession(token);
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { publicKey, fingerprint } = getOrCreateAppKey();
  return NextResponse.json({ publicKey, fingerprint });
}

export async function POST(req: Request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json();
  if (action !== "regenerate") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { publicKey, fingerprint } = regenerateAppKey();
  return NextResponse.json({ publicKey, fingerprint });
}
