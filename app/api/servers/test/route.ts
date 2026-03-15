import { NextRequest, NextResponse } from "next/server";
import { Client } from "ssh2";
import db from "@/lib/db";
import { validateSession } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = validateSession(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const server = db.prepare(`
    SELECT r.*, s.private_key
    FROM remote_servers r
    LEFT JOIN ssh_keys s ON r.ssh_key_id = s.id
    WHERE r.id = ?
  `).get(id) as any;

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (!server.private_key) {
    db.prepare("UPDATE remote_servers SET status = 'no_key' WHERE id = ?").run(id);
    return NextResponse.json({ status: "no_key", error: "No SSH key assigned to this server." });
  }

  const conn = new Client();
  try {
    await new Promise<void>((resolve, reject) => {
      conn.on("ready", resolve).on("error", reject).connect({
        host: server.host,
        port: server.port || 22,
        username: server.username,
        privateKey: server.private_key,
        readyTimeout: 10000,
      });
    });
    conn.end();
    db.prepare("UPDATE remote_servers SET status = 'connected' WHERE id = ?").run(id);
    return NextResponse.json({ status: "connected" });
  } catch (err: any) {
    try { conn.end(); } catch {}
    const msg = err.message || "";
    const status = msg.includes("auth") ? "auth_failed" : "error";
    db.prepare("UPDATE remote_servers SET status = ? WHERE id = ?").run(status, id);
    return NextResponse.json({ status, error: msg });
  }
}
