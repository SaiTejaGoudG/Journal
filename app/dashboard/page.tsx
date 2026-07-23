"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Dashboard from "@/views/Dashboard";
export default function DashboardPage() {
  return <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>;
}
