"use client";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import API from "@/services/api";
import NoteCard from "@/components/NoteCard";
import { CalendarDays, Plus, Send, ChevronLeft, ChevronRight } from "lucide-react";

function formatDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function toDateStr(date) {
  return date.toISOString().split("T")[0];
}

export default function DailyDump() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [notes, setNotes] = useState([]);
  const [quickText, setQuickText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const fetchDayNotes = async (date) => {
    setLoading(true);
    try {
      const res = await API.get("/notes", { params: { date: toDateStr(date) } });
      setNotes(res.data.notes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayNotes(selectedDate);
  }, [selectedDate]);

  const handleQuickSave = async () => {
    if (!quickText.trim()) return;
    setSaving(true);
    try {
      await API.post("/notes", {
        title: quickText.length > 60 ? quickText.substring(0, 60) + "..." : quickText,
        content: quickText,
        category: "Ideas",
        tags: ["daily-dump"],
      });
      setQuickText("");
      await fetchDayNotes(selectedDate);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const goDay = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const isToday = toDateStr(selectedDate) === toDateStr(new Date());

  return (
    <div className="h-full flex flex-col px-4 lg:px-6 py-6" style={{ background: "#0F172A" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
          <CalendarDays className="w-4 h-4" style={{ color: "#6366F1" }} />
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: "#E5E7EB" }}>Daily Dump</h1>
        {isToday && (
          <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8" }}>
            Today
          </span>
        )}
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-3 mb-5">
        <button
          data-testid="prev-day-btn"
          onClick={() => goDay(-1)}
          className="p-2 rounded-lg transition-all"
          style={{ background: "#111827", color: "#6B7280", border: "1px solid #1F2937" }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="flex-1 text-center text-sm font-medium" style={{ color: "#9CA3AF" }}>
          {formatDate(selectedDate)}
        </p>
        <button
          data-testid="next-day-btn"
          onClick={() => goDay(1)}
          disabled={isToday}
          className="p-2 rounded-lg transition-all"
          style={{ background: "#111827", color: isToday ? "#374151" : "#6B7280", border: "1px solid #1F2937" }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Quick capture - only for today */}
      {isToday && (
        <div className="mb-5 rounded-2xl p-4" style={{ background: "#111827", border: "1px solid #1F2937" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "#6B7280" }}>Quick thought</p>
          <div className="flex gap-2">
            <textarea
              data-testid="daily-quick-input"
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleQuickSave(); }}
              placeholder="Dump your thoughts here... (Ctrl+Enter to save)"
              rows={3}
              className="flex-1 bg-transparent outline-none resize-none text-sm"
              style={{ color: "#E5E7EB" }}
            />
            <button
              data-testid="daily-save-btn"
              onClick={handleQuickSave}
              disabled={saving || !quickText.trim()}
              className="self-end p-2.5 rounded-xl transition-all"
              style={{ background: quickText.trim() ? "#6366F1" : "#1F2937", color: "#fff" }}
            >
              {saving ? <div className="spinner w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: "#374151" }}>Press Ctrl+Enter or the button to save instantly</p>
        </div>
      )}

      {/* Day's notes */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="spinner w-8 h-8" /></div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <CalendarDays className="w-12 h-12 mb-3" style={{ color: "#374151" }} />
            <p className="text-sm font-medium" style={{ color: "#6B7280" }}>
              {isToday ? "Nothing captured yet today." : "No notes on this day."}
            </p>
            {isToday && (
              <p className="text-xs mt-1" style={{ color: "#4B5563" }}>Use the quick thought box above to get started.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {notes.map(note => (
              <NoteCard key={note.id} note={note} onAction={(action, nid) => {
                if (action === "delete" || action === "archive") setNotes(prev => prev.filter(n => n.id !== nid));
              }} view="list" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
