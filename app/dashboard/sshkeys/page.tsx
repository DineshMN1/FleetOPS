"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Sparkles,
  Upload,
  X,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";

interface SSHKey {
  id: number;
  name: string;
  description?: string;
  type: string;
  public_key: string;
  created_at?: string;
}

function fingerprint(pubKey: string): string {
  try {
    const b64 = pubKey.split(" ")[1];
    if (!b64) return "";
    // Browser-compatible SHA256 fingerprint (approximate display only)
    return "SHA256:…" + b64.slice(-8);
  } catch { return ""; }
}

function formatDate(ts?: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type ModalMode = "generate" | "import" | null;

export default function SSHKeysPage() {
  const [keys, setKeys] = useState<SSHKey[]>([]);
  const [mode, setMode] = useState<ModalMode>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Generate form
  const [genName, setGenName] = useState("");
  const [genDesc, setGenDesc] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<{ publicKey: string; fingerprint: string } | null>(null);

  // Import form
  const [impName, setImpName] = useState("");
  const [impDesc, setImpDesc] = useState("");
  const [impPriv, setImpPriv] = useState("");
  const [impPub, setImpPub] = useState("");
  const [impLoading, setImpLoading] = useState(false);
  const [impError, setImpError] = useState("");

  const fetchKeys = async () => {
    const res = await fetch("/api/sshkeys");
    const data = await res.json();
    setKeys(Array.isArray(data) ? data : []);
  };

  useEffect(() => { fetchKeys(); }, []);

  const copyKey = (id: number, pubKey: string) => {
    navigator.clipboard.writeText(pubKey);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: number) => {
    setDeleteError(null);
    const res = await fetch("/api/sshkeys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDeleteError(data.error || "Delete failed");
      setDeleteConfirm(null);
      return;
    }
    setDeleteConfirm(null);
    fetchKeys();
  };

  const closeModal = () => {
    setMode(null);
    setGenName(""); setGenDesc(""); setGenLoading(false); setGenResult(null);
    setImpName(""); setImpDesc(""); setImpPriv(""); setImpPub(""); setImpLoading(false); setImpError("");
  };

  const handleGenerate = async () => {
    if (!genName.trim()) return;
    setGenLoading(true);
    const res = await fetch("/api/sshkeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", name: genName, description: genDesc }),
    });
    const data = await res.json();
    setGenLoading(false);
    if (!res.ok) return;
    setGenResult({ publicKey: data.publicKey, fingerprint: data.fingerprint });
    fetchKeys();
  };

  const handleImport = async () => {
    if (!impName.trim() || !impPriv.trim() || !impPub.trim()) {
      setImpError("Name, private key, and public key are all required.");
      return;
    }
    setImpLoading(true);
    setImpError("");
    const res = await fetch("/api/sshkeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import", name: impName, description: impDesc, privateKey: impPriv, publicKey: impPub }),
    });
    const data = await res.json();
    setImpLoading(false);
    if (!res.ok) { setImpError(data.error || "Import failed"); return; }
    closeModal();
    fetchKeys();
  };

  const TypeBadge = ({ type }: { type: string }) => {
    const colors: Record<string, string> = {
      "ed25519": "bg-green-900/40 text-green-400 border-green-800/50",
      "rsa": "bg-blue-900/40 text-blue-400 border-blue-800/50",
      "ecdsa": "bg-purple-900/40 text-purple-400 border-purple-800/50",
      "dsa": "bg-yellow-900/40 text-yellow-400 border-yellow-800/50",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border font-mono uppercase ${colors[type] || "bg-neutral-800 text-gray-400 border-neutral-700"}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-6 gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">SSH Keys</h1>
          <p className="text-gray-400 text-sm mt-1">Manage SSH credentials for server connections</p>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 bg-white text-black text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
          >
            <Plus size={15} /> Add Key <ChevronDown size={13} />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl z-10 w-52 py-1">
              <button
                onClick={() => { setMode("generate"); setDropdownOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-neutral-700 transition"
              >
                <Sparkles size={15} className="text-yellow-400" />
                <div className="text-left">
                  <div className="font-medium">Generate Key</div>
                  <div className="text-xs text-gray-400">Create new ED25519 key</div>
                </div>
              </button>
              <button
                onClick={() => { setMode("import"); setDropdownOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-neutral-700 transition"
              >
                <Upload size={15} className="text-blue-400" />
                <div className="text-left">
                  <div className="font-medium">Import Key</div>
                  <div className="text-xs text-gray-400">Paste existing keypair</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {deleteError && (
        <div className="mb-4 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm">
          {deleteError}
        </div>
      )}

      {/* Keys list */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {keys.length === 0 ? (
          <div className="py-20 text-center">
            <Key size={32} className="text-neutral-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No SSH keys yet</p>
            <p className="text-gray-600 text-sm mt-1">Generate or import a key to get started</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="py-3 px-5 text-left w-8">#</th>
                    <th className="py-3 px-5 text-left">Name</th>
                    <th className="py-3 px-5 text-left">Type</th>
                    <th className="py-3 px-5 text-left">Public Key</th>
                    <th className="py-3 px-5 text-left">Created</th>
                    <th className="py-3 px-5 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key, i) => (
                    <tr key={key.id} className="border-t border-neutral-800 hover:bg-neutral-800/30 transition">
                      <td className="py-4 px-5 text-gray-500 font-mono text-xs">{i + 1}</td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <Key size={13} className="text-gray-500 shrink-0" />
                          <div>
                            <p className="font-medium text-white">{key.name}</p>
                            {key.description && <p className="text-xs text-gray-500">{key.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5"><TypeBadge type={key.type || "ed25519"} /></td>
                      <td className="py-4 px-5 max-w-xs">
                        <code className="text-xs font-mono text-gray-300 bg-neutral-800 px-2 py-1 rounded block truncate">
                          {key.public_key?.split(" ").slice(0, 2).join(" ").slice(0, 60)}…
                        </code>
                      </td>
                      <td className="py-4 px-5 text-gray-500 text-xs">{formatDate(key.created_at)}</td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => copyKey(key.id, key.public_key)}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-gray-400 hover:text-white hover:border-neutral-500 transition">
                            {copiedId === key.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            {copiedId === key.id ? "Copied" : "Copy"}
                          </button>
                          {deleteConfirm === key.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(key.id)}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-white transition">Confirm</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-500 hover:text-white px-1">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(key.id)}
                              className="p-1.5 rounded-lg border border-neutral-700 text-gray-500 hover:text-red-400 hover:border-red-800 transition">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-neutral-800">
              {keys.map((key) => (
                <div key={key.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Key size={14} className="text-gray-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">{key.name}</p>
                        {key.description && <p className="text-xs text-gray-500 truncate">{key.description}</p>}
                      </div>
                    </div>
                    <TypeBadge type={key.type || "ed25519"} />
                  </div>
                  <code className="text-xs font-mono text-gray-400 bg-neutral-800 px-2.5 py-1.5 rounded-lg block truncate">
                    {key.public_key?.split(" ").slice(0, 2).join(" ").slice(0, 50)}…
                  </code>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{formatDate(key.created_at)}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copyKey(key.id, key.public_key)}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-gray-400 hover:text-white transition">
                        {copiedId === key.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        {copiedId === key.id ? "Copied" : "Copy"}
                      </button>
                      {deleteConfirm === key.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(key.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-red-800 text-white">Confirm</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-500 px-1">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(key.id)}
                          className="p-1.5 rounded-lg border border-neutral-700 text-gray-500 hover:text-red-400 hover:border-red-800 transition">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Generate Modal */}
      {mode === "generate" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold">Generate SSH Key</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
            </div>
            <p className="text-gray-500 text-sm mb-5">A new ED25519 keypair will be generated. The private key is stored securely and never shown again.</p>

            {!genResult ? (
              <>
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Key Name *</label>
                    <input
                      className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Production Key"
                      value={genName}
                      onChange={(e) => setGenName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Description (optional)</label>
                    <input
                      className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Used for Raspberry Pi"
                      value={genDesc}
                      onChange={(e) => setGenDesc(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 py-2 text-xs text-gray-500">
                    <ShieldCheck size={12} className="text-green-400 shrink-0" />
                    ED25519 — Fast, secure, 256-bit
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-neutral-700 text-gray-300 hover:bg-neutral-800 text-sm">Cancel</button>
                  <button
                    onClick={handleGenerate}
                    disabled={!genName.trim() || genLoading}
                    className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 disabled:opacity-40 flex items-center gap-2"
                  >
                    <Sparkles size={14} />
                    {genLoading ? "Generating..." : "Generate"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 bg-green-900/20 border border-green-800/50 rounded-xl px-4 py-3 text-sm text-green-400 flex items-center gap-2">
                  <Check size={15} /> Key generated successfully
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-400">Public Key — add to <code className="text-green-400 bg-neutral-800 px-1 rounded">~/.ssh/authorized_keys</code></p>
                  </div>
                  <pre className="bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-xs text-green-400 font-mono break-all whitespace-pre-wrap select-all">
                    {genResult.publicKey}
                  </pre>
                  <p className="text-xs text-gray-600 mt-1">Fingerprint: <span className="text-yellow-400/80 font-mono">{genResult.fingerprint}</span></p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { navigator.clipboard.writeText(genResult.publicKey); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 text-gray-300 hover:bg-neutral-800 text-sm"
                  >
                    <Copy size={14} /> Copy Public Key
                  </button>
                  <button onClick={closeModal} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100">Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import Modal */}
      {mode === "import" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold">Import SSH Key</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
            </div>
            <p className="text-gray-500 text-sm mb-5">Paste an existing keypair. The private key will be stored securely and never shown again.</p>

            {impError && (
              <div className="mb-4 bg-red-900/30 border border-red-800 rounded-xl px-4 py-2 text-red-400 text-sm">{impError}</div>
            )}

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Key Name *</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. My RSA Key"
                  value={impName}
                  onChange={(e) => setImpName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Description (optional)</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Optional description"
                  value={impDesc}
                  onChange={(e) => setImpDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Private Key *</label>
                <textarea
                  className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500 resize-none"
                  placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                  rows={5}
                  value={impPriv}
                  onChange={(e) => setImpPriv(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Public Key *</label>
                <textarea
                  className="w-full bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="ssh-ed25519 AAAA... user@host"
                  rows={2}
                  value={impPub}
                  onChange={(e) => setImpPub(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-neutral-700 text-gray-300 hover:bg-neutral-800 text-sm">Cancel</button>
              <button
                onClick={handleImport}
                disabled={!impName.trim() || !impPriv.trim() || !impPub.trim() || impLoading}
                className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 disabled:opacity-40 flex items-center gap-2"
              >
                <Upload size={14} />
                {impLoading ? "Importing..." : "Import Key"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
