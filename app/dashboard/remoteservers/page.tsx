"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Globe,
  User,
  Key,
  Clock,
  MoreVertical,
  Terminal as TerminalIcon,
  Activity,
  Pencil,
  Trash2,
  ShieldCheck,
  Server,
} from "lucide-react";
import SSHConsole from "@/components/Terminal";

interface RemoteServer {
  id: number;
  name: string;
  description?: string;
  host: string;
  port: number;
  username: string;
  status?: string;
  created_at?: string;
  ssh_key_id?: number | null;
  ssh_key_name?: string | null;
  ssh_key_type?: string | null;
}

interface SSHKey {
  id: number;
  name: string;
  type: string;
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function StatusBadge({ status }: { status?: string }) {
  const s = status || "unknown";
  const map: Record<string, string> = {
    connected: "bg-green-900/40 text-green-400 border-green-800",
    disconnected: "bg-neutral-800 text-gray-400 border-neutral-700",
    error: "bg-red-900/40 text-red-400 border-red-800",
    auth_failed: "bg-red-900/40 text-red-400 border-red-800",
    no_key: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
    pending: "bg-blue-900/40 text-blue-400 border-blue-800",
    unknown: "bg-neutral-800 text-gray-400 border-neutral-700",
  };
  const dot: Record<string, string> = {
    connected: "bg-green-400",
    disconnected: "bg-neutral-500",
    error: "bg-red-400",
    auth_failed: "bg-red-400",
    no_key: "bg-yellow-400",
    pending: "bg-blue-400",
    unknown: "bg-neutral-500",
  };
  const cls = map[s] || map.unknown;
  const dotCls = dot[s] || dot.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
      {s}
    </span>
  );
}

