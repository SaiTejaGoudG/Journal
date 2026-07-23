"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";
import API from "@/services/api";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import {
  Folder, FileText, ChevronRight, Plus, FolderPlus, FilePlus2,
  Eye, Edit3, Save, Trash2, GraduationCap, Home, X, CornerDownLeft,
} from "lucide-react";

/** Local slug preview — mirrors lib/nodeModel.slugify for the path hint. */
function slugPreview(name) {
  return (name || "").toString().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "untitled";
}

const CREATE_META = {
  category: { title: "New Category", hint: "A top-level area, e.g. AWS, Backend, System Design", icon: GraduationCap, color: "#6366F1", placeholder: "Category name…" },
  folder:   { title: "New Folder",   hint: "A sub-topic that can hold more folders or notes",     icon: Folder,        color: "#818CF8", placeholder: "Folder name…" },
  note:     { title: "New Note",     hint: "A leaf note — paste a concept here after creating",   icon: FileText,      color: "#EC4899", placeholder: "Note title…" },
};

/** Themed create modal replacing the browser prompt(). */
function CreateModal({ open, mode, parentPath, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setName(""); setBusy(false); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const meta = CREATE_META[mode] || CREATE_META.note;
  const Icon = meta.icon;
  const preview = `${parentPath ? parentPath + "/" : ""}${slugPreview(name)}`;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onSubmit(name.trim());
    if (ok === false) setBusy(false); // keep open on failure
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-5 slide-up" style={{ background: "#111827", border: "1px solid #1F2937", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}1F`, border: `1px solid ${meta.color}44` }}>
            <Icon className="w-4.5 h-4.5" style={{ color: meta.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold" style={{ color: "#E5E7EB" }}>{meta.title}</h2>
            <p className="text-xs" style={{ color: "#6B7280" }}>{meta.hint}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "#6B7280" }}><X className="w-4 h-4" /></button>
        </div>

        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={meta.placeholder}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none input-focus"
          style={{ background: "#0F172A", border: "1px solid #1F2937", color: "#E5E7EB" }}
        />

        <p className="text-xs mt-2 px-1 font-mono truncate" style={{ color: "#4B5563" }}>
          <span style={{ color: "#374151" }}>path: </span>{preview}
        </p>

        <div className="flex gap-2 mt-4">
          <button onClick={submit} disabled={busy || !name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
            style={{ background: meta.color, color: "#fff", opacity: busy || !name.trim() ? 0.6 : 1 }}>
            {busy ? <div className="spinner w-4 h-4" /> : <>Create <CornerDownLeft className="w-3.5 h-3.5 opacity-70" /></>}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#1F2937", color: "#9CA3AF" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_META = {
  learning:  { label: "Learning",  color: "#F59E0B" },
  reviewing: { label: "Reviewing", color: "#6366F1" },
  mastered:  { label: "Mastered",  color: "#10B981" },
};
const STATUSES = ["learning", "reviewing", "mastered"];

/** One vertical pane listing the children of a single node. */
function Column({ col, onOpenFolder, onOpenNote, onCreate, activeChildId }) {
  return (
    <div className="flex-none w-64 h-full flex flex-col border-r" style={{ borderColor: "#1F2937", background: "#0F172A" }}>
      <div className="flex-none flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: "#1F2937" }}>
        <span className="text-xs font-semibold uppercase tracking-wider truncate" style={{ color: "#6B7280" }}>
          {col.title}
        </span>
        <div className="flex items-center gap-1">
          <button title="New folder" onClick={() => onCreate(col, "folder")} className="p-1 rounded-md transition-all hover:bg-white/5" style={{ color: "#6B7280" }}>
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button title="New note" onClick={() => onCreate(col, "note")} className="p-1 rounded-md transition-all hover:bg-white/5" style={{ color: "#6B7280" }}>
            <FilePlus2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {col.loading ? (
          <div className="flex justify-center py-6"><div className="spinner w-5 h-5" /></div>
        ) : col.children.length === 0 ? (
          <p className="text-xs px-3 py-3" style={{ color: "#4B5563" }}>Empty. Use ＋ above to add.</p>
        ) : (
          col.children.map((n) => {
            const active = n.id === activeChildId;
            const isFolder = n.type === "folder";
            return (
              <button
                key={n.id}
                onClick={() => (isFolder ? onOpenFolder(col, n) : onOpenNote(col, n))}
                className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all"
                style={{ background: active ? "rgba(99,102,241,0.12)" : "transparent" }}
              >
                {isFolder
                  ? <Folder className="w-4 h-4 flex-shrink-0" style={{ color: "#818CF8" }} />
                  : <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#6B7280" }} />}
                <span className="flex-1 truncate text-sm" style={{ color: active ? "#E5E7EB" : "#9CA3AF" }}>{n.title}</span>
                {isFolder && n.progress?.total > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
                    {n.progress.percent}%
                  </span>
                )}
                {!isFolder && n.status && (
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_META[n.status]?.color || "#4B5563" }} />
                )}
                {isFolder && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4B5563" }} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Right-hand note detail: preview / edit, status, rename, delete. */
function NotePanel({ node, onChanged, onDeleted }) {
  const [mode, setMode] = useState("preview");
  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content || "");
  const [status, setStatus] = useState(node.status || "learning");
  const [saving, setSaving] = useState(false);
  const taRef = useRef(null);

  useEffect(() => {
    setTitle(node.title); setContent(node.content || ""); setStatus(node.status || "learning");
    setMode("preview");
  }, [node.id]);

  const handlePaste = useCallback((e) => {
    const html = e.clipboardData?.getData("text/html");
    if (!html) return;
    let md; try { md = htmlToMarkdown(html); } catch { return; }
    if (!md?.trim()) return;
    e.preventDefault();
    const el = taRef.current;
    const s = el ? el.selectionStart : content.length;
    const en = el ? el.selectionEnd : content.length;
    setContent(content.slice(0, s) + md + content.slice(en));
    requestAnimationFrame(() => { if (el) { const p = s + md.length; el.focus(); el.setSelectionRange(p, p); } });
  }, [content]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await API.patch(`/nodes/${node.id}`, { title, content, status });
      toast.success("Saved");
      onChanged(res.data);
      setMode("preview");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  const changeStatus = async (s) => {
    setStatus(s);
    try { const res = await API.patch(`/nodes/${node.id}`, { status: s }); onChanged(res.data); }
    catch { toast.error("Failed to update status"); }
  };

  const remove = async () => {
    if (!confirm(`Delete "${node.title}"?`)) return;
    try { await API.delete(`/nodes/${node.id}`); toast.success("Deleted"); onDeleted(node); }
    catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col" style={{ background: "#0F172A" }}>
      {/* header */}
      <div className="flex-none flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#1F2937" }}>
        {mode === "edit" ? (
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="flex-1 bg-transparent outline-none text-lg font-semibold" style={{ color: "#E5E7EB" }} />
        ) : (
          <h1 className="flex-1 truncate text-lg font-semibold" style={{ color: "#E5E7EB" }}>{node.title}</h1>
        )}

        {/* status selector */}
        <div className="flex items-center gap-1 mr-1">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => changeStatus(s)} title={STATUS_META[s].label}
              className="px-2 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: status === s ? `${STATUS_META[s].color}22` : "transparent",
                color: status === s ? STATUS_META[s].color : "#4B5563",
                border: `1px solid ${status === s ? `${STATUS_META[s].color}55` : "#1F2937"}`,
              }}>
              {STATUS_META[s].label}
            </button>
          ))}
        </div>

        {mode === "edit"
          ? <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5" style={{ background: "#6366F1", color: "#fff" }}>
              {saving ? <div className="spinner w-4 h-4" /> : <><Save className="w-4 h-4" /> Save</>}
            </button>
          : <button onClick={() => setMode("edit")} className="p-2 rounded-lg" style={{ color: "#9CA3AF" }}><Edit3 className="w-4 h-4" /></button>}
        <button onClick={() => setMode(mode === "preview" ? "edit" : "preview")} className="p-2 rounded-lg" style={{ color: "#6B7280" }} title="Toggle preview">
          <Eye className="w-4 h-4" />
        </button>
        <button onClick={remove} className="p-2 rounded-lg" style={{ color: "#6B7280" }} title="Delete"><Trash2 className="w-4 h-4" /></button>
      </div>

      {/* body */}
      <div className="flex-1 overflow-hidden">
        {mode === "edit" ? (
          <textarea
            ref={taRef} value={content} onChange={(e) => setContent(e.target.value)} onPaste={handlePaste}
            placeholder={"Write, or paste from ChatGPT / Claude / Gemini — formatting is kept."}
            className="w-full h-full p-5 bg-transparent outline-none resize-none text-sm leading-relaxed"
            style={{ color: "#E5E7EB", fontFamily: "Manrope, sans-serif" }}
          />
        ) : (
          <div className="h-full overflow-y-auto p-5 markdown-body" style={{ color: "#E5E7EB" }}>
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                code({ inline, className, children, ...props }) {
                  const m = /language-(\w+)/.exec(className || "");
                  return !inline && m
                    ? <SyntaxHighlighter style={vscDarkPlus} language={m[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, "")}</SyntaxHighlighter>
                    : <code className={className} {...props}>{children}</code>;
                },
              }}>{content}</ReactMarkdown>
            ) : (
              <p style={{ color: "#4B5563" }}>Empty note. Click the pencil to add content.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Browse() {
  // columns[0] is always top-level (parent_id = null)
  const [columns, setColumns] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  // create modal: { open, mode: 'category'|'folder'|'note', col }
  const [createState, setCreateState] = useState({ open: false, mode: "note", col: null });
  const scrollRef = useRef(null);

  const fetchChildren = useCallback(async (parentId) => {
    const res = await API.get("/nodes", { params: { parent_id: parentId ?? "root" } });
    return res.data.children || [];
  }, []);

  const loadRoot = useCallback(async () => {
    const children = await fetchChildren(null);
    setColumns([{ parentId: null, title: "Categories", children, loading: false, activeChildId: null }]);
    setActiveNote(null);
  }, [fetchChildren]);

  useEffect(() => { loadRoot(); }, [loadRoot]);

  // scroll to reveal the newest column
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [columns.length, activeNote]);

  const openFolder = async (col, node) => {
    const idx = columns.findIndex((c) => c.parentId === col.parentId);
    const base = columns.slice(0, idx + 1);
    base[idx] = { ...base[idx], activeChildId: node.id };
    setActiveNote(null);
    setColumns([...base, { parentId: node.id, title: node.title, children: [], loading: true, activeChildId: null }]);
    const children = await fetchChildren(node.id);
    setColumns((prev) => prev.map((c) => (c.parentId === node.id ? { ...c, children, loading: false } : c)));
  };

  const openNote = async (col, node) => {
    const idx = columns.findIndex((c) => c.parentId === col.parentId);
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, activeChildId: node.id } : c)).slice(0, idx + 1));
    try { const res = await API.get(`/nodes/${node.id}`); setActiveNote(res.data); }
    catch { toast.error("Failed to open note"); }
  };

  // open the themed modal instead of prompt()
  const createInColumn = (col, type) => setCreateState({ open: true, mode: type, col });
  const createTopCategory = () => setCreateState({ open: true, mode: "category", col: columns[0] || null });

  // single submit handler for category / folder / note
  const submitCreate = async (name) => {
    if (!name) return false;
    const { mode, col } = createState;
    const parentId = mode === "category" ? null : col?.parentId ?? null;
    const type = mode === "category" ? "folder" : mode;
    try {
      const res = await API.post("/nodes", { type, title: name, parent_id: parentId });
      const created = res.data;
      const children = await fetchChildren(parentId);
      setColumns((prev) => prev.map((c) => (c.parentId === parentId ? { ...c, children } : c)));
      toast.success(mode === "category" ? "Category created" : type === "folder" ? "Folder created" : "Note created");
      setCreateState({ open: false, mode: "note", col: null });
      if (type === "note" && col) openNote(col, created);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create");
      return false;
    }
  };

  const onNoteChanged = (updated) => {
    setActiveNote((n) => (n ? { ...n, ...updated } : n));
    // reflect title/status changes in whichever column holds it
    setColumns((prev) => prev.map((c) => ({
      ...c,
      children: c.children.map((ch) => (ch.id === updated.id ? { ...ch, ...updated } : ch)),
    })));
  };

  const onNoteDeleted = (node) => {
    setActiveNote(null);
    setColumns((prev) => prev.map((c) => ({ ...c, children: c.children.filter((ch) => ch.id !== node.id), activeChildId: c.activeChildId === node.id ? null : c.activeChildId })));
  };

  // parent path shown in the modal preview (slug chain of the column titles,
  // excluding the synthetic root "Categories" column)
  const createParentPath = (() => {
    if (createState.mode === "category" || !createState.col) return "";
    const idx = columns.findIndex((c) => c.parentId === createState.col.parentId);
    if (idx <= 0) return ""; // root column → top-level
    return columns.slice(1, idx + 1).map((c) => slugPreview(c.title)).join("/");
  })();

  // breadcrumb = active folder chain (column titles beyond root) + note
  const crumbs = columns.slice(1).map((c) => c.title);

  return (
    <div className="h-full flex flex-col" style={{ background: "#0F172A" }}>
      {/* Top bar */}
      <div className="flex-none flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#1F2937" }}>
        <GraduationCap className="w-5 h-5" style={{ color: "#6366F1" }} />
        <span className="font-semibold" style={{ color: "#E5E7EB" }}>Learn</span>
        <div className="flex items-center gap-1 ml-2 text-sm min-w-0 overflow-x-auto scrollbar-none">
          <Home className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4B5563" }} />
          {crumbs.map((t, i) => (
            <span key={i} className="flex items-center gap-1 flex-shrink-0" style={{ color: "#6B7280" }}>
              <ChevronRight className="w-3 h-3" style={{ color: "#374151" }} />{t}
            </span>
          ))}
          {activeNote && (
            <span className="flex items-center gap-1 flex-shrink-0" style={{ color: "#9CA3AF" }}>
              <ChevronRight className="w-3 h-3" style={{ color: "#374151" }} />{activeNote.title}
            </span>
          )}
        </div>
        <button onClick={createTopCategory} className="ml-auto flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.25)" }}>
          <Plus className="w-3.5 h-3.5" /> Category
        </button>
      </div>

      {/* Columns + note panel */}
      <div ref={scrollRef} className="flex-1 flex overflow-x-auto overflow-y-hidden">
        {columns.map((col) => (
          <Column
            key={col.parentId ?? "root"}
            col={col}
            activeChildId={col.activeChildId}
            onOpenFolder={openFolder}
            onOpenNote={openNote}
            onCreate={createInColumn}
          />
        ))}
        {activeNote && <NotePanel node={activeNote} onChanged={onNoteChanged} onDeleted={onNoteDeleted} />}
      </div>

      <CreateModal
        open={createState.open}
        mode={createState.mode}
        parentPath={createParentPath}
        onClose={() => setCreateState({ open: false, mode: "note", col: null })}
        onSubmit={submitCreate}
      />
    </div>
  );
}
