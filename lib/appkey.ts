import db from "./db";
import { generateKeyPairSync, createHash } from "crypto";

/**
 * ED25519 PKCS8 DER layout (48 bytes):
 *   [0-1]  30 2e  SEQUENCE
 *   [2-4]  02 01 00  version = 0
 *   [5-11] 30 05 06 03 2b 65 70  algorithm OID (id-EdDSA)
 *   [12-13] 04 22  OCTET STRING
 *   [14-15] 04 20  OCTET STRING (inner)
 *   [16-47] 32 bytes of raw seed
 *
 * ED25519 SPKI DER layout (44 bytes):
 *   [0-1]  30 2a  SEQUENCE
 *   [2-11] algorithm + OID
 *   [12-43] 03 21 00 + 32 bytes of raw public key (bit string, 0 unused bits)
 *   Public key bytes start at offset 13.
 */

function uint32BE(n: number): Buffer {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

/**
 * Build an OpenSSH private key file (unencrypted) for an ED25519 key.
 * ssh2 requires this format — it does NOT support PKCS8 for ED25519.
 */
function buildOpenSSHPrivateKey(seedBytes: Buffer, pubKeyBytes: Buffer): string {
  const keyType = Buffer.from("ssh-ed25519");
  const none = Buffer.from("none");
  const magic = Buffer.concat([Buffer.from("openssh-key-v1"), Buffer.alloc(1)]); // null-terminated

  // SSH wire-format public key
  const pubWire = Buffer.concat([
    uint32BE(keyType.length), keyType,
    uint32BE(pubKeyBytes.length), pubKeyBytes,
  ]);

  // OpenSSH stores the private key as seed (32) + pubkey (32) = 64 bytes
  const privFull = Buffer.concat([seedBytes, pubKeyBytes]);

  // Randomized check integer (must appear twice; used to detect decryption failures)
  const checkInt = Math.floor(Math.random() * 0xffffffff);
  const checkBuf = uint32BE(checkInt);

  const innerBufs = [
    checkBuf, checkBuf,
    uint32BE(keyType.length), keyType,
    uint32BE(pubKeyBytes.length), pubKeyBytes,
    uint32BE(privFull.length), privFull,
    uint32BE(0), // empty comment
  ];

  const inner = Buffer.concat(innerBufs);

  // Pad to 8-byte boundary with 1, 2, 3, ... bytes
  const padLen = (8 - (inner.length % 8)) % 8;
  const pad = Buffer.from(Array.from({ length: padLen }, (_, i) => i + 1));
  const innerPadded = Buffer.concat([inner, pad]);

  const full = Buffer.concat([
    magic,
    uint32BE(none.length), none,           // cipher: none
    uint32BE(none.length), none,           // kdf: none
    uint32BE(0),                           // kdf options: empty
    uint32BE(1),                           // number of keys
    uint32BE(pubWire.length), pubWire,     // public key
    uint32BE(innerPadded.length), innerPadded,
  ]);

  // Wrap in PEM with 70-char line width
  const b64 = full.toString("base64").replace(/.{70}/g, "$&\n");
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${b64}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

/** Convert raw ED25519 public key bytes to the OpenSSH authorized_keys line format. */
function buildOpensshPublicKey(pubKeyBytes: Buffer): string {
  const keyType = Buffer.from("ssh-ed25519");
  const wire = Buffer.concat([
    uint32BE(keyType.length), keyType,
    uint32BE(pubKeyBytes.length), pubKeyBytes,
  ]);
  return `ssh-ed25519 ${wire.toString("base64")} fleetops`;
}

export function computeFingerprint(opensshPubKey: string): string {
  const b64 = opensshPubKey.split(" ")[1];
  const bytes = Buffer.from(b64, "base64");
  const hash = createHash("sha256")
    .update(bytes)
    .digest("base64")
    .replace(/=+$/, "");
  return `SHA256:${hash}`;
}

function generateKeyPair(): { privateKey: string; publicKey: string } {
  // Export both as DER so we can extract raw bytes at known offsets
  const result = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "der" },
    publicKeyEncoding: { type: "spki", format: "der" },
  } as Parameters<typeof generateKeyPairSync>[1]);

  const privDer = result.privateKey as unknown as Buffer; // 48 bytes; seed at [16..47]
  const pubDer = result.publicKey as unknown as Buffer;   // 44 bytes; pubkey at [13..44]

  const seedBytes = privDer.subarray(16, 48);   // seed at PKCS8 DER offset 16
  const pubKeyBytes = pubDer.subarray(12, 44);  // pubkey at SPKI DER offset 12

  const privateKey = buildOpenSSHPrivateKey(seedBytes, pubKeyBytes);
  const publicKey = buildOpensshPublicKey(pubKeyBytes);

  return { privateKey, publicKey };
}

export function getOrCreateAppKey(): {
  privateKey: string;
  publicKey: string;
  fingerprint: string;
} {
  const privRow = db
    .prepare("SELECT value FROM app_settings WHERE key = 'private_key'")
    .get() as { value: string } | undefined;

  if (privRow) {
    // Migrate: if the stored key is PKCS8 (wrong format for ssh2), regenerate
    if (!privRow.value.includes("BEGIN OPENSSH PRIVATE KEY")) {
      db.prepare(
        "DELETE FROM app_settings WHERE key IN ('private_key', 'public_key')"
      ).run();
      console.log("🔄 Migrating SSH key to OpenSSH format...");
      return getOrCreateAppKey();
    }

    const pubRow = db
      .prepare("SELECT value FROM app_settings WHERE key = 'public_key'")
      .get() as { value: string };
    return {
      privateKey: privRow.value,
      publicKey: pubRow.value,
      fingerprint: computeFingerprint(pubRow.value),
    };
  }

  const { privateKey, publicKey } = generateKeyPair();

  db.prepare(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)"
  ).run("private_key", privateKey);
  db.prepare(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)"
  ).run("public_key", publicKey);

  console.log(
    "✅ FleetOPS ED25519 keypair generated (OpenSSH format).\n" +
      "   Copy the public key from Settings → add to ~/.ssh/authorized_keys on each server."
  );

  return { privateKey, publicKey, fingerprint: computeFingerprint(publicKey) };
}

export function regenerateAppKey(): {
  privateKey: string;
  publicKey: string;
  fingerprint: string;
} {
  db.prepare(
    "DELETE FROM app_settings WHERE key IN ('private_key', 'public_key')"
  ).run();
  return getOrCreateAppKey();
}
