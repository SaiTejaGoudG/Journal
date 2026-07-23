"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import SettingsPage from "@/views/SettingsPage";
export default function SettingsRoutePage() {
  return <ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>;
}
