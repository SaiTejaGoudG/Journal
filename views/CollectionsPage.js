"use client";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import API from "@/services/api";
import NoteCard from "@/components/NoteCard";
import { FolderOpen, Plus, X, ChevronRight, Image, Trash2 } from "lucide-react";

const COVER_IMAGES = [
  "https://images.unsplash.com/photo-1687639166604-b91cf403fe61?w=400&q=80",
  "https://images.unsplash.com/photo-1688141585058-50787735e064?w=400&q=80",
  "https://images.pexels.com/photos/532563/pexels-photo-532563.jpeg?w=400",
];

export default function CollectionsPage() {
  const [collections, setCollections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCover, setNewCover] = useState(COVER_IMAGES[0]);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const fetchCollections = async () => {
    try {
      const res = await API.get("/collections");
      setCollections(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCollections(); }, []);

  const handleSelect = async (coll) => {
    if (selected?.id === coll.id) { setSelected(null); return; }
    try {
      const res = await API.get(`/collections/${coll.id}`);
      setSelected(res.data);
    } catch (err) { console.error(err); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await API.post("/collections", { name: newName, description: newDesc, cover_image: newCover });
      setCollections(prev => [res.data, ...prev]);
      setShowCreate(false);
      setNewName(""); setNewDesc("");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create collection");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (coll) => {
    if (!window.confirm(`Delete "${coll.name}"?`)) return;
    try {
      await API.delete(`/collections/${coll.id}`);
      setCollections(prev => prev.filter(c => c.id !== coll.id));
      if (selected?.id === coll.id) setSelected(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete");
    }
  };

  return (
    <div className="h-full flex flex-col px-4 lg:px-6 py-6" style={{ background: "#0F172A" }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: "#E5E7EB" }}>Collections</h1>
        <button
          data-testid="create-collection-btn"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: "#6366F1", color: "#fff" }}
        >
          <Plus className="w-4 h-4" /> New Collection
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 slide-up" style={{ background: "#111827", border: "1px solid #1F2937" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "#E5E7EB" }}>New Collection</h2>
              <button onClick={() => setShowCreate(false)} style={{ color: "#6B7280" }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                data-testid="collection-name-input"
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Collection name"
                className="w-full px-4 py-3 rounded-xl text-sm input-focus"
                style={{ background: "#0F172A", border: "1px solid #1F2937", color: "#E5E7EB" }}
                required
              />
              <input
                data-testid="collection-desc-input"
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-4 py-3 rounded-xl text-sm input-focus"
                style={{ background: "#0F172A", border: "1px solid #1F2937", color: "#E5E7EB" }}
              />
              <div>
                <p className="text-xs mb-2" style={{ color: "#6B7280" }}>Cover Image</p>
                <div className="flex gap-2">
                  {COVER_IMAGES.map(img => (
                    <div
                      key={img}
                      onClick={() => setNewCover(img)}
                      className="w-16 h-12 rounded-lg overflow-hidden cursor-pointer transition-all"
                      style={{ border: `2px solid ${newCover === img ? "#6366F1" : "transparent"}` }}
                    >
                      <img src={img} alt="cover" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
              <button
                data-testid="create-collection-submit-btn"
                type="submit"
                disabled={creating}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ background: "#6366F1", color: "#fff" }}
              >
                {creating ? <div className="spinner w-4 h-4 mx-auto" /> : "Create Collection"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="spinner w-8 h-8" /></div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(99,102,241,0.1)" }}>
              <FolderOpen className="w-8 h-8" style={{ color: "#6366F1" }} />
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: "#E5E7EB" }}>No collections yet</h3>
            <p className="text-sm" style={{ color: "#6B7280" }}>Organize your notes into collections</p>
          </div>
        ) : (
          <div className="space-y-4 stagger-children">
            {collections.map(coll => (
              <div key={coll.id} className="rounded-2xl overflow-hidden transition-all duration-200" style={{ background: "#111827", border: `1px solid ${selected?.id === coll.id ? "#6366F1" : "#1F2937"}` }}>
                <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => handleSelect(coll)}>
                  {coll.cover_image ? (
                    <div className="w-16 h-12 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={coll.cover_image} alt={coll.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(99,102,241,0.1)" }}>
                      <FolderOpen className="w-6 h-6" style={{ color: "#6366F1" }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate" style={{ color: "#E5E7EB" }}>{coll.name}</h3>
                    {coll.description && <p className="text-xs truncate mt-0.5" style={{ color: "#6B7280" }}>{coll.description}</p>}
                    <p className="text-xs mt-1" style={{ color: "#4B5563" }}>{coll.note_count || 0} notes</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      data-testid={`delete-collection-${coll.id}`}
                      onClick={(e) => { e.stopPropagation(); handleDelete(coll); }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      style={{ color: "#6B7280" }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 transition-transform" style={{ color: "#4B5563", transform: selected?.id === coll.id ? "rotate(90deg)" : "none" }} />
                  </div>
                </div>

                {/* Collection Notes */}
                {selected?.id === coll.id && (
                  <div className="border-t px-4 pb-4 pt-3 fade-in" style={{ borderColor: "#1F2937" }}>
                    {selected.notes?.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selected.notes.map(note => (
                          <NoteCard key={note.id} note={note} onAction={() => {}} view="list" />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm" style={{ color: "#6B7280" }}>No notes in this collection yet.</p>
                        <button
                          onClick={() => router.push("/notes/new")}
                          className="mt-2 text-xs font-medium"
                          style={{ color: "#818CF8" }}
                        >
                          Add a note
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
