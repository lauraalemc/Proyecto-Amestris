"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useToast } from "@/context/ToastProvider";
import AuthGate from "@/components/AuthGate";

type Audit = {
  id: number;
  createdAt: string;
  action: string;
  entity: string;
  entityId: number;
  meta: any;
};

export default function AuditsPage() {
  const { error: toastError } = useToast();

  const [items, setItems] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet<Audit[]>("/api/audits");
      setItems(res || []);
    } catch (e: any) {
      toastError(e.message || "Error cargando auditorías");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = items.filter((a) => {
    const q = filter.toLowerCase();
    return (
      String(a.id).includes(q) ||
      a.action.toLowerCase().includes(q) ||
      a.entity.toLowerCase().includes(q) ||
      String(a.entityId).includes(q)
    );
  });

  return (
    <AuthGate>
      <main className="wrapper">
        <h1>Auditorías</h1>

        <p style={{ marginTop: 4, color: "#555" }}>
          Últimos eventos registrados en el sistema (máx. 100).
        </p>

        {/* Controles superiores */}
        <div
          style={{
            marginTop: 16,
            marginBottom: 12,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={load}
            disabled={loading}
            className="btn"
            style={{ padding: "6px 14px" }}
          >
            {loading ? "Cargando…" : "Recargar"}
          </button>

          <input
            placeholder="Filtrar por acción, entidad o ID"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              minWidth: 260,
              padding: "6px 10px",
              borderRadius: 4,
              border: "1px solid #ccc",
              fontSize: 13,
            }}
          />

          <span style={{ fontSize: 13, color: "#666" }}>
            {filtered.length} / {items.length} registros
          </span>
        </div>

        {/* Tabla */}
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: "#f5f5f5", borderBottom: "1px solid #ddd" }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Acción</th>
                <th style={thStyle}>Entidad</th>
                <th style={thStyle}>Entidad ID</th>
                <th style={thStyle}>Meta</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={tdStyle}>{a.id}</td>

                  <td style={tdStyle}>
                    {new Date(a.createdAt).toLocaleString("es-CO")}
                  </td>

                  <td style={tdStyle}>{a.action}</td>
                  <td style={tdStyle}>{a.entity}</td>
                  <td style={tdStyle}>{a.entityId}</td>

                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>
                    <details>
                      <summary
                        style={{
                          cursor: "pointer",
                          color: "#2563eb",
                          userSelect: "none",
                        }}
                      >
                        Ver meta
                      </summary>
                      <pre
                        style={{
                          marginTop: 6,
                          padding: 8,
                          background: "#f9fafb",
                          borderRadius: 4,
                          border: "1px solid #e5e7eb",
                          maxHeight: 200,
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                        }}
                      >
{JSON.stringify(a.meta, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "#777",
                      fontStyle: "italic",
                    }}
                  >
                    No hay registros que coincidan con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </AuthGate>
  );
}

/** estilos de celda reutilizables */
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontWeight: 600,
  fontSize: 12,
  color: "#444",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  verticalAlign: "top",
};
