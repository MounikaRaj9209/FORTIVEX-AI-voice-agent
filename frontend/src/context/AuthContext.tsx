import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";
import type { SystemSettings, User } from "../types";

interface AuthContextValue {
  user: User | null;
  settings: SystemSettings | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
    } catch {
      // ignore if unauthenticated
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("fortivex_token");
    if (!token) {
      setLoading(false);
      return;
    }
    Promise.all([api.me(), api.getSettings()])
      .then(([u, s]) => {
        setUser(u);
        setSettings(s);
      })
      .catch(() => {
        localStorage.removeItem("fortivex_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem("fortivex_token", res.access_token);
    setUser(res.user);
    await refreshSettings();
  };

  const register = async (fullName: string, email: string, password: string) => {
    const res = await api.register(fullName, email, password);
    localStorage.setItem("fortivex_token", res.access_token);
    setUser(res.user);
    await refreshSettings();
  };

  const logout = () => {
    localStorage.removeItem("fortivex_token");
    setUser(null);
    setSettings(null);
  };

  return (
    <AuthContext.Provider value={{ user, settings, loading, login, register, logout, refreshSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
