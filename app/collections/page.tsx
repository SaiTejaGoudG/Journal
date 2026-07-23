"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import CollectionsPage from "@/views/CollectionsPage";
export default function CollectionsRoutePage() {
  return <ProtectedRoute><Layout><CollectionsPage /></Layout></ProtectedRoute>;
}
