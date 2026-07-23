"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Browse from "@/views/Browse";
export default function BrowsePage() {
  return <ProtectedRoute><Layout><Browse /></Layout></ProtectedRoute>;
}
