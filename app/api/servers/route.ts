import { NextResponse } from "next/server";
import db from "@/lib/db";
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

  try {
    const servers = db.prepare(`
      SELECT r.*, s.name as ssh_key_name, s.type as ssh_key_type
      FROM remote_servers r
      LEFT JOIN ssh_keys s ON r.ssh_key_id = s.id
      ORDER BY r.id DESC
    `).all();
    return NextResponse.json(servers);
  } catch {
    return NextResponse.json({ error: "Failed to fetch servers" }, { status: 500 });
  }
}

function validateServerFields(name: unknown, host: unknown, username: unknown, port: unknown) {
  if (!name || typeof name !== "string" || !name.trim()) return "name is required";
  if (!host || typeof host !== "string" || !host.trim()) return "host is required";
  if (!username || typeof username !== "string" || !username.trim()) return "username is required";
  const parsedPort = parseInt(String(port ?? 22));
  if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) return "port must be between 1 and 65535";
  return null;
}

export async function POST(req: Request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const { name, description, host, username, port, ssh_key_id } = body;
    const validationError = validateServerFields(name, host, username, port);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const result = db.prepare(
      `INSERT INTO remote_servers (name, description, host, username, port, ssh_key_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).run(name.trim(), description?.trim() || null, host.trim(), username.trim(), parseInt(String(port ?? 22)), ssh_key_id || null);
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to create server" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const { id, name, description, host, username, port, ssh_key_id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const validationError = validateServerFields(name, host, username, port);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    db.prepare(
      `UPDATE remote_servers
       SET name = ?, description = ?, host = ?, username = ?, port = ?, ssh_key_id = ?
       WHERE id = ?`
    ).run(name.trim(), description?.trim() || null, host.trim(), username.trim(), parseInt(String(port ?? 22)), ssh_key_id || null, id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to update server" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    db.prepare("DELETE FROM remote_servers WHERE id = ?").run(body.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to delete server" }, { status: 500 });
  }
}
