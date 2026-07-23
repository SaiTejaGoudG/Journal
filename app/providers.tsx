"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
      <Toaster
        theme="dark"
        position="top-center"
        richColors
        toastOptions={{ style: { fontFamily: "Manrope, sans-serif" } }}
      />
    </ThemeProvider>
  );
}
