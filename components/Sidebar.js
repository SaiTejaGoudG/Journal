"use client";
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from "@/contexts/AuthContext";
import {
  Brain, Home, Search, Star, FolderOpen, CalendarDays, Settings,
  Code2, Sparkles, Lightbulb, ChevronRight, LogOut, GraduationCap
} from "lucide-react";
import { useState, useEffect } from "react";
import API from "@/services/api";

const NAV_ITEMS = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/browse", icon: GraduationCap, label: "Learn" },
  { path: "/search", icon: Search, label: "Search" },
  { path: "/favorites", icon: Star, label: "Favorites" },
  { path: "/collections", icon: FolderOpen, label: "Collections" },
  { path: "/daily-dump", icon: CalendarDays, label: "Daily Dump" },
];

const CATEGORIES = [
  { id: "Technical", icon: Code2, color: "#6366F1" },
  { id: "Content Creation", icon: Sparkles, color: "#EC4899" },
  { id: "Ideas", icon: Lightbulb, color: "#F59E0B" },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    API.get("/categories").then(res => setCategories(res.data)).catch(() => {});
    API.get("/tags").then(res => setTags(res.data.slice(0, 10))).catch(() => {});
  }, []);

  const isActive = (path) => {
    if (path === "/" ) return pathname === "/";
    return pathname.startsWith(path);
  };

  const getCatCount = (catId) => categories.find(c => c.id === catId)?.note_count || 0;

  return (
    <div className="h-full flex flex-col py-5 px-3 overflow-y-auto" style={{ background: "#111827", borderRight: "1px solid #1F2937" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-7">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <Brain className="w-4 h-4" style={{ color: "#6366F1" }} />
        </div>
        <div>
          <span className="font-semibold text-sm" style={{ color: "#E5E7EB" }}>Second Brain</span>
          <p className="text-xs" style={{ color: "#4B5563" }}>Personal KM</p>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="space-y-1 mb-6">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <button
            key={path}
            data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
            onClick={() => router.push(path)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 sidebar-item ${isActive(path) ? "sidebar-active" : ""}`}
            style={{ color: isActive(path) ? "#818CF8" : "#6B7280" }}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Categories */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest px-3 mb-2" style={{ color: "#374151" }}>Categories</p>
        <div className="space-y-1">
          {CATEGORIES.map(({ id, icon: Icon, color }) => (
            <button
              key={id}
              data-testid={`sidebar-cat-${id.replace(" ", "-")}`}
              onClick={() => router.push(`/?category=${encodeURIComponent(id)}`)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all duration-150 sidebar-item"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <span style={{ color: "#9CA3AF" }}>{id}</span>
              </div>
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>
                {getCatCount(id)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Tags */}
      {tags.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-widest px-3 mb-2" style={{ color: "#374151" }}>Recent Tags</p>
          <div className="px-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 8).map(tag => (
              <button
                key={tag.name}
                data-testid={`sidebar-tag-${tag.name}`}
                onClick={() => router.push(`/?tag=${encodeURIComponent(tag.name)}`)}
                className="px-2 py-1 rounded-full text-xs transition-all tag-default"
              >
                #{tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom - User + Settings */}
      <div className="mt-auto space-y-1">
        <button
          data-testid="nav-settings"
          onClick={() => router.push("/settings")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all sidebar-item ${isActive("/settings") ? "sidebar-active" : ""}`}
          style={{ color: isActive("/settings") ? "#818CF8" : "#6B7280" }}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ background: "rgba(99,102,241,0.2)", color: "#818CF8" }}>
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: "#9CA3AF" }}>{user?.name}</p>
            <p className="text-xs truncate" style={{ color: "#4B5563" }}>{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
