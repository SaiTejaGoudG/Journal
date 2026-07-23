"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from 'next/navigation';
import API from "@/services/api";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import { toast } from "sonner";
import { Plus, X, ChevronDown } from "lucide-react";

const CATEGORIES = ["Technical", "Content Creation", "Ideas"];
const CAT_COLORS = { "Technical": "#6366F1", "Content Creation": "#EC4899", "Ideas": "#F59E0B" };

export default function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Ideas");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const contentRef = useRef(null);

  const reset = () => {
    setTitle(""); setContent(""); setCategory("Ideas"); setTags("");
  };

  // Smart paste: keep formatting from ChatGPT / Claude / Gemini as markdown.
  const handlePaste = useCallback((e) => {
    const html = e.clipboardData?.getData("text/html");
    if (!html) return;
    let md;
    try { md = htmlToMarkdown(html); } catch { return; }
    if (!md || !md.trim()) return;
    e.preventDefault();
    const el = contentRef.current;
    const start = el ? el.selectionStart : content.length;
    const end = el ? el.selectionEnd : content.length;
    setContent(content.slice(0, start) + md + content.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = start + md.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }, [content]);

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) return;
    setSaving(true);
    try {
      const tagList = tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
      await API.post("/notes", {
        title: title || "Quick Note",
        content,
        category,
        tags: tagList,
      });
      const savedTitle = title.trim() || "Quick Note";
      reset();
      setOpen(false);
      toast.success("Note created", { description: savedTitle });
      router.push("/");
    } catch (err) {
      if (err.response?.data?.detail?.includes("similar")) {
        toast.error("A similar note already exists.");
      } else {
        toast.error(err.response?.data?.detail || "Failed to save note");
      }
    } finally {
      setSaving(false);
    }
  };

  const catColor = CAT_COLORS[category] || "#6366F1";

  return (
    <>
      {/* FAB — opens the full-screen editor (best for pasting long / formatted content).
          Long-press or right-click for the small Quick Capture popup. */}
      <button
        data-testid="quick-capture-fab"
        onClick={() => router.push("/notes/new")}
        onContextMenu={(e) => { e.preventDefault(); setOpen(true); }}
        className="fab-btn fixed z-40 w-14 h-14 rounded-full flex items-center justify-center"
        style={{ bottom: 80, right: 20, background: "#6366F1" }}
        aria-label="New note"
        title="New note (right-click for quick capture)"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
      </button>
      {/* Desktop FAB position */}
      <style>{`
        @media (min-width: 768px) {
          [data-testid="quick-capture-fab"] {
            bottom: 32px !important;
            right: 32px !important;
          }
        }
      `}</style>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="w-full md:max-w-2xl rounded-t-3xl md:rounded-2xl p-5 slide-up flex flex-col"
            style={{ background: "#111827", border: "1px solid #1F2937", maxHeight: "88vh" }}
          >
            {/* Handle bar (mobile) */}
            <div className="flex justify-center mb-3 md:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: "#1F2937" }} />
            </div>

            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: "#E5E7EB" }}>Quick Capture</h2>
              <button
                data-testid="close-quick-capture"
                onClick={() => setOpen(false)}
                style={{ color: "#6B7280" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category selector */}
            <div className="flex gap-2 mb-4">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  data-testid={`qc-category-${cat.replace(" ", "-")}`}
                  onClick={() => setCategory(cat)}
                  className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all truncate"
                  style={{
                    background: category === cat ? `${CAT_COLORS[cat]}20` : "transparent",
                    color: category === cat ? CAT_COLORS[cat] : "#6B7280",
                    border: `1px solid ${category === cat ? `${CAT_COLORS[cat]}40` : "#1F2937"}`,
                  }}
                >
                  {cat.split(" ")[0]}
                </button>
              ))}
            </div>

            {/* Title */}
            <input
              data-testid="qc-title-input"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Note title..."
              className="w-full px-4 py-3 rounded-xl text-sm mb-3 input-focus"
              style={{ background: "#0F172A", border: "1px solid #1F2937", color: "#E5E7EB" }}
              autoFocus
            />

            {/* Content */}
            <textarea
              data-testid="qc-content-input"
              ref={contentRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleSave(); }}
              placeholder="Capture your thought, or paste from ChatGPT / Claude / Gemini — formatting is kept. (Ctrl+Enter to save)"
              className="w-full flex-1 min-h-[180px] px-4 py-3 rounded-xl text-sm mb-3 resize-none input-focus"
              style={{ background: "#0F172A", border: "1px solid #1F2937", color: "#E5E7EB" }}
            />

            {/* Tags */}
            <input
              data-testid="qc-tags-input"
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Tags (comma separated)"
              className="w-full px-4 py-3 rounded-xl text-sm mb-4 input-focus"
              style={{ background: "#0F172A", border: "1px solid #1F2937", color: "#E5E7EB" }}
            />

            {/* Actions */}
            <div className="flex gap-2">
              <button
                data-testid="qc-save-btn"
                onClick={handleSave}
                disabled={saving || (!title.trim() && !content.trim())}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "#6366F1", color: "#fff", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <div className="spinner w-4 h-4 mx-auto" /> : "Save"}
              </button>
              <button
                data-testid="qc-cancel-btn"
                onClick={() => setOpen(false)}
                className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
                style={{ background: "#1F2937", color: "#9CA3AF" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
