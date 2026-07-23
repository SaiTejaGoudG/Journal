"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import FavoritesPage from "@/views/FavoritesPage";
export default function FavoritesRoutePage() {
  return <ProtectedRoute><Layout><FavoritesPage /></Layout></ProtectedRoute>;
}
