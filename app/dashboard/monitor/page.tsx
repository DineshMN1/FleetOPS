"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface MonitorData {
  cpuUsage: string;
  memory: { used: string; total: string };
  disk: { used: string; total: string };
  networkIO?: { rx: string; tx: string };
  hostname: string;
  platform?: string;
  uptime: number;
  serverName?: string;
  gpu?: { utilization: string; memUsed: string; memTotal: string } | null;
  error?: string;
}

function MonitorContent() {
  const searchParams = useSearchParams();
  const serverId = searchParams.get("serverId");

  const [servers, setServers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(serverId);
  const [stats, setStats] = useState<MonitorData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data) => setServers(data));
  }, []);

  useEffect(() => {
    setHistory([]);
    setStats(null);
    setError(null);
  }, [selectedId]);

  async function fetchData() {
    try {
      let url = "/api/monitor";
      if (selectedId) {
        url = `/api/monitor/remote?serverId=${selectedId}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setError(null);
      setStats(data);
      setHistory((prev) => {
        const updated = [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            cpu: parseFloat(data.cpuUsage) || 0,
            mem: parseFloat(data.memory?.used) || 0,
            disk: parseFloat(data.disk?.used) || 0,
            netIn: parseFloat(data.networkIO?.rx) || 0,
            netOut: parseFloat(data.networkIO?.tx) || 0,
          },
        ];
        return updated.slice(-25);
      });
    } catch (err) {
      setError("Failed to fetch stats");
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, selectedId ? 8000 : 4000);
    return () => clearInterval(interval);
  }, [selectedId]);

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Monitoring</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
            className="bg-neutral-800 border border-neutral-700 text-sm rounded px-3 py-1.5 text-white focus:outline-none focus:border-neutral-500"
          >
            <option value="">Local Server (this machine)</option>
            {servers.map((srv) => (
              <option key={srv.id} value={String(srv.id)}>
                {srv.name} ({srv.host})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {error}
          {error.includes("authorized_keys") && (
            <p className="mt-2">
              <a href="/dashboard/settings" className="text-blue-400 hover:underline">
                Go to Settings to copy the public key →
              </a>
            </p>
          )}
        </div>
      )}

      {!stats && !error && (
        <p className="text-gray-400 animate-pulse">Loading monitor data...</p>
      )}

      {stats && (
        <>
          <div className="text-sm text-gray-400 flex gap-4 flex-wrap">
            <span>Host: <span className="text-white">{stats.hostname}</span></span>
            {stats.platform && <span>Platform: <span className="text-white">{stats.platform}</span></span>}
            <span>Uptime: <span className="text-white">{Math.floor(stats.uptime / 60)}m</span></span>
            {stats.serverName && (
              <span className="text-green-400">Remote: {stats.serverName}</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MonitorCard
              title="CPU Usage"
              subtitle={`${stats.cpuUsage}%`}
              percent={parseFloat(stats.cpuUsage)}
              data={history}
              dataKey="cpu"
              color="#6366f1"
              unit="%"
            />
            <MonitorCard
              title="Memory"
              subtitle={`${stats.memory.used} / ${stats.memory.total} GiB`}
              percent={
                (parseFloat(stats.memory.used) / parseFloat(stats.memory.total)) * 100
              }
              data={history}
              dataKey="mem"
              color="#10b981"
              unit=" GiB"
            />
            <MonitorCard
              title="Disk Space"
              subtitle={`${stats.disk.used} / ${stats.disk.total} GB`}
              percent={
                (parseFloat(stats.disk.used) / parseFloat(stats.disk.total)) * 100
              }
              data={history}
              dataKey="disk"
              color="#a855f7"
              unit=" GB"
            />
            {stats.networkIO && (
              <MonitorCard
                title="Network I/O"
                subtitle={`In ${stats.networkIO.rx} MB / Out ${stats.networkIO.tx} MB`}
                percent={0}
                data={history}
                dataKey="netIn"
                secondaryKey="netOut"
                color="#0ea5e9"
                secondaryColor="#84cc16"
                unit=" MB"
              />
            )}
            {stats.gpu && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-md">
                <h2 className="text-sm text-gray-300 mb-1">GPU</h2>
                <p className="text-sm text-gray-400 mb-2">
                  Usage: {stats.gpu.utilization}% | VRAM: {stats.gpu.memUsed} / {stats.gpu.memTotal} MiB
                </p>
                <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-3 rounded-full transition-all duration-500 bg-orange-500"
                    style={{ width: `${Math.min(parseFloat(stats.gpu.utilization), 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 animate-pulse">Loading...</p>}>
      <MonitorContent />
    </Suspense>
  );
}

function MonitorCard({
  title,
  subtitle,
  percent,
  data,
  dataKey,
  color,
  unit,
  secondaryKey,
  secondaryColor,
}: {
  title: string;
  subtitle: string;
  percent: number;
  data: any[];
  dataKey: string;
  color: string;
  unit: string;
  secondaryKey?: string;
  secondaryColor?: string;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-md">
      <h2 className="text-sm text-gray-300 mb-1">{title}</h2>
      <p className="text-sm text-gray-400 mb-2">{subtitle}</p>

      <div className="w-full h-3 bg-neutral-800 rounded-full mb-4 overflow-hidden">
        <div
          className="h-3 rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(Math.max(percent, 0), 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
              {secondaryKey && (
                <linearGradient id={`color${secondaryKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={secondaryColor} stopOpacity={0.05} />
                </linearGradient>
              )}
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "#111",
                border: "1px solid #333",
                borderRadius: "8px",
              }}
              formatter={(value) => [`${value}${unit}`, title]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fillOpacity={1}
              fill={`url(#color${dataKey})`}
              strokeWidth={2}
              dot={false}
            />
            {secondaryKey && (
              <Area
                type="monotone"
                dataKey={secondaryKey}
                stroke={secondaryColor}
                fillOpacity={1}
                fill={`url(#color${secondaryKey})`}
                strokeWidth={2}
                dot={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
