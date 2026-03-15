import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { validateSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { generateKeyPairSync, createHash } from "crypto";

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return validateSession(token);
}

function uint32BE(n: number): Buffer {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function buildOpenSSHPrivateKey(seedBytes: Buffer, pubKeyBytes: Buffer): string {
  const keyType = Buffer.from("ssh-ed25519");
  const none = Buffer.from("none");
  const magic = Buffer.concat([Buffer.from("openssh-key-v1"), Buffer.alloc(1)]);
  const pubWire = Buffer.concat([uint32BE(keyType.length), keyType, uint32BE(pubKeyBytes.length), pubKeyBytes]);
  const privFull = Buffer.concat([seedBytes, pubKeyBytes]);
  const checkInt = Math.floor(Math.random() * 0xffffffff);
  const checkBuf = uint32BE(checkInt);
  const inner = Buffer.concat([checkBuf, checkBuf, uint32BE(keyType.length), keyType, uint32BE(pubKeyBytes.length), pubKeyBytes, uint32BE(privFull.length), privFull, uint32BE(0)]);
  const padLen = (8 - (inner.length % 8)) % 8;
  const pad = Buffer.from(Array.from({ length: padLen }, (_, i) => i + 1));
  const innerPadded = Buffer.concat([inner, pad]);
  const full = Buffer.concat([magic, uint32BE(none.length), none, uint32BE(none.length), none, uint32BE(0), uint32BE(1), uint32BE(pubWire.length), pubWire, uint32BE(innerPadded.length), innerPadded]);
  const b64 = full.toString("base64").replace(/.{70}/g, "$&\n");
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${b64}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

function buildOpensshPublicKey(pubKeyBytes: Buffer): string {
  const keyType = Buffer.from("ssh-ed25519");
  const wire = Buffer.concat([uint32BE(keyType.length), keyType, uint32BE(pubKeyBytes.length), pubKeyBytes]);
  return `ssh-ed25519 ${wire.toString("base64")} fleetops`;
}

function computeFingerprint(opensshPubKey: string): string {
  const b64 = opensshPubKey.split(" ")[1];
  if (!b64) return "";
  const bytes = Buffer.from(b64, "base64");
  const hash = createHash("sha256").update(bytes).digest("base64").replace(/=+$/, "");
  return `SHA256:${hash}`;
}

function generateED25519(): { privateKey: string; publicKey: string } {
  const result = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "der" },
    publicKeyEncoding: { type: "spki", format: "der" },
  } as Parameters<typeof generateKeyPairSync>[1]);
  const privDer = result.privateKey as unknown as Buffer;
  const pubDer = result.publicKey as unknown as Buffer;
  const seedBytes = privDer.subarray(16, 48);
  const pubKeyBytes = pubDer.subarray(12, 44);
  return {
    privateKey: buildOpenSSHPrivateKey(seedBytes, pubKeyBytes),
    publicKey: buildOpensshPublicKey(pubKeyBytes),
  };
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = db.prepare(
    "SELECT id, name, description, type, public_key, created_at FROM ssh_keys ORDER BY id DESC"
  ).all();
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, name, description } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  if (action === "generate") {
    const { privateKey, publicKey } = generateED25519();
    const fingerprint = computeFingerprint(publicKey);
    const result = db.prepare(
      "INSERT INTO ssh_keys (name, description, private_key, public_key, type) VALUES (?, ?, ?, ?, ?)"
    ).run(name.trim(), description?.trim() || null, privateKey, publicKey, "ed25519");
    return NextResponse.json({
      id: result.lastInsertRowid,
      name: name.trim(),
      type: "ed25519",
      publicKey,
      fingerprint,
    });
  }

  if (action === "import") {
    const { privateKey, publicKey } = body;
    if (!privateKey?.trim()) return NextResponse.json({ error: "Private key is required" }, { status: 400 });
    if (!publicKey?.trim()) return NextResponse.json({ error: "Public key is required" }, { status: 400 });

    // Detect key type from public key
    const pkTrimmed = publicKey.trim();
    let type = "rsa";
    if (pkTrimmed.startsWith("ssh-ed25519")) type = "ed25519";
    else if (pkTrimmed.startsWith("ecdsa-sha2")) type = "ecdsa";
    else if (pkTrimmed.startsWith("ssh-dss")) type = "dsa";

    const result = db.prepare(
      "INSERT INTO ssh_keys (name, description, private_key, public_key, type) VALUES (?, ?, ?, ?, ?)"
    ).run(name.trim(), description?.trim() || null, privateKey.trim(), pkTrimmed, type);
    return NextResponse.json({ id: result.lastInsertRowid, name: name.trim(), type, publicKey: pkTrimmed });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Don't delete if any server uses this key
  const inUse = db.prepare("SELECT COUNT(*) as c FROM remote_servers WHERE ssh_key_id = ?").get(id) as any;
  if (inUse.c > 0) {
    return NextResponse.json({ error: `This key is used by ${inUse.c} server(s). Remove those servers first.` }, { status: 400 });
  }

  db.prepare("DELETE FROM ssh_keys WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
