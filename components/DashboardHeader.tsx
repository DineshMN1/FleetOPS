"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

const PAGE_NAMES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/monitor": "Monitoring",
  "/dashboard/remoteservers": "Remote Servers",
  "/dashboard/sshkeys": "SSH Keys",
  "/dashboard/profile": "Profile",
};

export default function DashboardHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const name = PAGE_NAMES[pathname] ?? "Dashboard";

  return (
    <header className="h-14 border-b border-neutral-800 bg-neutral-950 flex items-center px-4 shrink-0 gap-3">
      {/* Hamburger — only on mobile */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg text-white bg-neutral-800 active:bg-neutral-700 transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-gray-400 hidden sm:inline">FleetOPS</span>
        <span className="text-gray-700 hidden sm:inline">/</span>
        <span className="text-sm text-white font-medium truncate">{name}</span>
      </div>
    </header>
  );
}
