"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { useParams } from 'next/navigation';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import API from "@/services/api";
import { queueOperation, isOnline } from "@/services/offlineSync";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Eye, Edit3, Mic, MicOff, Image, Sparkles, X, Plus,
  ChevronDown, Star, Link, Download, Share2, Check, FolderPlus,
  BookOpen, ExternalLink, WifiOff
} from "lucide-react";

const CAT_COLORS = {
  "Technical": "#6366F1",
  "Content Creation": "#EC4899",
  "Ideas": "#F59E0B"
};

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState("");
  const addTag = (val) => {
    const t = val.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: "#1F2937", color: "#9CA3AF", border: "1px solid #374151" }}
        >
          {tag}
          <button onClick={() => onChange(tags.filter(t => t !== tag))} data-testid={`remove-tag-${tag}`}>
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        data-testid="tag-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); } }}
        onBlur={() => input && addTag(input)}
        placeholder="Add tag..."
        className="text-xs bg-transparent outline-none"
        style={{ color: "#9CA3AF", minWidth: 80 }}
      />
    </div>
  );
}

function LinkedNoteCard({ note, onRemove }) {
  const router = useRouter();
  const catColor = CAT_COLORS[note.category] || "#6366F1";
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: "#0F172A", border: "1px solid #1F2937" }}
    >
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: catColor }} />
      <span className="text-xs flex-1 truncate" style={{ color: "#E5E7EB" }}>{note.title || "Untitled"}</span>
      <button
        onClick={() => router.push(`/notes/${note.id}`)}
        className="p-1 transition-all rounded"
        style={{ color: "#6B7280" }}
        title="Open note"
      >
        <ExternalLink className="w-3 h-3" />
      </button>
      <button
        onClick={() => onRemove(note.id)}
        className="p-1 transition-all rounded"
        style={{ color: "#6B7280" }}
        data-testid={`unlink-note-${note.id}`}
        title="Remove link"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function NoteEditor() {
  const { id } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialData = location.state || {};

  // Core note state
  const [title, setTitle] = useState(initialData.title || "");
  const [content, setContent] = useState(initialData.content || "");
  const [category, setCategory] = useState(initialData.category || "Ideas");
  const [subcategory, setSubcategory] = useState("");
  const [tags, setTags] = useState([]);
  const [images, setImages] = useState([]);
  const [reminder, setReminder] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);

  // Collections
  const [collectionIds, setCollectionIds] = useState([]);
  const [collections, setCollections] = useState([]);
  const [showCollDropdown, setShowCollDropdown] = useState(false);

  // Note linking
  const [linkedNoteIds, setLinkedNoteIds] = useState([]);
  const [linkedNotesData, setLinkedNotesData] = useState([]);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState([]);
  const [showLinkPanel, setShowLinkPanel] = useState(false);

  // Related notes
  const [relatedNotes, setRelatedNotes] = useState([]);

  // Share
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Subcategory creation
  const [categories, setCategories] = useState([]);
  const [newSubcatInput, setNewSubcatInput] = useState(false);
  const [newSubcatName, setNewSubcatName] = useState("");

  // Editor state
  const [mode, setMode] = useState("edit");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [aiLoading, setAiLoading] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [showAiResult, setShowAiResult] = useState(false);
  const [offline, setOffline] = useState(false); // default false; corrected in useEffect

  const mediaRecorderRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const autoSaveTimer = useRef(null);
  const hasChanges = useRef(false);

  // Offline detection
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Smart paste: convert rich text (HTML) copied from ChatGPT / Claude / Gemini
  // into clean markdown, inserted at the cursor. Falls back to plain text.
  const handlePaste = useCallback((e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const html = cd.getData("text/html");
    // Only intervene when the source provided rich HTML; otherwise let the
    // browser paste plain text (e.g. already-markdown source) untouched.
    if (!html) return;
    let md;
    try {
      md = htmlToMarkdown(html);
    } catch {
      return; // conversion failed -> default plain-text paste
    }
    if (!md || !md.trim()) return;
    // If the plain-text version already looks like markdown and is richer,
    // prefer it (some tools put clean markdown on text/plain).
    e.preventDefault();
    const el = textareaRef.current;
    const start = el ? el.selectionStart : content.length;
    const end = el ? el.selectionEnd : content.length;
    const next = content.slice(0, start) + md + content.slice(end);
    setContent(next);
    // Restore caret just after the inserted markdown.
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = start + md.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }, [content]);

  // Close collection dropdown on outside click
  useEffect(() => {
    if (!showCollDropdown) return;
    const handler = (e) => {
      if (!e.target.closest("[data-coll-dropdown]")) setShowCollDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCollDropdown]);

  // Load categories and collections
  useEffect(() => {
    API.get("/categories").then(res => setCategories(res.data)).catch(() => {});
    API.get("/collections").then(res => setCollections(res.data)).catch(() => {});
  }, []);

  // Load existing note
  useEffect(() => {
    if (id) {
      API.get(`/notes/${id}`).then(res => {
        const n = res.data;
        setTitle(n.title || "");
        setContent(n.content || "");
        setCategory(n.category || "Ideas");
        setSubcategory(n.subcategory || "");
        setTags(n.tags || []);
        setImages(n.images || []);
        setReminder(n.reminder_date || "");
        setIsFavorite(n.is_favorite || false);
        setIsPublic(n.is_public || false);
        setShareToken(n.share_token || "");
        const cids = n.collection_ids?.length ? n.collection_ids : (n.collection_id ? [n.collection_id] : []);
        setCollectionIds(cids);
        setLinkedNoteIds(n.linked_notes || []);
        setLinkedNotesData(n.linked_notes_data || []);
      }).catch(() => router.push("/"));
      API.get(`/notes/${id}/related`).then(res => setRelatedNotes(res.data)).catch(() => {});
    }
  }, [id, router]);

  // Auto-save debounce
  useEffect(() => {
    if (!id) return;
    hasChanges.current = true;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (hasChanges.current) handleSave(true);
    }, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [title, content, tags, category, subcategory, collectionIds, linkedNoteIds]);

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (!title.trim() && !content.trim()) return;
    setSaving(true);

    const payload = {
      title: title || "Untitled",
      content,
      category,
      subcategory,
      tags,
      images,
      reminder_date: reminder || null,
      collection_id: collectionIds[0] || null,
      collection_ids: collectionIds,
      linked_notes: linkedNoteIds,
    };

    // Offline: queue operation
    if (!isOnline()) {
      queueOperation(id ? { type: "update", id, payload } : { type: "create", payload });
      hasChanges.current = false;
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (!isAutoSave) {
        toast.success("Saved offline", { description: "Will sync when you're back online." });
        router.push("/");
      }
      return;
    }

    try {
      if (id) {
        await API.put(`/notes/${id}`, payload);
      } else {
        await API.post("/notes", payload);
      }
      hasChanges.current = false;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Manual save: confirm with a toast and return to the dashboard.
      // Auto-save stays silent and keeps the user in the editor.
      if (!isAutoSave) {
        toast.success(id ? "Note updated" : "Note created", {
          description: title?.trim() ? title.trim() : "Untitled note",
        });
        router.push("/");
      }
    } catch (err) {
      if (!isAutoSave) toast.error(err.response?.data?.detail || "Failed to save note");
    } finally {
      setSaving(false);
    }
  }, [title, content, category, subcategory, tags, images, reminder, id, collectionIds, linkedNoteIds, router]);

  // Image upload
  const handleImageUpload = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed, file.name);
    try {
      const res = await API.post("/images/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setImages(prev => [...prev, res.data.url]);
    } catch (err) {
      alert("Image upload failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const compressImage = (file) => new Promise(resolve => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new window.Image();
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > height && width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
      else if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
      canvas.width = width; canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: "image/jpeg" })), "image/jpeg", 0.75);
    };
    img.src = URL.createObjectURL(file);
  });

  // Paste image
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          handleImageUpload(item.getAsFile());
          break;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const fd = new FormData();
        fd.append("audio", blob, "recording.webm");
        try {
          const res = await API.post("/ai/transcribe", fd, { headers: { "Content-Type": "multipart/form-data" } });
          setContent(prev => prev + (prev ? "\n\n" : "") + res.data.text);
        } catch (err) {
          alert("Transcription failed: " + (err.response?.data?.detail || err.message));
        }
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // AI actions
  const handleAiAction = async (action) => {
    if (!content.trim()) { alert("Please add some content first"); return; }
    setAiLoading(action);
    try {
      const res = await API.post("/ai/action", { content, action });
      setAiResult(res.data.result);
      setShowAiResult(true);
    } catch (err) {
      alert(err.response?.data?.detail || "AI action failed");
    } finally {
      setAiLoading("");
    }
  };

  // Note linking search (debounced)
  const searchLinkedNotes = useCallback(async (q) => {
    if (!q.trim()) { setLinkResults([]); return; }
    try {
      const res = await API.get("/notes", { params: { q, limit: 8 } });
      setLinkResults(res.data.notes.filter(n => n.id !== id && !linkedNoteIds.includes(n.id)));
    } catch (_) {}
  }, [id, linkedNoteIds]);

  useEffect(() => {
    const timer = setTimeout(() => searchLinkedNotes(linkSearch), 300);
    return () => clearTimeout(timer);
  }, [linkSearch, searchLinkedNotes]);

  const addLink = (note) => {
    setLinkedNoteIds(prev => [...prev, note.id]);
    setLinkedNotesData(prev => [...prev, { id: note.id, title: note.title, category: note.category, tags: note.tags }]);
    setLinkSearch("");
    setLinkResults([]);
  };

  const removeLink = (noteId) => {
    setLinkedNoteIds(prev => prev.filter(i => i !== noteId));
    setLinkedNotesData(prev => prev.filter(n => n.id !== noteId));
  };

  // Subcategory inline creation
  const createSubcategory = async () => {
    if (!newSubcatName.trim()) return;
    try {
      const res = await API.post("/categories/subcategory", { name: newSubcatName, category_id: category });
      setCategories(prev => prev.map(c =>
        c.id === category ? { ...c, subcategories: [...(c.subcategories || []), res.data] } : c
      ));
      setSubcategory(newSubcatName);
      setNewSubcatInput(false);
      setNewSubcatName("");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create subcategory");
    }
  };

  // Export as Markdown
  const exportNote = async () => {
    if (!id) { alert("Save the note first to export"); return; }
    try {
      const res = await API.get(`/notes/${id}/export`);
      const blob = new Blob([res.data.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.data.filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed");
    }
  };

  // Share note
  const toggleShare = async () => {
    if (!id) { alert("Save the note first to share"); return; }
    setSharing(true);
    try {
      const res = await API.post(`/notes/${id}/share`);
      setIsPublic(res.data.is_public);
      setShareToken(res.data.share_token || "");
      if (res.data.is_public) setShowShareModal(true);
    } catch {
      alert("Share failed");
    } finally {
      setSharing(false);
    }
  };

  // Collections toggle
  const toggleCollection = (collId) => {
    setCollectionIds(prev =>
      prev.includes(collId) ? prev.filter(i => i !== collId) : [...prev, collId]
    );
  };

  const catColor = CAT_COLORS[category] || "#6366F1";
  const currentCatData = categories.find(c => c.id === category);
  const subcategories = currentCatData?.subcategories || [];
  // Use typeof guard so this is safe during SSR (window undefined on server)
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${shareToken}`;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#0F172A" }}>

      {/* Offline Banner */}
      {offline && (
        <div
          data-testid="offline-banner"
          className="flex items-center justify-center gap-2 py-2 text-xs font-medium"
          style={{ background: "#7C2D12", color: "#FECACA" }}
        >
          <WifiOff className="w-3.5 h-3.5" />
          You're offline — changes will sync when back online
        </div>
      )}

      {/* Top Bar */}
      <div
        className="flex-none flex items-center gap-3 px-4 py-3 sticky top-0 z-20"
        style={{ background: "rgba(15,23,42,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1F2937" }}
      >
        <button data-testid="back-btn" onClick={() => router.back()} className="p-2 rounded-lg transition-all" style={{ color: "#9CA3AF" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <input
            data-testid="note-title-input"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Note title..."
            className="w-full bg-transparent outline-none text-lg font-semibold truncate"
            style={{ color: "#E5E7EB" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="toggle-favorite-btn"
            onClick={() => setIsFavorite(!isFavorite)}
            className="p-2 rounded-lg transition-all"
            style={{ color: isFavorite ? "#F59E0B" : "#6B7280" }}
          >
            <Star className="w-4 h-4" fill={isFavorite ? "#F59E0B" : "none"} />
          </button>
          {id && (
            <button
              data-testid="share-note-btn"
              onClick={toggleShare}
              disabled={sharing}
              className="p-2 rounded-lg transition-all"
              style={{ color: isPublic ? "#10B981" : "#6B7280" }}
              title={isPublic ? "Sharing enabled — click to disable" : "Share this note"}
            >
              {sharing ? <div className="spinner w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </button>
          )}
          <button
            data-testid="toggle-preview-btn"
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            className="p-2 rounded-lg transition-all"
            style={{
              background: mode === "preview" ? "rgba(99,102,241,0.15)" : "transparent",
              color: mode === "preview" ? "#818CF8" : "#6B7280"
            }}
          >
            {mode === "edit" ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          </button>
          <button
            data-testid="save-note-btn"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all"
            style={{ background: saved ? "#059669" : "#6366F1", color: "#fff" }}
          >
            {saving
              ? <div className="spinner w-4 h-4" />
              : saved
                ? <><Check className="w-4 h-4" /> Saved</>
                : <><Save className="w-4 h-4" /> Save</>
            }
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 min-h-0 flex flex-col max-w-4xl mx-auto w-full px-4 py-4 gap-4 overflow-y-auto">

        {/* Meta Row: Category + Subcategory + Collections + Reminder */}
        <div className="flex flex-wrap gap-2 items-start">

          {/* Category */}
          <div className="relative">
            <select
              data-testid="category-select"
              value={category}
              onChange={e => { setCategory(e.target.value); setSubcategory(""); setNewSubcatInput(false); }}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm font-medium cursor-pointer outline-none"
              style={{ background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}40` }}
            >
              {["Technical", "Content Creation", "Ideas"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: catColor }} />
          </div>

          {/* Subcategory + Inline Create */}
          <div className="flex items-center gap-1 flex-wrap">
            {subcategories.length > 0 && !newSubcatInput && (
              <select
                data-testid="subcategory-select"
                value={subcategory}
                onChange={e => setSubcategory(e.target.value)}
                className="appearance-none px-3 py-2 rounded-xl text-sm cursor-pointer outline-none"
                style={{ background: "#111827", color: "#9CA3AF", border: "1px solid #1F2937" }}
              >
                <option value="">Subcategory</option>
                {subcategories.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            )}
            {!newSubcatInput ? (
              <button
                data-testid="add-subcategory-btn"
                onClick={() => setNewSubcatInput(true)}
                className="p-2 rounded-xl text-xs transition-all flex items-center gap-1"
                style={{ background: "#111827", color: "#6B7280", border: "1px solid #1F2937" }}
                title="Create new subcategory"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  data-testid="new-subcategory-input"
                  autoFocus
                  type="text"
                  value={newSubcatName}
                  onChange={e => setNewSubcatName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") createSubcategory();
                    if (e.key === "Escape") { setNewSubcatInput(false); setNewSubcatName(""); }
                  }}
                  placeholder="Subcategory name..."
                  className="px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: "#111827", border: "1px solid #6366F1", color: "#E5E7EB", width: 140 }}
                />
                <button
                  onClick={createSubcategory}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ background: "#6366F1", color: "#fff" }}
                  data-testid="confirm-subcategory-btn"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setNewSubcatInput(false); setNewSubcatName(""); }}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ background: "#1F2937", color: "#9CA3AF" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Collections multi-select */}
          <div className="flex items-center gap-1 flex-wrap" data-coll-dropdown>
            {collectionIds.map(cid => {
              const coll = collections.find(c => c.id === cid);
              if (!coll) return null;
              return (
                <span
                  key={cid}
                  data-testid={`selected-collection-${cid}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium"
                  style={{ background: "rgba(99,102,241,0.1)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.2)" }}
                >
                  {coll.name}
                  <button onClick={() => toggleCollection(cid)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            <div className="relative">
              <button
                data-testid="collection-picker-btn"
                onClick={() => setShowCollDropdown(!showCollDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{ background: "#111827", color: "#6B7280", border: "1px solid #1F2937" }}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                {collectionIds.length === 0 ? "Collection" : "More"}
              </button>
              {showCollDropdown && (
                <div
                  className="absolute top-full left-0 mt-1 z-30 rounded-xl overflow-hidden shadow-2xl"
                  style={{ background: "#111827", border: "1px solid #1F2937", minWidth: 180 }}
                >
                  {collections.length === 0 ? (
                    <p className="text-xs px-3 py-2.5" style={{ color: "#6B7280" }}>No collections yet</p>
                  ) : (
                    collections.map(c => (
                      <button
                        key={c.id}
                        data-testid={`coll-option-${c.id}`}
                        onClick={() => toggleCollection(c.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-all"
                        style={{
                          color: collectionIds.includes(c.id) ? "#818CF8" : "#9CA3AF",
                          background: collectionIds.includes(c.id) ? "rgba(99,102,241,0.08)" : "transparent"
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{
                            background: collectionIds.includes(c.id) ? "#6366F1" : "#1F2937",
                            border: `1px solid ${collectionIds.includes(c.id) ? "#6366F1" : "#374151"}`
                          }}
                        >
                          {collectionIds.includes(c.id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Reminder */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs" style={{ color: "#6B7280" }}>Reminder:</label>
            <input
              data-testid="reminder-input"
              type="date"
              value={reminder}
              onChange={e => setReminder(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: "#111827", border: "1px solid #1F2937", color: "#9CA3AF" }}
            />
          </div>
        </div>

        {/* Main Editor / Preview */}
        <div
          className="rounded-2xl overflow-hidden flex flex-col"
          style={{ background: "#111827", border: "1px solid #1F2937", height: "calc(100vh - 210px)", minHeight: 360 }}
        >
          {mode === "edit" ? (
            <textarea
              data-testid="note-content-textarea"
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder={"Start writing, or paste from ChatGPT / Claude / Gemini — formatting is kept automatically.\n\n# Heading\n**bold**, *italic*, `code`\n```python\nprint('Hello')\n```"}
              className="flex-1 w-full p-5 bg-transparent outline-none resize-none text-sm leading-relaxed"
              style={{ color: "#E5E7EB", fontFamily: "Manrope, sans-serif", minHeight: 0 }}
            />
          ) : (
            <div className="flex-1 p-5 markdown-body overflow-y-auto" style={{ color: "#E5E7EB" }}>
              {content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      return !inline && match ? (
                        <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>{children}</code>
                      );
                    }
                  }}
                >
                  {content}
                </ReactMarkdown>
              ) : (
                <p style={{ color: "#6B7280" }}>Nothing to preview yet. Switch to edit mode to add content.</p>
              )}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="rounded-xl px-4 py-3" style={{ background: "#111827", border: "1px solid #1F2937" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "#6B7280" }}>Tags</p>
          <TagInput tags={tags} onChange={setTags} />
        </div>

        {/* Images */}
        {images.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1F2937" }}>
            <p className="text-xs font-medium mb-3" style={{ color: "#6B7280" }}>Images ({images.length})</p>
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden aspect-video" style={{ background: "#1F2937" }}>
                  <img src={img} alt={`img-${i}`} className="w-full h-full object-cover" />
                  <button
                    data-testid={`remove-image-${i}`}
                    onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.7)" }}
                  >
                    <X className="w-3 h-3" style={{ color: "#fff" }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note Linking Panel */}
        {showLinkPanel && (
          <div
            data-testid="link-panel"
            className="rounded-xl p-4"
            style={{ background: "#111827", border: "1px solid rgba(99,102,241,0.4)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#818CF8" }}>
                <Link className="w-3.5 h-3.5" /> Linked Notes
                {linkedNoteIds.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: "rgba(99,102,241,0.2)", color: "#818CF8" }}>
                    {linkedNoteIds.length}
                  </span>
                )}
              </p>
              <button onClick={() => setShowLinkPanel(false)} style={{ color: "#6B7280" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              data-testid="link-search-input"
              type="text"
              value={linkSearch}
              onChange={e => setLinkSearch(e.target.value)}
              placeholder="Search notes to link..."
              className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-3"
              style={{ background: "#0F172A", border: "1px solid #1F2937", color: "#E5E7EB" }}
            />
            {linkResults.length > 0 && (
              <div className="mb-3 space-y-1">
                <p className="text-xs mb-1" style={{ color: "#6B7280" }}>Search results:</p>
                {linkResults.map(note => (
                  <button
                    key={note.id}
                    data-testid={`link-result-${note.id}`}
                    onClick={() => addLink(note)}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center gap-2"
                    style={{ background: "#0F172A", color: "#E5E7EB", border: "1px solid #1F2937" }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[note.category] || "#6366F1" }} />
                    <span className="flex-1 truncate">{note.title || "Untitled"}</span>
                    <Plus className="w-3 h-3 flex-shrink-0" style={{ color: "#6366F1" }} />
                  </button>
                ))}
              </div>
            )}
            {linkedNotesData.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs mb-1" style={{ color: "#6B7280" }}>Linked:</p>
                {linkedNotesData.map(note => (
                  <LinkedNoteCard key={note.id} note={note} onRemove={removeLink} />
                ))}
              </div>
            ) : (
              linkSearch === "" && (
                <p className="text-xs text-center py-3" style={{ color: "#4B5563" }}>
                  No links yet — search above to connect notes
                </p>
              )
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center pb-2">
          <button
            data-testid="upload-image-btn"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: "#111827", color: "#9CA3AF", border: "1px solid #1F2937" }}
          >
            <Image className="w-3.5 h-3.5" /> Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
          />

          <button
            data-testid="voice-record-btn"
            onClick={isRecording ? stopRecording : startRecording}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: isRecording ? "rgba(239,68,68,0.15)" : "#111827",
              color: isRecording ? "#F87171" : "#9CA3AF",
              border: `1px solid ${isRecording ? "rgba(239,68,68,0.3)" : "#1F2937"}`
            }}
          >
            {isRecording ? <><MicOff className="w-3.5 h-3.5" /> Stop</> : <><Mic className="w-3.5 h-3.5" /> Record</>}
          </button>

          <button
            data-testid="link-notes-btn"
            onClick={() => setShowLinkPanel(!showLinkPanel)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: showLinkPanel ? "rgba(99,102,241,0.15)" : "#111827",
              color: showLinkPanel ? "#818CF8" : "#9CA3AF",
              border: `1px solid ${showLinkPanel ? "rgba(99,102,241,0.3)" : "#1F2937"}`
            }}
          >
            <Link className="w-3.5 h-3.5" />
            {linkedNoteIds.length > 0 ? `${linkedNoteIds.length} linked` : "Link"}
          </button>

          {id && (
            <button
              data-testid="export-note-btn"
              onClick={exportNote}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: "#111827", color: "#9CA3AF", border: "1px solid #1F2937" }}
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}

          {/* AI Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <Sparkles className="w-3.5 h-3.5" style={{ color: "#818CF8" }} />
            {["summarize", "expand", "caption"].map(action => (
              <button
                key={action}
                data-testid={`ai-${action}-btn`}
                onClick={() => handleAiAction(action)}
                disabled={!!aiLoading}
                className="px-3 py-2 rounded-xl text-xs font-medium transition-all capitalize"
                style={{
                  background: "rgba(99,102,241,0.1)",
                  color: "#818CF8",
                  border: "1px solid rgba(99,102,241,0.2)",
                  opacity: aiLoading === action ? 0.7 : 1
                }}
              >
                {aiLoading === action ? <div className="spinner w-3.5 h-3.5" /> : action}
              </button>
            ))}
          </div>
        </div>

        {/* Related Notes */}
        {id && relatedNotes.length > 0 && (
          <div className="rounded-xl p-4 mb-4" style={{ background: "#111827", border: "1px solid #1F2937" }}>
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "#6B7280" }}>
              <BookOpen className="w-3.5 h-3.5" /> Related Notes
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {relatedNotes.map(note => (
                <button
                  key={note.id}
                  data-testid={`related-note-${note.id}`}
                  onClick={() => router.push(`/notes/${note.id}`)}
                  className="text-left px-3 py-2.5 rounded-xl transition-all"
                  style={{ background: "#0F172A", border: "1px solid #1F2937" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[note.category] || "#6366F1" }} />
                    <span className="text-xs font-medium truncate" style={{ color: "#E5E7EB" }}>{note.title || "Untitled"}</span>
                  </div>
                  {note.tags?.length > 0 && (
                    <p className="text-xs truncate pl-4" style={{ color: "#6B7280" }}>
                      {note.tags.slice(0, 3).join(", ")}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Result Modal */}
      {showAiResult && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl p-5 slide-up" style={{ background: "#111827", border: "1px solid #1F2937" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: "#818CF8" }} />
                <h3 className="text-sm font-semibold" style={{ color: "#E5E7EB" }}>AI Result</h3>
              </div>
              <button data-testid="close-ai-result" onClick={() => setShowAiResult(false)} style={{ color: "#6B7280" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div
              className="text-sm leading-relaxed mb-4 overflow-y-auto"
              style={{ color: "#D1D5DB", background: "#0F172A", padding: "12px", borderRadius: "12px", maxHeight: 300 }}
            >
              {aiResult}
            </div>
            <div className="flex gap-2">
              <button
                data-testid="ai-result-use-btn"
                onClick={() => { setContent(prev => prev + "\n\n---\n\n" + aiResult); setShowAiResult(false); }}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ background: "#6366F1", color: "#fff" }}
              >
                Append to Note
              </button>
              <button
                data-testid="ai-result-replace-btn"
                onClick={() => { setContent(aiResult); setShowAiResult(false); }}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "#1F2937", color: "#9CA3AF" }}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-5 slide-up" style={{ background: "#111827", border: "1px solid #1F2937" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4" style={{ color: "#10B981" }} />
                <h3 className="text-sm font-semibold" style={{ color: "#E5E7EB" }}>Note Shared</h3>
              </div>
              <button data-testid="close-share-modal" onClick={() => setShowShareModal(false)} style={{ color: "#6B7280" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>Anyone with this link can view your note:</p>
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4"
              style={{ background: "#0F172A", border: "1px solid #1F2937" }}
            >
              <span className="text-xs flex-1 truncate font-mono" style={{ color: "#818CF8" }}>{shareUrl}</span>
              <button
                data-testid="copy-share-link-btn"
                onClick={() => { navigator.clipboard.writeText(shareUrl); }}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                style={{ background: "#6366F1", color: "#fff" }}
              >
                Copy
              </button>
            </div>
            <button
              data-testid="disable-share-btn"
              onClick={async () => { await toggleShare(); setShowShareModal(false); }}
              className="w-full py-2 rounded-xl text-sm font-medium"
              style={{ background: "rgba(239,68,68,0.08)", color: "#F87171", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              Disable Sharing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
