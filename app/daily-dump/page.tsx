"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import DailyDump from "@/views/DailyDump";
export default function DailyDumpPage() {
  return <ProtectedRoute><Layout><DailyDump /></Layout></ProtectedRoute>;
}
