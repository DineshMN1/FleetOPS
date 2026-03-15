// Custom Next.js server with WebSocket support for SSH terminal streaming
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const { Client } = require("ssh2");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function getDb(readonly = false) {
  const Database = require("better-sqlite3");
  const dbPath = path.join(process.cwd(), "db", "fleetops.db");
  return new Database(dbPath, { readonly });
}

function getKeyForServer(server) {
  if (!server || !server.ssh_key_id) return null;
  try {
    const db = getDb(true);
    const row = db.prepare("SELECT private_key FROM ssh_keys WHERE id = ?").get(server.ssh_key_id);
    db.close();
    return row?.private_key || null;
  } catch {
    return null;
  }
}

function uint32BE(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

/**
 * Build an OpenSSH private key file (unencrypted) for an ED25519 keypair.
 * ssh2 requires OpenSSH format — it does NOT accept PKCS8 for ED25519.
 */
function buildOpenSSHPrivateKey(seedBytes, pubKeyBytes) {
  const keyType = Buffer.from("ssh-ed25519");
  const none = Buffer.from("none");
  const magic = Buffer.concat([Buffer.from("openssh-key-v1"), Buffer.alloc(1)]);

  const pubWire = Buffer.concat([
    uint32BE(keyType.length), keyType,
    uint32BE(pubKeyBytes.length), pubKeyBytes,
  ]);

  // OpenSSH ed25519 private = seed (32 bytes) + pubkey (32 bytes)
  const privFull = Buffer.concat([seedBytes, pubKeyBytes]);

  const checkInt = Math.floor(Math.random() * 0xffffffff);
  const checkBuf = uint32BE(checkInt);

  const inner = Buffer.concat([
    checkBuf, checkBuf,
    uint32BE(keyType.length), keyType,
    uint32BE(pubKeyBytes.length), pubKeyBytes,
    uint32BE(privFull.length), privFull,
    uint32BE(0), // empty comment
  ]);

  // Pad to 8-byte boundary with sequence 1, 2, 3, ...
  const padLen = (8 - (inner.length % 8)) % 8;
  const pad = Buffer.from(Array.from({ length: padLen }, (_, i) => i + 1));
  const innerPadded = Buffer.concat([inner, pad]);

  const full = Buffer.concat([
    magic,
    uint32BE(none.length), none,
    uint32BE(none.length), none,
    uint32BE(0),
    uint32BE(1),
    uint32BE(pubWire.length), pubWire,
    uint32BE(innerPadded.length), innerPadded,
  ]);

  const b64 = full.toString("base64").replace(/.{70}/g, "$&\n");
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${b64}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

/** Called once on startup: ensure the keypair exists in OpenSSH format. */
function ensureAppKey() {
  try {
    const db = getDb(false);
    const existing = db
      .prepare("SELECT value FROM app_settings WHERE key = 'private_key'")
      .get();

    if (existing) {
      // Migrate: delete PKCS8 keys stored by old code and regenerate
      if (!existing.value.includes("BEGIN OPENSSH PRIVATE KEY")) {
        console.log("🔄 Migrating SSH key to OpenSSH format...");
        db.prepare("DELETE FROM app_settings WHERE key IN ('private_key', 'public_key')").run();
      } else {
        db.close();
        return;
      }
    }

    const { generateKeyPairSync } = require("crypto");
    // Export as DER to extract raw bytes at known offsets:
    //   PKCS8 DER (48 bytes): seed bytes at [16..47]
    //   SPKI DER  (44 bytes): pubkey bytes at [13..44]
    const result = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "der" },
      publicKeyEncoding: { type: "spki", format: "der" },
    });

    const seedBytes = result.privateKey.subarray(16, 48);  // seed at PKCS8 DER offset 16
    const pubKeyBytes = result.publicKey.subarray(12, 44); // pubkey at SPKI DER offset 12

    const privateKey = buildOpenSSHPrivateKey(seedBytes, pubKeyBytes);

    const keyType = Buffer.from("ssh-ed25519");
    const pubWire = Buffer.concat([
      uint32BE(keyType.length), keyType,
      uint32BE(pubKeyBytes.length), pubKeyBytes,
    ]);
    const publicKey = `ssh-ed25519 ${pubWire.toString("base64")} fleetops`;

    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("private_key", privateKey);
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("public_key", publicKey);
    db.close();

    console.log("✅ FleetOPS ED25519 application keypair generated (OpenSSH format).");
    console.log("   Go to Settings in the dashboard to copy the public key.");
  } catch (e) {
    console.error("Key generation failed:", e.message);
  }
}

