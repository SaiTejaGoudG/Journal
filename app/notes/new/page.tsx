"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import NoteEditor from "@/views/NoteEditor";
export default function NewNotePage() {
  return <ProtectedRoute><NoteEditor /></ProtectedRoute>;
}
