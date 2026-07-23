"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? "/dashboard" : "/auth");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F172A" }}>
      <div className="spinner w-10 h-10" />
    </div>
  );
}
