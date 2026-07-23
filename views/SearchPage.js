"use client";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import API from "@/services/api";
import NoteCard from "@/components/NoteCard";
import { Search, SlidersHorizontal, X, Code2, Star, Lightbulb } from "lucide-react";

const CATEGORIES = ["Technical", "Content Creation", "Ideas"];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();

  const doSearch = async () => {
    if (!query.trim() && !category) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = {};
      if (query.trim()) params.q = query;
      if (category) params.category = category;
      const res = await API.get("/notes", { params });
      setResults(res.data.notes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2 || category) doSearch();
    }, 400);
    return () => clearTimeout(timer);
  }, [query, category]);

  const handleNoteAction = (action, noteId) => {
    if (action === "delete" || action === "archive") {
      setResults(prev => prev.filter(n => n.id !== noteId));
    }
  };

  return (
    <div className="h-full flex flex-col px-4 lg:px-6 py-6" style={{ background: "#0F172A" }}>
      <h1 className="text-2xl font-semibold mb-4" style={{ color: "#E5E7EB" }}>Search</h1>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#6B7280" }} />
        <input
          data-testid="search-input"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doSearch()}
          placeholder="Search notes, ideas, code..."
          autoFocus
          className="w-full pl-11 pr-12 py-3.5 rounded-2xl text-sm input-focus transition-all"
          style={{ background: "#111827", border: "1px solid #1F2937", color: "#E5E7EB" }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }} style={{ color: "#6B7280" }}>
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            data-testid="search-filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
            className="p-1.5 rounded-lg transition-all"
            style={{ background: showFilters ? "rgba(99,102,241,0.15)" : "transparent", color: showFilters ? "#818CF8" : "#6B7280" }}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4 fade-in">
          <button
            data-testid="filter-all"
            onClick={() => setCategory("")}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{ background: !category ? "rgba(99,102,241,0.15)" : "#111827", color: !category ? "#818CF8" : "#6B7280", border: `1px solid ${!category ? "rgba(99,102,241,0.3)" : "#1F2937"}` }}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              data-testid={`filter-${cat.replace(" ", "-")}`}
              onClick={() => setCategory(cat === category ? "" : cat)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: category === cat ? "rgba(99,102,241,0.15)" : "#111827",
                color: category === cat ? "#818CF8" : "#6B7280",
                border: `1px solid ${category === cat ? "rgba(99,102,241,0.3)" : "#1F2937"}`
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="spinner w-8 h-8" />
          </div>
        ) : searched && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Search className="w-10 h-10 mb-3" style={{ color: "#374151" }} />
            <p className="text-sm" style={{ color: "#6B7280" }}>No notes found for "{query}"</p>
            <button
              data-testid="create-new-note-from-search"
              onClick={() => router.push("/notes/new", { state: { title: query } })}
              className="mt-3 px-4 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8" }}
            >
              Create note with this title
            </button>
          </div>
        ) : results.length > 0 ? (
          <div>
            <p className="text-xs mb-3" style={{ color: "#6B7280" }}>{results.length} result{results.length !== 1 ? "s" : ""}</p>
            <div className="flex flex-col gap-3 stagger-children">
              {results.map(note => (
                <NoteCard key={note.id} note={note} onAction={handleNoteAction} view="list" />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "rgba(99,102,241,0.1)" }}>
              <Search className="w-6 h-6" style={{ color: "#4B5563" }} />
            </div>
            <p className="text-sm" style={{ color: "#6B7280" }}>Type to search across all your notes</p>
          </div>
        )}
      </div>
    </div>
  );
}
