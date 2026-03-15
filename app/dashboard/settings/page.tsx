"use client";

import { useEffect, useState } from "react";
import { Copy, RefreshCw, Check, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  const [publicKey, setPublicKey] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setPublicKey(d.publicKey || "");
        setFingerprint(d.fingerprint || "");
      });
  }, []);

  const copyKey = () => {
    navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!confirmRegen) {
      setConfirmRegen(true);
      return;
    }
    setRegenerating(true);
    setConfirmRegen(false);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate" }),
    });
    const data = await res.json();
    setPublicKey(data.publicKey || "");
    setFingerprint(data.fingerprint || "");
    setRegenerating(false);
  };

  return (
    <div className="text-white space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Manage your FleetOPS application configuration.
        </p>
      </div>

      {/* SSH Key Section */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={18} className="text-green-400" />
          <h2 className="text-lg font-semibold">Application SSH Key</h2>
        </div>
        <p className="text-gray-400 text-sm mb-5">
          FleetOPS uses a single application-level ED25519 keypair for all server
          connections. Add the public key below to{" "}
          <code className="bg-neutral-800 px-1 rounded text-green-400">
            ~/.ssh/authorized_keys
          </code>{" "}
          on each server you want to manage.
        </p>

        {/* Fingerprint */}
        {fingerprint && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-1">Key Fingerprint</p>
            <code className="text-xs font-mono text-yellow-400 bg-neutral-800 px-3 py-1.5 rounded block">
              {fingerprint}
            </code>
          </div>
        )}

        {/* Public Key Display */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Public Key (add to authorized_keys)</p>
            <button
              onClick={copyKey}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-xs text-green-400 font-mono break-all whitespace-pre-wrap">
            {publicKey || "Loading..."}
          </pre>
        </div>

        {/* Install Instructions */}
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4 mb-5">
          <p className="text-xs font-semibold text-gray-300 mb-2">
            How to authorize FleetOPS on a server:
          </p>
          <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside">
            <li>
              SSH into your target server as the user FleetOPS should connect as.
            </li>
            <li>
              Run:{" "}
              <code className="bg-neutral-900 text-green-400 px-1 rounded font-mono">
                mkdir -p ~/.ssh && chmod 700 ~/.ssh
              </code>
            </li>
            <li>
              Append the public key above:{" "}
              <code className="bg-neutral-900 text-green-400 px-1 rounded font-mono">
                echo &apos;{publicKey.split(" ").slice(0, 2).join(" ")} ...&apos; {">>"} ~/.ssh/authorized_keys
              </code>
            </li>
            <li>
              Set permissions:{" "}
              <code className="bg-neutral-900 text-green-400 px-1 rounded font-mono">
                chmod 600 ~/.ssh/authorized_keys
              </code>
            </li>
            <li>
              Add the server in{" "}
              <a href="/dashboard/remoteservers" className="text-blue-400 hover:underline">
                Remote Servers
              </a>{" "}
              and click &quot;Launch Terminal&quot;.
            </li>
          </ol>
        </div>

        {/* Regenerate */}
        <div className="border-t border-neutral-700 pt-4">
          <p className="text-xs text-gray-500 mb-3">
            Regenerating will create a new keypair. You will need to re-authorize FleetOPS
            on all your servers.
          </p>
          {confirmRegen && (
            <p className="text-sm text-red-400 mb-3">
              Are you sure? This will break all existing server connections until
              you update authorized_keys.
            </p>
          )}
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition ${
              confirmRegen
                ? "bg-red-700 hover:bg-red-600 text-white"
                : "border border-neutral-600 text-gray-400 hover:text-white hover:border-neutral-400"
            } disabled:opacity-50`}
          >
            <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} />
            {regenerating
              ? "Regenerating..."
              : confirmRegen
              ? "Confirm Regenerate"
              : "Regenerate Keypair"}
          </button>
          {confirmRegen && (
            <button
              onClick={() => setConfirmRegen(false)}
              className="ml-3 text-sm text-gray-500 hover:text-white"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
