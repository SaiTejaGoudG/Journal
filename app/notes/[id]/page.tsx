"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import NoteEditor from "@/views/NoteEditor";
export default function EditNotePage() {
  return <ProtectedRoute><NoteEditor /></ProtectedRoute>;
}