function ServerCard({
  server,
  onEdit,
  onDelete,
}: {
  server: RemoteServer;
  onEdit: (s: RemoteServer) => void;
  onDelete: (id: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col gap-4 hover:border-neutral-700 transition-colors">
      {/* Card header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
            <Server size={15} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{server.name}</p>
            {server.description && (
              <p className="text-xs text-gray-500 truncate">{server.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={server.status} />
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded text-gray-500 hover:text-white hover:bg-neutral-800 transition"
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-2xl z-20 w-44 py-1 text-sm">
                <button
                  onClick={() => { setShowTerminal(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-neutral-700 hover:text-white transition"
                >
                  <TerminalIcon size={13} /> Terminal
                </button>
                <a
                  href={`/dashboard/monitor?serverId=${server.id}`}
                  className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-neutral-700 hover:text-white transition"
                >
                  <Activity size={13} /> Monitor
                </a>
                <div className="border-t border-neutral-700 my-1" />
                <button
                  onClick={() => { onEdit(server); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-neutral-700 hover:text-white transition"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => { onDelete(server.id); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-900/30 hover:text-red-300 transition"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Server details */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5 text-sm">
          <Globe size={13} className="text-gray-500 shrink-0" />
          <span className="font-mono text-gray-300 text-xs">{server.host}:{server.port || 22}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm">
          <User size={13} className="text-gray-500 shrink-0" />
          <span className="font-mono text-gray-300 text-xs">{server.username}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm">
          <Key size={13} className="text-gray-500 shrink-0" />
          {server.ssh_key_name ? (
            <span className="text-green-400 text-xs flex items-center gap-1">
              <ShieldCheck size={11} /> {server.ssh_key_name}
            </span>
          ) : (
            <span className="text-yellow-400 text-xs">No key assigned</span>
          )}
        </div>
        {server.created_at && (
          <div className="flex items-center gap-2.5 text-sm">
            <Clock size={13} className="text-gray-500 shrink-0" />
            <span className="text-gray-500 text-xs">{formatRelativeTime(server.created_at)}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2 border-t border-neutral-800">
        <a
          href={`/dashboard/monitor?serverId=${server.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-neutral-700 text-gray-400 hover:text-white hover:border-neutral-500 transition"
        >
          <Activity size={12} /> Monitor
        </a>
        <button
          onClick={() => setShowTerminal((v) => !v)}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition ${
            showTerminal
              ? "bg-red-900/30 border border-red-800 text-red-400"
              : "bg-neutral-800 hover:bg-neutral-700 text-white"
          }`}
        >
          <TerminalIcon size={12} />
          {showTerminal ? "Close" : "Terminal"}
        </button>
      </div>

      {showTerminal && (
        <div className="mt-1">
          <SSHConsole server={server} onClose={() => setShowTerminal(false)} />
        </div>
      )}
    </div>
  );
}

export default function RemoteServersPage() {
  const [servers, setServers] = useState<RemoteServer[]>([]);
  const [sshKeys, setSshKeys] = useState<SSHKey[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editServer, setEditServer] = useState<RemoteServer | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    host: "",
    port: 22,
    username: "",
    ssh_key_id: null as number | null,
  });

  const fetchServers = async () => {
    try {
      const res = await fetch("/api/servers");
      if (!res.ok) return setServers([]);
      const data = await res.json();
      setServers(Array.isArray(data) ? data : []);
    } catch {
      setServers([]);
    }
  };

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/sshkeys");
      if (!res.ok) return;
      const data = await res.json();
      setSshKeys(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    fetchServers();
    fetchKeys();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this server?")) return;
    await fetch("/api/servers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchServers();
  };

  const handleEdit = (server: RemoteServer) => {
    setEditServer(server);
    setForm({
      name: server.name,
      description: server.description || "",
      host: server.host,
      port: server.port,
      username: server.username,
      ssh_key_id: server.ssh_key_id ?? null,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    const method = editServer ? "PUT" : "POST";
    const body = editServer ? { ...form, id: editServer.id } : form;
    const res = await fetch("/api/servers", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    const data = await res.json();
    setShowModal(false);
    setEditServer(null);
    setForm({ name: "", description: "", host: "", port: 22, username: "", ssh_key_id: null });
    fetchServers();

    // Auto-test connection on new server creation
    if (!editServer && data.id) {
      fetch("/api/servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.id }),
      }).then(() => fetchServers()).catch(() => {});
    }
  };

  const resetForm = () => {
    setEditServer(null);
    setForm({ name: "", description: "", host: "", port: 22, username: "", ssh_key_id: null });
    setShowModal(true);
  };

  return (
    <div className="text-white">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Remote Servers</h1>
          <p className="text-gray-400 text-sm mt-1">
            {servers.length} server{servers.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <button
          onClick={resetForm}
          className="flex items-center gap-2 bg-white text-black text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
        >
          <Plus size={15} /> Add Server
        </button>
      </div>

      {/* Cards grid */}
      {servers.length === 0 ? (
        <div className="border border-dashed border-neutral-700 rounded-xl py-20 text-center">
          <Server size={32} className="text-neutral-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No servers added yet</p>
          <p className="text-gray-600 text-sm mt-1">
            Click &quot;Add Server&quot; to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servers.map((srv) => (
            <ServerCard
              key={srv.id}
              server={srv}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-1">
              {editServer ? "Edit Server" : "Add Server"}
            </h3>
            <p className="text-gray-500 text-sm mb-5">
              {editServer ? "Update server connection details." : "Configure a new remote server."}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Server Name</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition"
                  placeholder="e.g. Production Web"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Description (optional)</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition"
                  placeholder="e.g. Main nginx server"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Host</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition font-mono"
                  placeholder="192.168.1.1 or server.example.com"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <div className="w-1/3">
                  <label className="text-xs text-gray-400 mb-1 block">Port</label>
                  <input
                    type="number"
                    className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition font-mono"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">Username</label>
                  <input
                    className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition font-mono"
                    placeholder="root or ubuntu"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">SSH Key</label>
                <select
                  className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition"
                  value={form.ssh_key_id ?? ""}
                  onChange={(e) => setForm({ ...form, ssh_key_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">— Select an SSH key —</option>
                  {sshKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.type})
                    </option>
                  ))}
                </select>
                {sshKeys.length === 0 && (
                  <p className="text-xs text-yellow-400 mt-1">
                    No SSH keys found.{" "}
                    <a href="/dashboard/sshkeys" className="underline hover:text-yellow-300">
                      Create one first.
                    </a>
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-neutral-700 text-gray-300 hover:bg-neutral-800 text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.name || !form.host || !form.username}
                className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {editServer ? "Save Changes" : "Add Server"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
