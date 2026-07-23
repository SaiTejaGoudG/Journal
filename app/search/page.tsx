"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import SearchPage from "@/views/SearchPage";
export default function SearchRoutePage() {
  return <ProtectedRoute><Layout><SearchPage /></Layout></ProtectedRoute>;
}
