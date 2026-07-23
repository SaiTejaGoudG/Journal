"use client";
import { useState, useEffect, useCallback } from "react";
import API from "@/services/api";
import NoteCard from "@/components/NoteCard";
import { Star } from "lucide-react";

export default function FavoritesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/notes", { params: { is_favorite: true } });
      setNotes(res.data.notes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const handleNoteAction = (action, noteId) => {
    if (action === "delete" || action === "archive") {
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } else if (action === "favorite") {
      setNotes(prev => prev.filter(n => n.id !== noteId));
    }
  };

  return (
    <div className="h-full flex flex-col px-4 lg:px-6 py-6" style={{ background: "#0F172A" }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
          <Star className="w-4 h-4 fill-current" style={{ color: "#F59E0B" }} />
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: "#E5E7EB" }}>Favorites</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="spinner w-8 h-8" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(245,158,11,0.1)" }}>
              <Star className="w-8 h-8" style={{ color: "#F59E0B" }} />
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: "#E5E7EB" }}>No favorites yet</h3>
            <p className="text-sm" style={{ color: "#6B7280" }}>Star notes to quickly access them here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {notes.map(note => (
              <NoteCard key={note.id} note={note} onAction={handleNoteAction} view="grid" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
