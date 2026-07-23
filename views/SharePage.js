"use client";
import { useState, useEffect } from "react";
import { useParams } from 'next/navigation';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain, Clock, Tag } from "lucide-react";
import API from "@/services/api";

const CAT_COLORS = {
  "Technical": "#6366F1",
  "Content Creation": "#EC4899",
  "Ideas": "#F59E0B"
};

export default function SharePage() {
  const { token } = useParams();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get(`/public/notes/${token}`)
      .then(res => setNote(res.data))
      .catch(() => setError("This note doesn't exist or sharing has been disabled."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F172A" }}>
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: "#0F172A" }}>
        <Brain className="w-12 h-12 mb-4" style={{ color: "#6366F1" }} />
        <h1 className="text-2xl font-semibold mb-2" style={{ color: "#E5E7EB" }}>Note not found</h1>
        <p className="text-sm mb-6" style={{ color: "#6B7280" }}>{error}</p>
        <Link
          to="/auth"
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "#6366F1", color: "#fff" }}
        >
          Open Second Brain
        </Link>
      </div>
    );
  }

  const catColor = CAT_COLORS[note.category] || "#6366F1";

  return (
    <div className="min-h-screen" style={{ background: "#0F172A" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-6 py-4"
        style={{ background: "rgba(15,23,42,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1F2937" }}
      >
        <Brain className="w-5 h-5" style={{ color: "#6366F1" }} />
        <span className="text-sm font-semibold" style={{ color: "#9CA3AF" }}>Second Brain</span>
        <div className="flex-1" />
        <span
          className="text-xs px-2.5 py-1 rounded-full"
          style={{ background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}40` }}
        >
          {note.category}
        </span>
        <Link
          to="/auth"
          className="text-xs px-3 py-1.5 rounded-xl font-medium transition-all"
          style={{ background: "rgba(99,102,241,0.1)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          Sign in
        </Link>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1
          className="text-4xl font-semibold mb-4 leading-tight"
          style={{ color: "#E5E7EB", fontFamily: "Outfit, sans-serif" }}
        >
          {note.title || "Untitled"}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-8 pb-6" style={{ borderBottom: "1px solid #1F2937" }}>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
            <Clock className="w-3.5 h-3.5" />
            {note.created_at
              ? new Date(note.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
              : ""}
          </div>
          {note.subcategory && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1F2937", color: "#9CA3AF" }}>
              {note.subcategory}
            </span>
          )}
          {note.tags?.length > 0 && note.tags.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#1F2937", color: "#9CA3AF" }}
            >
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
        </div>

        {/* Note content */}
        <div className="markdown-body text-sm leading-relaxed" style={{ color: "#E5E7EB" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {note.content || ""}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 text-center" style={{ borderTop: "1px solid #1F2937" }}>
          <p className="text-xs" style={{ color: "#4B5563" }}>
            Shared via{" "}
            <Link href="/auth" style={{ color: "#818CF8" }}>Second Brain</Link>
            {" "}— Your personal knowledge OS
          </p>
        </div>
      </div>
    </div>
  );
}