function updateServerStatus(serverId, status) {
  try {
    const db = getDb(false);
    db.prepare("UPDATE remote_servers SET status = ? WHERE id = ?").run(
      status,
      serverId
    );
    db.close();
  } catch {}
}

function validateSession(token) {
  try {
    const db = getDb(true);
    const session = db
      .prepare(
        `SELECT u.id, u.email FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > datetime('now')`
      )
      .get(token);
    db.close();
    return session || null;
  } catch {
    return null;
  }
}

function getServerById(serverId) {
  try {
    const db = getDb(true);
    const server = db
      .prepare("SELECT * FROM remote_servers WHERE id = ?")
      .get(serverId);
    db.close();
    return server || null;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), v.join("=")];
    })
  );
}

app.prepare().then(() => {
  // Generate the app keypair if this is the first run
  ensureAppKey();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, req, context) => {
    const { server } = context;
    const appPrivateKey = getKeyForServer(server);

    const conn = new Client();
    let sshStream = null;
    let sshReady = false;

    const connectSSH = () => {
      if (!appPrivateKey) {
        ws.send(
          JSON.stringify({
            type: "error",
            message:
              "No SSH key assigned to this server. Go to Remote Servers to assign a key.",
          })
        );
        ws.close();
        return;
      }

      conn.connect({
        host: server.host,
        port: server.port || 22,
        username: server.username,
        privateKey: appPrivateKey,
        readyTimeout: 20000,
      });
    };

    conn.on("ready", () => {
      sshReady = true;
      updateServerStatus(server.id, "connected");
      ws.send(
        JSON.stringify({
          type: "status",
          status: "connected",
          message: `Connected to ${server.name} (${server.host})`,
        })
      );

      conn.shell({ term: "xterm-256color", cols: 220, rows: 50 }, (err, stream) => {
        if (err) {
          ws.send(
            JSON.stringify({ type: "error", message: `Shell error: ${err.message}` })
          );
          ws.close();
          return;
        }

        sshStream = stream;

        stream.on("data", (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "data", data: data.toString("base64") }));
          }
        });

        stream.stderr.on("data", (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "data", data: data.toString("base64") }));
          }
        });

        stream.on("close", () => {
          ws.send(
            JSON.stringify({ type: "status", status: "closed", message: "SSH session ended" })
          );
          ws.close();
          conn.end();
        });
      });
    });

    conn.on("error", (err) => {
      ws.send(
        JSON.stringify({ type: "error", message: `SSH error: ${err.message}` })
      );
      ws.close();
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "resize" && sshStream) {
          sshStream.setWindow(msg.rows, msg.cols, 0, 0);
          return;
        }

        if (msg.type === "data" && sshStream) {
          sshStream.write(Buffer.from(msg.data, "base64"));
          return;
        }
      } catch {
        if (sshStream) sshStream.write(raw.toString());
      }
    });

    ws.on("close", () => {
      if (sshStream) sshStream.end();
      conn.end();
      updateServerStatus(server.id, "disconnected");
    });

    connectSSH();
  });

  httpServer.on("upgrade", (req, socket, head) => {
    const parsedUrl = parse(req.url, true);

    if (parsedUrl.pathname !== "/api/ws/terminal") {
      // Don't destroy — let Next.js handle other upgrade requests (HMR, etc.)
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies["session"];

    if (!sessionToken) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const user = validateSession(sessionToken);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const serverId = parsedUrl.query.serverId;
    if (!serverId) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    const server = getServerById(serverId);
    if (!server) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, { server, user });
    });
  });

  httpServer.listen(port, () => {
    console.log(`> FleetOPS ready on http://${hostname}:${port}`);
    console.log(
      `> WebSocket terminal at ws://${hostname}:${port}/api/ws/terminal`
    );
  });
});
