"use client";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import QuickCapture from "./QuickCapture";

export default function Layout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0F172A" }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-none" style={{ width: 256 }}>
        <Sidebar />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Quick Capture FAB */}
      <QuickCapture />

      {/* Mobile Bottom Nav */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
