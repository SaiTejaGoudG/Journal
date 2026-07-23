"use client";
import { useRouter, usePathname } from 'next/navigation';
import { Home, GraduationCap, Search, FolderOpen, Settings } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/browse", icon: GraduationCap, label: "Learn" },
  { path: "/search", icon: Search, label: "Search" },
  { path: "/collections", icon: FolderOpen, label: "Collections" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <div
      className="bottom-nav fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 pb-safe"
      style={{ background: "rgba(17,24,39,0.95)", borderTop: "1px solid #1F2937", height: 64 }}
    >
      {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
        const active = isActive(path);
        return (
          <button
            key={path}
            data-testid={`bottom-nav-${label.toLowerCase()}`}
            onClick={() => router.push(path)}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all"
            style={{ minWidth: 56 }}
          >
            <Icon
              className="w-5 h-5 transition-all"
              style={{ color: active ? "#6366F1" : "#4B5563" }}
              strokeWidth={active ? 2.5 : 1.5}
            />
            <span
              className="text-xs font-medium transition-all"
              style={{ color: active ? "#6366F1" : "#4B5563" }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
