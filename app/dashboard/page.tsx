"use client";

import { useState, useEffect } from "react";
import SSHConsole from "@/components/Terminal";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [openTerminals, setOpenTerminals] = useState<Set<number>>(new Set());

  const fetchServers = async () => {
    try {
      const res = await fetch("/api/servers");
      const data = await res.json();
      setServers(data);
    } catch (err) {
      console.error("Failed to load servers", err);
    }
  };

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 10000);
    return () => clearInterval(interval);
  }, []);

  const openTerminal = (srv: any) => {
    setOpenTerminals((prev) => new Set(prev).add(srv.id));
  };

  const closeTerminal = (id: number) => {
    setOpenTerminals((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div className="text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Fleet Dashboard</h2>
        <span className="text-sm text-gray-500">{servers.length} server{servers.length !== 1 ? "s" : ""} configured</span>
      </div>

      {servers.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No servers configured</p>
          <p className="text-sm">
            Go to{" "}
            <a href="/dashboard/remoteservers" className="text-blue-400 hover:underline">
              Remote Servers
            </a>{" "}
            to add your first server.
          </p>
        </div>
      ) : (
        servers.map((srv) => (
          <div
            key={srv.id}
            className="mb-6 border border-neutral-800 rounded-lg p-4 bg-neutral-900/60"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">{srv.name}</h3>
                <p className="text-sm text-gray-400 font-mono">
                  {srv.username}@{srv.host}:{srv.port || 22}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {srv.ssh_key_name && (
                    <span className="text-xs text-gray-500">
                      Key: {srv.ssh_key_name}
                    </span>
                  )}
                  {srv.description && (
                    <span className="text-xs text-gray-600">{srv.description}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/dashboard/monitor?serverId=${srv.id}`}
                  className="text-xs px-3 py-1.5 rounded border border-neutral-700 text-gray-400 hover:text-white hover:border-neutral-500 transition"
                >
                  Monitor
                </a>
                {openTerminals.has(srv.id) ? (
                  <button
                    onClick={() => closeTerminal(srv.id)}
                    className="text-xs px-3 py-1.5 rounded border border-red-800 text-red-400 hover:bg-red-900/30 transition"
                  >
                    Close Terminal
                  </button>
                ) : (
                  <Button
                    onClick={() => openTerminal(srv)}
                    className="bg-green-700 hover:bg-green-600 text-white text-sm"
                  >
                    Launch Terminal
                  </Button>
                )}
              </div>
            </div>

            {openTerminals.has(srv.id) && (
              <div className="mt-4 relative">
                <SSHConsole
                  server={srv}
                  onClose={() => closeTerminal(srv.id)}
                />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
