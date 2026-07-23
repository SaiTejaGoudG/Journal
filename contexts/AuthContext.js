"use client";
import { createContext, useContext, useState, useEffect } from "react";
import API from "@/services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Client-only: check stored token and re-hydrate user
    const token = typeof window !== "undefined" ? localStorage.getItem("sb_access_token") : null;
    if (!token) { setLoading(false); return; }
    API.get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("sb_access_token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, []);

  const login = async (email, password) => {
    const { data } = await API.post("/auth/login", { email, password });
    if (data.access_token) localStorage.setItem("sb_access_token", data.access_token);
    const { access_token, ...userData } = data;
    setUser(userData);
    return userData;
  };

  const register = async (email, password, name) => {
    const { data } = await API.post("/auth/register", { email, password, name });
    if (data.access_token) localStorage.setItem("sb_access_token", data.access_token);
    const { access_token, ...userData } = data;
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try { await API.post("/auth/logout"); } catch (_) {}
    localStorage.removeItem("sb_access_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
