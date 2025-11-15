"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { apiGet } from "@/lib/api";

/* ===== Tipos para el dashboard ===== */

type Material = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
};

type TransmutationDTO = {
  id: number;
  materialId: number;
  materialName?: string;
  quantityUsed: number;
};

type TransListResponse = {
  items?: TransmutationDTO[];
};

type Audit = {
  id: number;
  action: string;
  entity: string;
};

type Mission = {
  id: number;
  title: string;
  status: string;
};

/* ===== Helper: normalizar respuestas en lista ===== */

function normalizeList<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray((res as { items?: T[] }).items)) {
    return (res as { items?: T[] }).items as T[];
  }
  return [];
}

/* ===== Mini gráfico de barras sin librerías ===== */

type BarDatum = { label: string; value: number };

function BarChart({ title, data }: { title: string; data: BarDatum[] }) {
  if (!data.length) {
    return (
      <div className="card">
        <h3>{title}</h3>
        <p className="muted">Sin datos suficientes.</p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="chart">
        {data.map((d) => (
          <div key={d.label} className="chart-row">
            <div className="chart-label">{d.label}</div>
            <div className="chart-bar-wrap">
              <div
                className="chart-bar"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </div>
            <div className="chart-value">{d.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =================== PÁGINA PRINCIPAL =================== */

export default function Home() {
  const { user, login, register, logout } = useAuth();

  // --- estado login / registro ---
  const [email, setEmail] = useState("roy@amestris.gov");
  const [password, setPassword] = useState("fuego123");
  const [name, setName] = useState("Roy Mustang");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState("SUPERVISOR");
  const [msg, setMsg] = useState<string>("");

  // --- estado dashboard ---
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transmutations, setTransmutations] = useState<TransmutationDTO[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadingDash, setLoadingDash] = useState(false);
  const [errorDash, setErrorDash] = useState<string | null>(null);

  const isSupervisor = user?.role === "SUPERVISOR";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      if (mode === "login") {
        await login(email, password);
        setMsg("✅ Sesión iniciada correctamente.");
      } else {
        await register(name, email, password, role);
        setMsg("✅ Registro exitoso. Usuario autenticado.");
      }
    } catch (err: any) {
      const t = (err?.message || "").toLowerCase();
      if (t.includes("409")) setMsg("⚠️ Ese correo ya está registrado. Inicia sesión.");
      else setMsg("❌ " + (err?.message || "Error de conexión"));
    }
  }

  // ===== Carga de datos del dashboard cuando HAY usuario =====
  useEffect(() => {
    if (!user) return;

    setLoadingDash(true);
    setErrorDash(null);

    (async () => {
      try {
        const [matsRes, transRes, auditsRes, missionsRes] = await Promise.all([
          apiGet<any>("/api/materials"),
          apiGet<TransListResponse>("/api/transmutations?pageSize=50"),
          apiGet<any>("/api/audits"),
          apiGet<any>("/api/missions"),
        ]);

        setMaterials(normalizeList<Material>(matsRes));
        setTransmutations(
          normalizeList<TransmutationDTO>(transRes?.items ?? transRes)
        );
        setAudits(normalizeList<Audit>(auditsRes));
        setMissions(normalizeList<Mission>(missionsRes));
      } catch (e: any) {
        setErrorDash(e.message || "No se pudieron cargar los datos del panel");
      } finally {
        setLoadingDash(false);
      }
    })();
  }, [user]);

  // ===== Datos agregados para las gráficas =====
  const materialsChart = useMemo<BarDatum[]>(() => {
    return (materials || []).map((m) => ({
      label: m.name,
      value: m.quantity,
    }));
  }, [materials]);

  const transByMaterial = useMemo<BarDatum[]>(() => {
    const list = transmutations || [];
    const acc: Record<string, number> = {};
    for (const t of list) {
      const key = t.materialName || `#${t.materialId}`;
      acc[key] = (acc[key] || 0) + (t.quantityUsed || 0);
    }
    return Object.entries(acc).map(([label, value]) => ({ label, value }));
  }, [transmutations]);

  const auditsByAction = useMemo<BarDatum[]>(() => {
    const list = audits || [];
    const acc: Record<string, number> = {};
    for (const a of list) {
      const key = a.action || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
    }
    return Object.entries(acc).map(([label, value]) => ({ label, value }));
  }, [audits]);

  const openMissions = (missions || []).filter((m) => m.status !== "DONE");

  /* ========== SIN USUARIO: formulario original ========== */
  if (!user) {
    return (
      <section style={{ display: "grid", placeItems: "center", height: "80vh" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: 24,
            boxShadow: "0 4px 8px rgba(0,0,0,0.05)",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", marginBottom: 16 }}>
            {mode === "login" ? "Iniciar sesión" : "Registrarse"}
          </h1>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            {mode === "register" && (
              <>
                <input
                  placeholder="Nombre completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={inputStyle}
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={inputStyle}
                >
                  <option value="ALCHEMIST">ALCHEMIST</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                </select>
              </>
            )}

            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
            />

            <button
              type="submit"
              style={{
                background: "#4f46e5",
                color: "white",
                padding: "10px 16px",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          <p style={{ marginTop: 12 }}>
            {mode === "login" ? (
              <>
                ¿No tienes cuenta?{" "}
                <button
                  onClick={() => setMode("register")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#4f46e5",
                    cursor: "pointer",
                  }}
                >
                  Regístrate
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <button
                  onClick={() => setMode("login")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#4f46e5",
                    cursor: "pointer",
                  }}
                >
                  Inicia sesión
                </button>
              </>
            )}
          </p>

          {msg && (
            <p
              style={{
                marginTop: 10,
                color: msg.startsWith("✅")
                  ? "green"
                  : msg.startsWith("⚠️")
                  ? "#d97706"
                  : "red",
                fontWeight: 500,
              }}
            >
              {msg}
            </p>
          )}
        </div>
      </section>
    );
  }

  /* ========== CON USUARIO: dashboard ========== */

  return (
    <div className="home">
      <h1>Panel de {isSupervisor ? "Supervisor" : "Alquimista"}</h1>
      <p className="muted">
        Bienvenido, {user.name}. Rol: <strong>{user.role}</strong>
      </p>

      <div style={{ marginTop: 8, marginBottom: 12, fontSize: "0.9rem" }}>
        <Link href="/alchemists" style={{ marginRight: 12 }}>
          Ir a Alchemists
        </Link>
        <Link href="/missions" style={{ marginRight: 12 }}>
          Ir a Missions
        </Link>
        <Link href="/materials" style={{ marginRight: 12 }}>
          Ir a Materials
        </Link>
        <Link href="/transmutations" style={{ marginRight: 12 }}>
          Ir a Transmutations
        </Link>
        {isSupervisor && (
          <Link href="/audits" style={{ marginRight: 12 }}>
            Ver auditorías
          </Link>
        )}
        <button onClick={logout} style={{ marginLeft: 8 }}>
          Cerrar sesión
        </button>
      </div>

      {loadingDash && <p>Cargando panel…</p>}
      {errorDash && <p className="error">✖ {errorDash}</p>}

      {!loadingDash && !errorDash && (
        <>
          <div className="grid">
            <div className="card">
              <h3>Materiales</h3>
              <p className="big-number">{materials.length}</p>
              <p className="muted">registrados en el sistema</p>
            </div>
            <div className="card">
              <h3>Transmutaciones (últimas 50)</h3>
              <p className="big-number">{transmutations.length}</p>
              <p className="muted">operaciones recientes</p>
            </div>
            <div className="card">
              <h3>Misiones abiertas</h3>
              <p className="big-number">{openMissions.length}</p>
              <p className="muted">con estado distinto de DONE</p>
            </div>
            {isSupervisor && (
              <div className="card">
                <h3>Auditorías</h3>
                <p className="big-number">{audits.length}</p>
                <p className="muted">últimos eventos registrados</p>
              </div>
            )}
          </div>

          <div className="grid">
            <BarChart title="Stock de materiales" data={materialsChart} />
            <BarChart
              title="Materiales usados en transmutaciones (qty)"
              data={transByMaterial}
            />
            {isSupervisor && (
              <BarChart title="Auditorías por acción" data={auditsByAction} />
            )}
          </div>

          {!isSupervisor && (
            <div className="card" style={{ marginTop: "1rem" }}>
              <h3>Misiones en curso</h3>
              {openMissions.length === 0 ? (
                <p className="muted">No hay misiones abiertas.</p>
              ) : (
                <ul className="list">
                  {openMissions.map((m) => (
                    <li key={m.id}>
                      #{m.id} — <strong>{m.title}</strong>{" "}
                      <span className="badge">{m.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #ccc",
  width: "100%",
};
