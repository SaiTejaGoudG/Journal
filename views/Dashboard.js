"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/contexts/AuthContext";
import API from "@/services/api";
import NoteCard from "@/components/NoteCard";
import { syncPendingOps, getPendingQueue, cacheNotes, getCachedNotes } from "@/services/offlineSync";
import useWebSocket from "@/hooks/useWebSocket";
import {
  LayoutGrid, List, Star, BookOpen, Lightbulb, Code2, WifiOff, RefreshCw
} from "lucide-react";

const CATEGORIES = [
  { id: "", name: "All", icon: BookOpen, color: "#9CA3AF" },
  { id: "Technical", name: "Technical", icon: Code2, color: "#6366F1" },
  { id: "Content Creation", name: "Content", icon: Star, color: "#EC4899" },
  { id: "Ideas", name: "Ideas", icon: Lightbulb, color: "#F59E0B" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState([]);
  const [stats, setStats] = useState(null);
  const [category, setCategory] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isOnlineState, setIsOnlineState] = useState(true); // default true; corrected in useEffect
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const { lastEvent, connected } = useWebSocket();

  // Offline detection
  useEffect(() => {
    const on = () => setIsOnlineState(true);
    const off = () => setIsOnlineState(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setPendingCount(getPendingQueue().length);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (category) params.category = category;
      const res = await API.get("/notes", { params });
      const fetched = res.data.notes;
      if (page === 1) {
        setNotes(fetched);
        cacheNotes(fetched);
      } else {
        setNotes(prev => [...prev, ...fetched]);
      }
      setTotal(res.data.total);
    } catch {
      // Offline fallback: use cache
      if (page === 1) {
        const cached = getCachedNotes();
        if (cached) setNotes(cached);
      }
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await API.get("/stats");
      setStats(res.data);
    } catch (_) {}
  }, []);

  // Auto-sync pending ops when coming back online
  useEffect(() => {
    if (isOnlineState && getPendingQueue().length > 0) {
      handleSync();
    }
  }, [isOnlineState]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const synced = await syncPendingOps(API);
      if (synced > 0) {
        setPage(1);
        setNotes([]);
        fetchNotes();
        fetchStats();
      }
      setPendingCount(getPendingQueue().length);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setNotes([]);
  }, [category]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // WebSocket: refresh on note events
  useEffect(() => {
    if (!lastEvent) return;
    if (["note_created", "note_updated", "note_deleted"].includes(lastEvent.type)) {
      setPage(1);
      setNotes([]);
      fetchNotes();
      fetchStats();
    }
  }, [lastEvent]);

  const handleNoteAction = (action, noteId) => {
    if (action === "delete" || action === "archive") {
      setNotes(prev => prev.filter(n => n.id !== noteId));
      setTotal(prev => prev - 1);
      fetchStats();
    } else if (action === "favorite" || action === "pin") {
      setNotes(prev => prev.map(n => {
        if (n.id !== noteId) return n;
        if (action === "favorite") return { ...n, is_favorite: !n.is_favorite };
        if (action === "pin") return { ...n, is_pinned: !n.is_pinned };
        return n;
      }));
      fetchStats();
    }
  };

  const greetTime = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const pinnedNotes = notes.filter(n => n.is_pinned);
  const regularNotes = notes.filter(n => !n.is_pinned);

  return (
    <div className="h-full flex flex-col" style={{ background: "#0F172A" }}>

      {/* Offline / Sync Banner */}
      {!isOnlineState && (
        <div
          data-testid="offline-banner"
          className="flex items-center justify-center gap-2 py-2 text-xs font-medium"
          style={{ background: "#7C2D12", color: "#FECACA" }}
        >
          <WifiOff className="w-3.5 h-3.5" />
          You're offline
          {pendingCount > 0 && <span> — {pendingCount} changes pending sync</span>}
        </div>
      )}
      {isOnlineState && pendingCount > 0 && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs font-medium" style={{ background: "#064E3B", color: "#A7F3D0" }}>
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : `${pendingCount} offline changes ready to sync`}
          {!syncing && (
            <button onClick={handleSync} className="underline ml-1">Sync now</button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex-none px-4 lg:px-6 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "#E5E7EB" }}>
              {greetTime()}, {user?.name?.split(" ")[0]}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm" style={{ color: "#6B7280" }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              {connected && (
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} title="Live sync active" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="view-toggle-grid"
              onClick={() => setViewMode("grid")}
              className="p-2 rounded-lg transition-all"
              style={{
                background: viewMode === "grid" ? "rgba(99,102,241,0.15)" : "transparent",
                color: viewMode === "grid" ? "#818CF8" : "#6B7280"
              }}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              data-testid="view-toggle-list"
              onClick={() => setViewMode("list")}
              className="p-2 rounded-lg transition-all"
              style={{
                background: viewMode === "list" ? "rgba(99,102,241,0.15)" : "transparent",
                color: viewMode === "list" ? "#818CF8" : "#6B7280"
              }}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Notes", value: stats.total_notes, icon: BookOpen, color: "#6366F1" },
              { label: "Favorites", value: stats.favorites, icon: Star, color: "#EC4899" },
              { label: "Collections", value: stats.collections, icon: LayoutGrid, color: "#F59E0B" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                data-testid={`stat-${label.toLowerCase()}`}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: "#111827", border: "1px solid #1F2937" }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-lg font-semibold leading-tight" style={{ color: "#E5E7EB" }}>{value}</p>
                  <p className="text-xs" style={{ color: "#6B7280" }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Category Tabs */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              data-testid={`category-tab-${cat.id || "all"}`}
              onClick={() => setCategory(cat.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium flex-shrink-0 transition-all duration-200"
              style={{
                background: category === cat.id ? `${cat.color}20` : "#111827",
                color: category === cat.id ? cat.color : "#6B7280",
                border: `1px solid ${category === cat.id ? `${cat.color}40` : "#1F2937"}`,
              }}
            >
              <cat.icon className="w-3.5 h-3.5" />
              {cat.name}
              {stats?.by_category?.[cat.id] !== undefined && cat.id && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${cat.color}25`, color: cat.color }}>
                  {stats.by_category[cat.id] || 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Area */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-24">
        {loading && page === 1 ? (
          <div className="flex items-center justify-center h-40">
            <div className="spinner w-8 h-8" />
          </div>
        ) : notes.length === 0 ? (
          <div data-testid="empty-state" className="flex flex-col items-center justify-center h-64 text-center fade-in">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}
            >
              <BookOpen className="w-8 h-8" style={{ color: "#6366F1" }} />
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: "#E5E7EB" }}>No notes yet</h3>
            <p className="text-sm mb-4" style={{ color: "#6B7280" }}>Tap the + button to capture your first thought</p>
            <button
              data-testid="create-first-note-btn"
              onClick={() => router.push("/notes/new")}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: "#6366F1", color: "#fff" }}
            >
              Create Note
            </button>
          </div>
        ) : (
          <>
            {/* Pinned Notes */}
            {pinnedNotes.length > 0 && (
              <div className="mb-6 stagger-children">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#F59E0B" }} />
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "#6B7280" }}>Pinned</span>
                </div>
                <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
                  {pinnedNotes.map(note => (
                    <NoteCard key={note.id} note={note} onAction={handleNoteAction} view={viewMode} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Notes */}
            {regularNotes.length > 0 && (
              <div className="stagger-children">
                {pinnedNotes.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#6366F1" }} />
                    <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "#6B7280" }}>Recent</span>
                  </div>
                )}
                <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
                  {regularNotes.map(note => (
                    <NoteCard key={note.id} note={note} onAction={handleNoteAction} view={viewMode} />
                  ))}
                </div>
              </div>
            )}

            {/* Load More */}
            {notes.length < total && (
              <div className="flex justify-center mt-6">
                <button
                  data-testid="load-more-btn"
                  onClick={() => setPage(p => p + 1)}
                  disabled={loading}
                  className="px-6 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ background: "#111827", color: "#9CA3AF", border: "1px solid #1F2937" }}
                >
                  {loading ? <div className="spinner w-4 h-4 mx-auto" /> : `Load more (${total - notes.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
