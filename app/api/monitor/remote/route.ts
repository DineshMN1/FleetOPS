import { NextRequest, NextResponse } from "next/server";
import { Client } from "ssh2";
import db from "@/lib/db";
import { validateSession } from "@/lib/auth";
import { cookies } from "next/headers";

async function execCommand(conn: Client, cmd: string): Promise<string> {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return resolve("");
      let output = "";
      stream.on("data", (data: Buffer) => {
        output += data.toString();
      });
      stream.stderr.on("data", () => {});
      stream.on("close", () => resolve(output.trim()));
    });
  });
}

function parseStats(
  cpuOut: string,
  memOut: string,
  diskOut: string,
  uptimeOut: string,
  gpuOut: string,
  hostname: string
) {
  // CPU idle from: top -bn1
  const cpuIdleMatch = cpuOut.match(/(\d+\.?\d*)\s*id/);
  const cpuIdle = cpuIdleMatch ? parseFloat(cpuIdleMatch[1]) : 0;
  const cpuUsage = (100 - cpuIdle).toFixed(2);

  // Memory from: free -b
  const memLine = memOut.split("\n").find((l) => l.startsWith("Mem:"));
  let memory = { used: "0.00", total: "0.00" };
  if (memLine) {
    const parts = memLine.split(/\s+/);
    const total = parseInt(parts[1]) || 0;
    const used = parseInt(parts[2]) || 0;
    memory = {
      total: (total / 1024 / 1024 / 1024).toFixed(2),
      used: (used / 1024 / 1024 / 1024).toFixed(2),
    };
  }

  // Disk from: df -B1 /
  const diskLine = diskOut
    .split("\n")
    .find((l) => !l.startsWith("Filesystem") && l.trim());
  let disk = { used: "0.0", total: "0.0" };
  if (diskLine) {
    const parts = diskLine.split(/\s+/);
    disk = {
      total: ((parseInt(parts[1]) || 0) / 1024 / 1024 / 1024).toFixed(1),
      used: ((parseInt(parts[2]) || 0) / 1024 / 1024 / 1024).toFixed(1),
    };
  }

  // Uptime in seconds from: cat /proc/uptime
  const uptimeSeconds = parseFloat(uptimeOut.split(" ")[0]) || 0;

  // GPU from: nvidia-smi csv
  let gpu = null;
  if (
    gpuOut &&
    !gpuOut.includes("not found") &&
    !gpuOut.includes("command not found")
  ) {
    const parts = gpuOut.split(",").map((s) => s.trim());
    if (parts.length >= 3) {
      gpu = {
        utilization: parts[0].replace(" %", ""),
        memUsed: parts[1].replace(" MiB", ""),
        memTotal: parts[2].replace(" MiB", ""),
      };
    }
  }

  return { cpuUsage, memory, disk, uptime: uptimeSeconds, gpu, hostname };
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = validateSession(sessionToken);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serverId = req.nextUrl.searchParams.get("serverId");
  if (!serverId)
    return NextResponse.json({ error: "serverId required" }, { status: 400 });

  const server = db
    .prepare("SELECT * FROM remote_servers WHERE id = ?")
    .get(serverId) as any;

  if (!server)
    return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const keyRow = db.prepare("SELECT private_key FROM ssh_keys WHERE id = ?").get(server.ssh_key_id) as any;
  if (!keyRow) {
    return NextResponse.json({ error: "No SSH key assigned to this server. Go to Remote Servers to assign a key." }, { status: 400 });
  }
  const privateKey = keyRow.private_key;

  const conn = new Client();
  try {
    await new Promise<void>((resolve, reject) => {
      conn
        .on("ready", resolve)
        .on("error", reject)
        .connect({
          host: server.host,
          port: server.port || 22,
          username: server.username,
          privateKey,
          readyTimeout: 10000,
        });
    });

    const [cpuOut, memOut, diskOut, uptimeOut, gpuOut, hostnameOut] =
      await Promise.all([
        execCommand(conn, "top -bn1 | grep 'Cpu(s)'"),
        execCommand(conn, "free -b"),
        execCommand(conn, "df -B1 /"),
        execCommand(conn, "cat /proc/uptime"),
        execCommand(
          conn,
          "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader 2>/dev/null || echo 'not found'"
        ),
        execCommand(conn, "hostname"),
      ]);

    conn.end();

    const stats = parseStats(
      cpuOut,
      memOut,
      diskOut,
      uptimeOut,
      gpuOut,
      hostnameOut || server.host
    );

    return NextResponse.json({
      ...stats,
      serverName: server.name,
      serverHost: server.host,
    });
  } catch (err: any) {
    try { conn.end(); } catch {}
    const msg: string = err.message || "SSH connection failed";
    const friendly =
      msg.includes("authentication methods failed") || msg.includes("auth")
        ? "SSH key authentication failed. Make sure the FleetOPS public key is added to ~/.ssh/authorized_keys on this server. Go to Settings to copy the public key."
        : msg.includes("connect ECONNREFUSED") || msg.includes("ECONNREFUSED")
        ? `Connection refused on ${server.host}:${server.port || 22}. Check the host/port and that SSH is running.`
        : msg.includes("ETIMEDOUT") || msg.includes("timed out")
        ? `Connection to ${server.host} timed out. Check network connectivity.`
        : msg;
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
