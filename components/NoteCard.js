"use client";
import { useState } from "react";
import { useRouter } from 'next/navigation';
import API from "@/services/api";
import {
  Star, Pin, MoreHorizontal, Edit3, Archive, Trash2, Image, Tag
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";

const CAT_COLORS = {
  "Technical": "#6366F1",
  "Content Creation": "#EC4899",
  "Ideas": "#F59E0B",
};
const CAT_CLASS = {
  "Technical": "cat-technical",
  "Content Creation": "cat-content",
  "Ideas": "cat-ideas",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NoteCard({ note, onAction, view = "grid" }) {
  const router = useRouter();
  const [favLoading, setFavLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  const color = CAT_COLORS[note.category] || "#6366F1";
  const catClass = CAT_CLASS[note.category] || "cat-technical";

  const handleFavorite = async (e) => {
    e.stopPropagation();
    if (favLoading) return;
    setFavLoading(true);
    try {
      await API.post(`/notes/${note.id}/favorite`);
      onAction("favorite", note.id);
    } catch (err) { console.error(err); }
    finally { setFavLoading(false); }
  };

  const handlePin = async (e) => {
    e.stopPropagation();
    if (pinLoading) return;
    setPinLoading(true);
    try {
      await API.post(`/notes/${note.id}/pin`);
      onAction("pin", note.id);
    } catch (err) { console.error(err); }
    finally { setPinLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this note permanently?")) return;
    try {
      await API.delete(`/notes/${note.id}`);
      onAction("delete", note.id);
    } catch (err) { alert(err.response?.data?.detail || "Delete failed"); }
  };

  const handleArchive = async () => {
    try {
      await API.post(`/notes/${note.id}/archive`);
      onAction("archive", note.id);
    } catch (err) { alert(err.response?.data?.detail || "Archive failed"); }
  };

  const contentPreview = (note.content || "").replace(/[#*`>_\[\]]/g, "").substring(0, view === "list" ? 120 : 160);
  const hasThumbnail = note.images?.length > 0;

  if (view === "list") {
    return (
      <div
        data-testid={`note-card-${note.id}`}
        className={`rounded-2xl overflow-hidden note-card-hover cursor-pointer flex items-stretch ${catClass}`}
        style={{ background: "#111827", border: "1px solid #1F2937" }}
        onClick={() => router.push(`/notes/${note.id}`)}
      >
        {/* Left category indicator already via catClass */}
        {hasThumbnail && (
          <div className="w-20 flex-shrink-0 overflow-hidden">
            <img src={note.images[0]} alt="thumb" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 px-4 py-3 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm leading-snug line-clamp-1" style={{ color: "#E5E7EB" }}>{note.title || "Untitled"}</h3>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button data-testid={`fav-btn-${note.id}`} onClick={handleFavorite} className="p-1 transition-colors">
                  <Star className="w-3.5 h-3.5" fill={note.is_favorite ? "#F59E0B" : "none"} style={{ color: note.is_favorite ? "#F59E0B" : "#4B5563" }} />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button data-testid={`more-btn-${note.id}`} className="p-1" style={{ color: "#4B5563" }}>
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent style={{ background: "#111827", border: "1px solid #1F2937" }} align="end">
                    <DropdownMenuItem onClick={() => router.push(`/notes/${note.id}`)} style={{ color: "#E5E7EB", cursor: "pointer" }}>
                      <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePin} style={{ color: "#E5E7EB", cursor: "pointer" }}>
                      <Pin className="w-3.5 h-3.5 mr-2" /> {note.is_pinned ? "Unpin" : "Pin"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleArchive} style={{ color: "#E5E7EB", cursor: "pointer" }}>
                      <Archive className="w-3.5 h-3.5 mr-2" /> Archive
                    </DropdownMenuItem>
                    <DropdownMenuSeparator style={{ background: "#1F2937" }} />
                    <DropdownMenuItem onClick={handleDelete} style={{ color: "#F87171", cursor: "pointer" }}>
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {contentPreview && (
              <p className="text-xs mt-1 line-clamp-2" style={{ color: "#6B7280" }}>{contentPreview}</p>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: `${color}18`, color }}>
              {note.category}
            </span>
            {note.tags?.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs tag-default px-1.5 py-0.5 rounded-md">#{tag}</span>
            ))}
            <span className="text-xs ml-auto" style={{ color: "#4B5563" }}>{timeAgo(note.created_at)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      data-testid={`note-card-${note.id}`}
      className={`rounded-2xl overflow-hidden note-card-hover cursor-pointer flex flex-col ${catClass}`}
      style={{ background: "#111827", border: "1px solid #1F2937" }}
      onClick={() => router.push(`/notes/${note.id}`)}
    >
      {/* Thumbnail */}
      {hasThumbnail && (
        <div className="h-32 overflow-hidden">
          <img src={note.images[0]} alt="thumb" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex-1 p-4 flex flex-col gap-2">
        {/* Category + Pin indicator */}
        <div className="flex items-center justify-between">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}18`, color }}>
            {note.category}
          </span>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {note.is_pinned && <Pin className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />}
            <button data-testid={`fav-btn-${note.id}`} onClick={handleFavorite} className="p-1 transition-all">
              <Star className="w-3.5 h-3.5" fill={note.is_favorite ? "#F59E0B" : "none"} style={{ color: note.is_favorite ? "#F59E0B" : "#4B5563" }} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid={`more-btn-${note.id}`} className="p-1" style={{ color: "#4B5563" }} onClick={e => e.stopPropagation()}>
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent style={{ background: "#111827", border: "1px solid #1F2937" }} align="end">
                <DropdownMenuItem onClick={() => router.push(`/notes/${note.id}`)} style={{ color: "#E5E7EB", cursor: "pointer" }}>
                  <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePin(); }} style={{ color: "#E5E7EB", cursor: "pointer" }}>
                  <Pin className="w-3.5 h-3.5 mr-2" /> {note.is_pinned ? "Unpin" : "Pin"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(); }} style={{ color: "#E5E7EB", cursor: "pointer" }}>
                  <Archive className="w-3.5 h-3.5 mr-2" /> Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator style={{ background: "#1F2937" }} />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(); }} style={{ color: "#F87171", cursor: "pointer" }}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-medium text-sm leading-snug line-clamp-2" style={{ color: "#E5E7EB" }}>
          {note.title || "Untitled"}
        </h3>

        {/* Content preview */}
        {contentPreview && (
          <p className="text-xs leading-relaxed line-clamp-3 flex-1" style={{ color: "#6B7280" }}>
            {contentPreview}
          </p>
        )}

        {/* Tags */}
        {note.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {note.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs tag-default px-1.5 py-0.5 rounded-md">#{tag}</span>
            ))}
            {note.tags.length > 3 && (
              <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ color: "#4B5563" }}>+{note.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t" style={{ borderColor: "#1F2937" }}>
          <span className="text-xs" style={{ color: "#4B5563" }}>{timeAgo(note.created_at)}</span>
          {note.images?.length > 1 && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "#4B5563" }}>
              <Image className="w-3 h-3" /> {note.images.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
