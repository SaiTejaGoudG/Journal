"use client";
import { useState } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/contexts/AuthContext";
import { formatApiError } from "@/services/api";
import { Brain, Mail, Lock, User, Eye, EyeOff, ArrowRight } from "lucide-react";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        if (!name.trim()) { setError("Name is required"); setLoading(false); return; }
        await register(email, password, name);
      }
      router.push("/");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0F172A 0%, #111827 50%, #0F172A 100%)" }}>
      {/* Background accents */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366F1 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-8" style={{ background: "radial-gradient(circle, #EC4899 0%, transparent 70%)" }} />
      </div>

      <div className="w-full max-w-md slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
            <Brain className="w-7 h-7" style={{ color: "#6366F1" }} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "#E5E7EB" }}>
            Second Brain
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
            {mode === "login" ? "Welcome back. Good to see you." : "Start capturing your knowledge."}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: "#111827", border: "1px solid #1F2937" }}>
          {/* Mode toggle */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: "#0F172A" }}>
            {["login", "register"].map(m => (
              <button
                key={m}
                data-testid={`auth-tab-${m}`}
                onClick={() => { setMode(m); setError(""); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: mode === m ? "#6366F1" : "transparent",
                  color: mode === m ? "#fff" : "#6B7280",
                }}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "#9CA3AF" }}>Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#6B7280" }} />
                  <input
                    data-testid="register-name-input"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm input-focus transition-all"
                    style={{ background: "#0F172A", border: "1px solid #1F2937", color: "#E5E7EB" }}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "#9CA3AF" }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#6B7280" }} />
                <input
                  data-testid="auth-email-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm input-focus transition-all"
                  style={{ background: "#0F172A", border: "1px solid #1F2937", color: "#E5E7EB" }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "#9CA3AF" }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#6B7280" }} />
                <input
                  data-testid="auth-password-input"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm input-focus transition-all"
                  style={{ background: "#0F172A", border: "1px solid #1F2937", color: "#E5E7EB" }}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  data-testid="toggle-password-visibility"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#6B7280" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div data-testid="auth-error" className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
                {error}
              </div>
            )}

            <button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200"
              style={{ background: loading ? "#4338CA" : "#6366F1", color: "#fff", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <div className="spinner w-4 h-4" />
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm mt-4" style={{ color: "#6B7280" }}>
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              data-testid="auth-mode-toggle"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="font-medium transition-colors"
              style={{ color: "#818CF8" }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#374151" }}>
          Your personal knowledge, beautifully organized.
        </p>
      </div>
    </div>
  );
}
