// frontend/src/lib/api.ts
const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "");

type ApiOptions = RequestInit & {
  token?: string;     // si lo pasas aquí, fuerza ese token (omite el auto refresh)
  timeoutMs?: number; // abort automático
};

/** =========================================================
 *  Gestión centralizada de tokens (access / refresh / jti)
 *  - Mantiene compat con tu "token" previo en local/sessionStorage
 *  ========================================================= */
type StoredTokens = { access: string; refresh: string; jti: string };

export const Token = {
  /** Access token actual (compat: cae a "token" suelto si no hay "auth") */
  get(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const raw = localStorage.getItem("auth");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredTokens;
        return parsed.access;
      } catch {
        /* ignore */
      }
    }
    // Compat con código anterior
    return sessionStorage.getItem("token") || localStorage.getItem("token") || undefined;
  },

  /** Estructura completa (access/refresh/jti) o null */
  getAll(): StoredTokens | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("auth");
    if (!raw) return null;
    try { return JSON.parse(raw) as StoredTokens; } catch { return null; }
  },

  /** Set completo + compat con "token" suelto */
  setAll(v: StoredTokens) {
    if (typeof window === "undefined") return;
    localStorage.setItem("auth", JSON.stringify(v));
    // Compat con tu lógica actual
    localStorage.setItem("token", v.access);
    sessionStorage.setItem("token", v.access);
  },

  /** 🔁 Alias retro-compatible: guarda SOLO el access token */
  set(value: string) {
    // Permite que código antiguo siga usando Token.set(token)
    this.setAll({ access: value, refresh: "", jti: "" });
  },

  /** Borrado total + compat */
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("auth");
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  },
};

/* ===================== Helpers ===================== */

export function qs(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

/* ===================== Refresh (una vez) ===================== */

async function tryRefreshOnce(): Promise<boolean> {
  const t = Token.getAll();
  if (!t || !t.refresh) return false;

  const res = await fetch(buildUrl("/api/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: t.refresh, jti: t.jti }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  if (!data?.access || !data?.refresh || !data?.jti) return false;

  Token.setAll({ access: data.access, refresh: data.refresh, jti: data.jti });
  return true;
}

/* ===================== Core fetch con auto-refresh ===================== */

export async function apiFetch<T = any>(path: string, opts: ApiOptions = {}) {
  const url = buildUrl(path);
  const headers = new Headers(opts.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && opts.body) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  const token = opts.token ?? Token.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeoutId =
    opts.timeoutMs && opts.timeoutMs > 0
      ? setTimeout(() => controller.abort(), opts.timeoutMs)
      : null;

  try {
    const res = await fetch(url, { ...opts, headers, signal: controller.signal });
    if (res.status === 204) return null as T;

    const text = await res.text();
    const data = text ? safeJson(text) : null;

    if (!res.ok) {
      // Si 401 y no estamos forzando un token explícito → intenta refresh una vez
      if (res.status === 401 && !opts.token) {
        const refreshed = await tryRefreshOnce();
        if (refreshed) {
          const newAccess = Token.get();
          if (newAccess) headers.set("Authorization", `Bearer ${newAccess}`);
          const res2 = await fetch(url, { ...opts, headers, signal: controller.signal });
          const text2 = await res2.text();
          const data2 = text2 ? safeJson(text2) : null;
          if (!res2.ok) {
            const msg2 = (data2 && (data2 as any).error) || text2 || `HTTP ${res2.status}`;
            throw new Error(msg2);
          }
          return data2 as T;
        }
      }
      const msg = (data && (data as any).error) || text || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data as T;
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("La solicitud excedió el tiempo de espera.");
    if (err instanceof TypeError)
      throw new Error("Error de red o CORS (Failed to fetch). Revisa el backend y CORS.");
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/* ===================== Azúcar ===================== */

export async function apiGet<T = any>(
  path: string,
  params?: Record<string, any>,
  opts: ApiOptions = {}
) {
  const url = `${path}${qs(params || {})}`;
  return apiFetch<T>(url, { ...opts, method: "GET" });
}

export const apiPost = <T = any>(path: string, body?: any, opts: ApiOptions = {}) =>
  apiFetch<T>(path, { ...opts, method: "POST", body: body ? JSON.stringify(body) : undefined });

export const apiPut = <T = any>(path: string, body?: any, opts: ApiOptions = {}) =>
  apiFetch<T>(path, { ...opts, method: "PUT", body: body ? JSON.stringify(body) : undefined });

export const apiDelete = <T = any>(path: string, opts: ApiOptions = {}) =>
  apiFetch<T>(path, { ...opts, method: "DELETE" });

/* ===================== Módulos API ===================== */

export const AuthAPI = {
  // Trae { token, user } (compat) y si el backend ya envía {access,refresh,jti}, también los recibimos
  login: (email: string, password: string) =>
    apiPost<{ token: string; access?: string; refresh?: string; jti?: string; user: any }>(
      "/api/auth/login",
      { email, password },
      { timeoutMs: 15000 }
    ),
  register: (name: string, email: string, password: string, role: string) =>
    apiPost<{ token: string; access?: string; refresh?: string; jti?: string; user: any }>(
      "/api/auth/register",
      { name, email, password, role },
      { timeoutMs: 15000 }
    ),
};

export const MaterialsAPI = {
  list: () =>
    apiGet<{ items: any[]; page: number; pageSize: number; total: number }>("/api/materials"),
  create: (payload: {
    name: string;
    quantity: number;
    unit: string;
    rarity?: string | null;
    notes?: string | null;
  }) => apiPost<any>("/api/materials", payload),
  update: (
    id: number,
    payload: Partial<{ name: string; quantity: number; unit: string; rarity?: string | null; notes?: string | null }>
  ) => apiPut<any>(`/api/materials/${id}`, payload),
  del: (id: number) => apiDelete<void>(`/api/materials/${id}`),
};

export const TransmutationsAPI = {
  list: (params?: { page?: number; pageSize?: number; q?: string }) =>
    apiGet<{ items: any[]; page: number; pageSize: number; total: number }>(
      "/api/transmutations",
      params
    ),
  create: (payload: {
    title: string;
    materialId: number;
    missionId?: number | null;
    quantityUsed: number;
    result?: string | null;
  }) => apiPost<any>("/api/transmutations", payload),
  del: (id: number) => apiDelete<void>(`/api/transmutations/${id}`),
};

export const AuditsAPI = {
  list: () => apiGet<any[]>("/api/audits"),
};

export const AlchemistsAPI = {
  list: () => apiGet<any[]>("/api/alchemists"),
};

export const MissionsAPI = {
  list: () => apiGet<any[]>("/api/missions"),
  create: (payload: {
    title: string;
    assignedAlchemistId?: number | null;
    status?: string;
    description?: string | null;
  }) => apiPost<any>("/api/missions", payload),

  // ✅ nuevo: eliminar misión
  del: (id: number) => apiDelete<void>(`/api/missions/${id}`),
};

