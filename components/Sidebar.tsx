"use client";

import { Home, Activity, Server, LogOut, Key } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };

  const navItem = (href: string, icon: React.ReactNode, label: string) => (
    <Link href={href}>
      <div
        className={`px-3 py-2 mt-1 rounded flex items-center gap-2 transition-colors text-sm ${
          pathname === href
            ? "bg-neutral-700 text-white"
            : "hover:bg-neutral-800 text-gray-300"
        }`}
      >
        {icon}
        {label}
      </div>
    </Link>
  );

  return (
    <div className="h-screen w-64 bg-neutral-900 text-gray-300 flex flex-col justify-between border-r border-neutral-800 shrink-0">
      <div>
        <div className="p-4 text-xl font-bold flex items-center gap-2 border-b border-neutral-800">
          <Server size={20} className="text-green-400" />
          <span>FleetOPS</span>
        </div>

        <nav className="px-2 pt-2">
          <p className="text-xs text-gray-500 px-2 mt-2 mb-1">HOME</p>
          {navItem("/dashboard", <Home size={15} />, "Dashboard")}
          {navItem("/dashboard/monitor", <Activity size={15} />, "Monitor")}

          <p className="text-xs text-gray-500 px-2 mt-4 mb-1">MANAGE</p>
          {navItem("/dashboard/remoteservers", <Server size={15} />, "Remote Servers")}
          {navItem("/dashboard/sshkeys", <Key size={15} />, "SSH Keys")}

        </nav>
      </div>

      <div className="p-4 border-t border-neutral-800">
        <div className="text-sm mb-3">
          <p className="text-gray-500 text-xs mb-0.5">Logged in as</p>
          <p className="text-white font-medium truncate">Admin</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-gray-400 hover:bg-neutral-800 hover:text-white transition-colors text-sm"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  );
}
