"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from 'next/navigation';
import { User, Moon, Sun, Shield, LogOut, ChevronRight, Brain, Download } from "lucide-react";
import API from "@/services/api";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/auth");
    } catch (err) {
      console.error(err);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const res = await API.get("/notes", { params: { limit: 500 } });
      const notes = res.data.notes || [];
      const md = notes.map(n =>
        `# ${n.title || "Untitled"}\n\n**Category:** ${n.category}  \n**Created:** ${(n.created_at || "").slice(0, 10)}  \n${n.tags?.length ? `**Tags:** ${n.tags.join(", ")}  \n` : ""}\n---\n\n${n.content || ""}\n\n---\n\n`
      ).join("");
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `second-brain-export-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const bg = theme === "light" ? "#F8FAFC" : "#0F172A";
  const surface = theme === "light" ? "#FFFFFF" : "#111827";
  const border = theme === "light" ? "#E2E8F0" : "#1F2937";
  const textPrimary = theme === "light" ? "#0F172A" : "#E5E7EB";
  const textMuted = theme === "light" ? "#64748B" : "#6B7280";

  return (
    <div className="h-full flex flex-col px-4 lg:px-6 py-6 max-w-2xl" style={{ background: bg }}>
      <h1 className="text-2xl font-semibold mb-6" style={{ color: textPrimary }}>Settings</h1>

      {/* Profile Card */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: surface, border: `1px solid ${border}` }}>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-semibold flex-shrink-0"
            style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8" }}
          >
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: textPrimary }}>{user?.name}</h2>
            <p className="text-sm mt-0.5" style={{ color: textMuted }}>{user?.email}</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
              style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8" }}
            >
              {user?.role || "user"}
            </span>
          </div>
        </div>
      </div>

      {/* Settings List */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: surface, border: `1px solid ${border}` }}>

        {/* Theme Toggle */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: border }}>
          <div className="flex items-center gap-3">
            {theme === "dark"
              ? <Moon className="w-5 h-5" style={{ color: "#6366F1" }} />
              : <Sun className="w-5 h-5" style={{ color: "#F59E0B" }} />
            }
            <div>
              <p className="text-sm font-medium" style={{ color: textPrimary }}>Theme</p>
              <p className="text-xs" style={{ color: textMuted }}>{theme === "dark" ? "Dark Mode" : "Light Mode"}</p>
            </div>
          </div>
          <button
            data-testid="theme-toggle-btn"
            onClick={toggleTheme}
            className="w-12 h-6 rounded-full relative transition-all duration-300"
            style={{ background: theme === "dark" ? "#6366F1" : "#CBD5E1" }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 shadow"
              style={{ background: "#fff", left: theme === "dark" ? "calc(100% - 22px)" : "2px" }}
            />
          </button>
        </div>

        {/* Export All Notes */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b cursor-pointer transition-all"
          style={{ borderColor: border }}
          onClick={handleExportAll}
        >
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5" style={{ color: "#10B981" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: textPrimary }}>Export All Notes</p>
              <p className="text-xs" style={{ color: textMuted }}>Download all notes as Markdown</p>
            </div>
          </div>
          {exporting
            ? <div className="spinner w-4 h-4" />
            : <ChevronRight className="w-4 h-4" style={{ color: "#4B5563" }} />
          }
        </div>

        {/* Privacy */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5" style={{ color: "#10B981" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: textPrimary }}>Privacy</p>
              <p className="text-xs" style={{ color: textMuted }}>Your data stays with you</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4" style={{ color: "#4B5563" }} />
        </div>
      </div>

      {/* App Info */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: surface, border: `1px solid ${border}` }}>
        <div className="flex items-center gap-3 mb-3">
          <Brain className="w-5 h-5" style={{ color: "#6366F1" }} />
          <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>Second Brain</h3>
        </div>
        <div className="space-y-1">
          <p className="text-xs" style={{ color: textMuted }}>Version 1.1.0</p>
          <p className="text-xs" style={{ color: textMuted }}>AI-powered note-taking — Capture, organize, and grow your knowledge.</p>
        </div>
      </div>

      {/* Logout */}
      <button
        data-testid="logout-btn"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex items-center gap-3 px-5 py-4 rounded-2xl w-full transition-all"
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.15)",
          color: "#F87171"
        }}
      >
        {loggingOut ? <div className="spinner w-5 h-5" /> : <LogOut className="w-5 h-5" />}
        <span className="text-sm font-medium">Sign Out</span>
      </button>
    </div>
  );
}
