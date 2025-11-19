"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type User = { id: number; name: string; email: string; role: string };

type AuthCtx = {
  user: User | null;
  token: string | null; // access
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);
export const useAuth = () => useContext(AuthContext)!;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Carga inicial: rehidrata (auth.access || token suelto) y valida /me
  useEffect(() => {
    const access =
      (() => {
        try {
          const raw = localStorage.getItem("auth");
          if (!raw) return undefined;
          const parsed = JSON.parse(raw);
          return parsed?.access as string | undefined;
        } catch {
          return undefined;
        }
      })() || localStorage.getItem("token") || undefined;

    if (!access) {
      setReady(true);
      return;
    }
    setToken(access);

    apiFetch<User>("/api/auth/me", { token: access })
      .then((me) => setUser(me))
      .catch(() => {
        localStorage.removeItem("auth");
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  // Login
  async function login(email: string, password: string) {
    const res = await apiFetch<{ token: string; user: User; access?: string; refresh?: string; jti?: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
      }
    );

    if (res.access && res.refresh && res.jti) {
      localStorage.setItem("auth", JSON.stringify({ access: res.access, refresh: res.refresh, jti: res.jti }));
      localStorage.setItem("token", res.access); // compat
      setToken(res.access);
    } else {
      localStorage.setItem("token", res.token);
      setToken(res.token);
    }
    setUser(res.user);
  }

  // Registro
  async function register(name: string, email: string, password: string, role: string) {
    const res = await apiFetch<{ token: string; user: User; access?: string; refresh?: string; jti?: string }>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
        headers: { "Content-Type": "application/json" },
      }
    );

    if (res.access && res.refresh && res.jti) {
      localStorage.setItem("auth", JSON.stringify({ access: res.access, refresh: res.refresh, jti: res.jti }));
      localStorage.setItem("token", res.access); // compat
      setToken(res.access);
    } else {
      localStorage.setItem("token", res.token);
      setToken(res.token);
    }
    setUser(res.user);
  }

  // Logout (intenta revocar refresh si existe)
  function logout() {
    try {
      const raw = localStorage.getItem("auth");
      if (raw) {
        const { jti } = JSON.parse(raw);
        if (jti) {
          apiFetch("/api/auth/logout", {
            method: "POST",
            body: JSON.stringify({ jti }),
            headers: { "Content-Type": "application/json" },
          }).catch(() => {});
        }
      }
    } catch {}

    localStorage.removeItem("auth");
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
