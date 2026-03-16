"use client";

import { useEffect, useRef, useState } from "react";
import { X, AlertTriangle, Key } from "lucide-react";
import "xterm/css/xterm.css";

interface TerminalProps {
  server: { id: number; name: string; host: string; port?: number; username?: string };
  onClose?: () => void;
}

export default function SSHConsole({ server, onClose }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "error" | "disconnected">("connecting");
  const [errorMsg, setErrorMsg] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    let term: any = null;
    let ws: WebSocket | null = null;
    let cancelled = false;

    const init = async () => {
      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");

      if (cancelled) return;

      if (terminalRef.current) terminalRef.current.innerHTML = "";

      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
        theme: {
          background: "#0a0a0a",
          foreground: "#00ff99",
          cursor: "#00ff99",
          selectionBackground: "#00ff9944",
        },
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current!);

      requestAnimationFrame(() => {
        if (!cancelled) fitAddon.fit();
      });

      const resizeObserver = new ResizeObserver(() => {
        if (!cancelled) fitAddon.fit();
      });
      if (terminalRef.current) resizeObserver.observe(terminalRef.current);

      term.writeln(`\x1b[33mConnecting to ${server.name} (${server.host}:${server.port || 22})...\x1b[0m`);

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/terminal?serverId=${server.id}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "data") {
            const binary = atob(msg.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            term.write(bytes);
          } else if (msg.type === "status") {
            if (msg.status === "connected") {
              setStatus("connected");
            } else if (msg.status === "closed") {
              setStatus("disconnected");
              term.writeln("\r\n\x1b[31mSSH session closed.\x1b[0m");
            }
          } else if (msg.type === "error") {
            setStatus("error");
            setErrorMsg(msg.message || "Connection error");
            term.writeln(`\r\n\x1b[31mError: ${msg.message}\x1b[0m`);
          }
        } catch {
          term.write(event.data);
        }
      };

      ws.onclose = () => { if (!cancelled) setStatus("disconnected"); };
      ws.onerror = () => {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg("WebSocket connection failed");
          term.writeln("\r\n\x1b[31mWebSocket connection failed.\x1b[0m");
        }
      };

      term.onData((data: string) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          const bytes = new TextEncoder().encode(data);
          let binary = "";
          bytes.forEach((b) => { binary += String.fromCharCode(b); });
          ws.send(JSON.stringify({ type: "data", data: btoa(binary) }));
        }
      });

      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });
    };

    init();

    return () => {
      cancelled = true;
      if (ws) ws.close();
      if (term) term.dispose();
      wsRef.current = null;
    };
  }, [server.id]);

  const statusDot = {
    connecting: "bg-yellow-400 animate-pulse",
    connected:  "bg-green-400",
    error:      "bg-red-400",
    disconnected: "bg-neutral-500",
  }[status];

  const statusLabel = {
    connecting:   "Connecting...",
    connected:    "Connected",
    error:        "Error",
    disconnected: "Disconnected",
  }[status];

  return (
    <div className="w-full rounded-xl overflow-hidden border border-neutral-700/80 shadow-2xl bg-[#0a0a0a]">
      {/* Terminal title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/90 border-b border-neutral-800 relative">
        {/* Connection info */}
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          <span className="text-xs text-neutral-400 font-mono">
            {server.username ? `${server.username}@` : ""}{server.host}
          </span>
          <span className="text-[10px] text-neutral-600">·</span>
          <span className="text-[10px] text-neutral-500">{statusLabel}</span>
        </div>

        {/* Right: error link or close */}
        <div className="flex items-center gap-2">
          {status === "error" && (
            <a
              href="/dashboard/sshkeys"
              className="flex items-center gap-1 text-[10px] text-yellow-500 hover:text-yellow-400 transition"
            >
              <Key size={10} /> Fix keys
            </a>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center rounded text-neutral-500 hover:text-white hover:bg-neutral-700 transition"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {status === "error" && errorMsg && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border-b border-red-900/50 text-red-400 text-xs">
          <AlertTriangle size={12} className="shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* xterm canvas */}
      <div ref={terminalRef} className="h-72 md:h-80 p-1" />
    </div>
  );
}
