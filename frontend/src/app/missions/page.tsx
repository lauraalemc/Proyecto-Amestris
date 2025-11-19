"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiGet, Token } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { useToast } from "@/context/ToastProvider";

type MissionStatus = "PENDING" | "IN_PROGRESS" | "DONE";

type Mission = {
  id: number;
  title: string;
  description?: string | null;
  assignedAlchemistId?: number | null;
  assignedAlchemistName?: string | null;
  status: MissionStatus;
};

type CreateIn = {
  title: string;
  description?: string;
  assignedAlchemistId?: number | null;
  status?: MissionStatus;
};
type UpdateIn = Partial<CreateIn>;
type AlchemistOpt = { id: number; name: string };

/** Permite usar tanto Mission[] como {items: Mission[]} */
function normalizeList<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && Array.isArray(res.items)) return res.items as T[];
  return [];
}

function statusLabel(s: MissionStatus | undefined): string {
  if (!s) return "";
  if (s === "PENDING") return "Pending";
  if (s === "IN_PROGRESS") return "In progress";
  if (s === "DONE") return "Done";
  return s;
}

// Estilo del badge por estado
function statusBadgeStyle(status?: MissionStatus) {
  const base: any = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600,
  };

  if (!status || status === "PENDING") {
    return {
      ...base,
      backgroundColor: "#fef3c7",
      color: "#92400e",
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      ...base,
      backgroundColor: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  // DONE
  return {
    ...base,
    backgroundColor: "#dcfce7",
    color: "#166534",
  };
}

export default function MissionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const isSupervisor = user?.role === "SUPERVISOR";

  const [items, setItems] = useState<Mission[]>([]);
  const [alchemists, setAlchemists] = useState<AlchemistOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [form, setForm] = useState<CreateIn>({
    title: "",
    description: "",
    assignedAlchemistId: null,
    status: "PENDING",
  });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<UpdateIn>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const canCreate = useMemo(() => form.title.trim() !== "", [form.title]);

  // ——— Helper para errores de auth: limpia token y manda a /login
  function handleAuthError(e: any) {
    const msg = String(e?.message || "").toLowerCase();
    if (
      msg.includes("unauthorized") ||
      msg.includes("no autentic") ||
      msg.includes("token")
    ) {
      Token.clear();
      router.replace("/login");
      return true;
    }
    return false;
  }

  // Carga distinta según rol
  async function load() {
    setLoading(true);
    setLoadErr(null);
    try {
      // 1) Misiones para cualquier rol
      const missionsRes = await apiGet<any>("/api/missions");
      setItems(normalizeList<Mission>(missionsRes));

      // 2) Solo supervisor carga alquimistas
      if (isSupervisor) {
        const alchs = await apiGet<any[]>("/api/alchemists");
        setAlchemists((alchs || []).map((a: any) => ({ id: a.id, name: a.name })));
      } else {
        setAlchemists([]);
      }
    } catch (e: any) {
      if (handleAuthError(e)) return;
      setLoadErr(e.message || "Error cargando misiones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    
  }, [isSupervisor]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      setFormErr("El título es obligatorio.");
      return;
    }
    setFormErr(null);
    setSubmitting(true);
    try {
      const created = await apiFetch<Mission>("/api/missions", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description?.trim() || undefined,
          assignedAlchemistId: form.assignedAlchemistId || undefined,
          status: "PENDING" as MissionStatus,
        }),
      });
      setItems((cur) => [created, ...cur]);
      setForm({
        title: "",
        description: "",
        assignedAlchemistId: null,
        status: "PENDING",
      });
      success("Misión creada");
    } catch (e: any) {
      if (handleAuthError(e)) return;
      toastError(e.message || "No se pudo crear la misión");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(m: Mission) {
    setEditingId(m.id);
    setEdit({
      title: m.title,
      description: m.description ?? "",
      assignedAlchemistId: m.assignedAlchemistId ?? null,
      status: m.status,
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setEdit({});
  }
  async function saveEdit(id: number) {
    setSavingEdit(true);
    try {
      const updated = await apiFetch<Mission>(`/api/missions/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: edit.title?.toString().trim(),
          description: edit.description?.toString().trim(),
          assignedAlchemistId: edit.assignedAlchemistId ?? undefined,
          status: edit.status as MissionStatus | undefined,
        }),
      });
      setItems((cur) => cur.map((x) => (x.id === id ? updated : x)));
      cancelEdit();
      success("Misión actualizada");
    } catch (e: any) {
      if (handleAuthError(e)) return;
      toastError(e.message || "No se pudo actualizar");
    } finally {
      setSavingEdit(false);
    }
  }
  async function remove(id: number) {
    if (!confirm("¿Eliminar misión?")) return;
    try {
      await apiFetch(`/api/missions/${id}`, { method: "DELETE" });
      setItems((cur) => cur.filter((x) => x.id !== id));
      success("Misión eliminada");
    } catch (e: any) {
      if (handleAuthError(e)) return;
      toastError(e.message || "No se pudo eliminar");
    }
  }

  return (
    <AuthGate>
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Missions</h1>
        <p className="text-sm text-neutral-600 mb-6">
          {isSupervisor
            ? "Como supervisor puedes crear, editar y asignar misiones a los alquimistas."
            : "Como alquimista puedes consultar las misiones registradas en el sistema y ver su estado."}
        </p>

        {/* FORMULARIO (solo supervisor, sin campo de estado) */}
        {isSupervisor && (
          <form
            onSubmit={handleCreate}
            className="space-y-4 p-4 rounded-xl border bg-white shadow-sm mb-8"
          >
            {/* Título */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Título *
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ej. Inspección en Central City"
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
              />
              {form.title.trim() === "" && (
                <p className="mt-1 text-xs text-red-600">
                  Requerido: título
                </p>
              )}
            </div>

            {/* Alchemist (opcional) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                (Opcional) Alchemist
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={form.assignedAlchemistId ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    assignedAlchemistId: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              >
                <option value="">Sin asignar</option>
                {alchemists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Descripción
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ej. Verificar reportes de círculos no autorizados"
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            {formErr && (
              <p className="text-sm text-red-600">✖ {formErr}</p>
            )}

            <div className="flex justify-end">
              <button
                disabled={!canCreate || submitting}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}

        {loading && <p>Cargando...</p>}
        {loadErr && <p className="text-red-500">✖ {loadErr}</p>}

        {/* TABLA DE MISIONES */}
        {!loading && (
          <section className="mt-4">
            <h2 className="text-lg font-semibold mb-3">
              Misiones registradas
            </h2>

            {items.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No hay misiones registradas.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    minWidth: "700px",
                  }}
                >
                  <thead>
                    <tr style={{ display: "table-row" }}>
                      <th
                        style={{
                          display: "table-cell",
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "left",
                          backgroundColor: "#f5f5f5",
                          fontWeight: 600,
                        }}
                      >
                        ID
                      </th>
                      <th
                        style={{
                          display: "table-cell",
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "left",
                          backgroundColor: "#f5f5f5",
                          fontWeight: 600,
                        }}
                      >
                        Título
                      </th>
                      <th
                        style={{
                          display: "table-cell",
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "left",
                          backgroundColor: "#f5f5f5",
                          fontWeight: 600,
                        }}
                      >
                        Estado
                      </th>
                      <th
                        style={{
                          display: "table-cell",
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "left",
                          backgroundColor: "#f5f5f5",
                          fontWeight: 600,
                        }}
                      >
                        Alchemist asignado
                      </th>
                      <th
                        style={{
                          display: "table-cell",
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "left",
                          backgroundColor: "#f5f5f5",
                          fontWeight: 600,
                        }}
                      >
                        Descripción
                      </th>
                      {isSupervisor && (
                        <th
                          style={{
                            display: "table-cell",
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "right",
                            backgroundColor: "#f5f5f5",
                            fontWeight: 600,
                          }}
                        >
                          Acciones
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((m) =>
                      editingId === m.id ? (
                        <tr
                          key={m.id}
                          style={{ display: "table-row" }}
                        >
                          {/* ID */}
                          <td
                            style={{
                              display: "table-cell",
                              border: "1px solid #ddd",
                              padding: "8px",
                              verticalAlign: "middle",
                            }}
                          >
                            #{m.id}
                          </td>

                          {/* Título editable */}
                          <td
                            style={{
                              display: "table-cell",
                              border: "1px solid #ddd",
                              padding: "8px",
                            }}
                          >
                            <input
                              style={{
                                width: "100%",
                                padding: "4px",
                              }}
                              value={edit.title ?? ""}
                              onChange={(e) =>
                                setEdit({
                                  ...edit,
                                  title: e.target.value,
                                })
                              }
                            />
                          </td>

                          {/* Estado editable */}
                          <td
                            style={{
                              display: "table-cell",
                              border: "1px solid #ddd",
                              padding: "8px",
                            }}
                          >
                            <select
                              style={{
                                width: "100%",
                                padding: "4px",
                              }}
                              value={edit.status ?? "PENDING"}
                              onChange={(e) =>
                                setEdit({
                                  ...edit,
                                  status: e.target
                                    .value as MissionStatus,
                                })
                              }
                            >
                              <option value="PENDING">PENDING</option>
                              <option value="IN_PROGRESS">
                                IN_PROGRESS
                              </option>
                              <option value="DONE">DONE</option>
                            </select>
                          </td>

                          {/* Alchemist editable */}
                          <td
                            style={{
                              display: "table-cell",
                              border: "1px solid #ddd",
                              padding: "8px",
                            }}
                          >
                            <select
                              style={{
                                width: "100%",
                                padding: "4px",
                              }}
                              value={edit.assignedAlchemistId ?? ""}
                              onChange={(e) =>
                                setEdit({
                                  ...edit,
                                  assignedAlchemistId: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                })
                              }
                            >
                              <option value="">Sin asignar</option>
                              {alchemists.map((a) => (
                                <option
                                  key={a.id}
                                  value={a.id}
                                >
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Descripción editable */}
                          <td
                            style={{
                              display: "table-cell",
                              border: "1px solid #ddd",
                              padding: "8px",
                            }}
                          >
                            <input
                              style={{
                                width: "100%",
                                padding: "4px",
                              }}
                              value={edit.description ?? ""}
                              onChange={(e) =>
                                setEdit({
                                  ...edit,
                                  description: e.target.value,
                                })
                              }
                            />
                          </td>

                          {/* Acciones */}
                          {isSupervisor && (
                            <td
                              style={{
                                display: "table-cell",
                                border: "1px solid #ddd",
                                padding: "8px",
                                textAlign: "right",
                              }}
                            >
                              <button
                                onClick={() => saveEdit(m.id)}
                                disabled={savingEdit}
                                style={{
                                  marginRight: "8px",
                                  padding: "4px 10px",
                                  backgroundColor: "#16a34a",
                                  color: "white",
                                  borderRadius: "4px",
                                  border: "none",
                                  fontSize: "12px",
                                  opacity: savingEdit ? 0.7 : 1,
                                }}
                              >
                                {savingEdit
                                  ? "Guardando..."
                                  : "Guardar"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={savingEdit}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: "4px",
                                  border: "1px solid #ccc",
                                  fontSize: "12px",
                                }}
                              >
                                Cancelar
                              </button>
                            </td>
                          )}
                        </tr>
                      ) : (
                        <tr
                          key={m.id}
                          style={{ display: "table-row" }}
                        >
                          <td
                            style={{
                              display: "table-cell",
                              border: "1px solid #ddd",
                              padding: "8px",
                              verticalAlign: "middle",
                            }}
                          >
                            #{m.id}
                          </td>
                          <td
                            style={{
                              display: "table-cell",
                              border: "1px solid #ddd",
                              padding: "8px",
                              verticalAlign: "middle",
                              fontWeight: 500,
                            }}
                          >
                            {m.title}
                          </td>
                          <td
                            style={{
                              display: "table-cell",
                              border: "1px solid #ddd",
                              padding: "8px",
                              verticalAlign: "middle",
                            }}
                          >
                            <span style={statusBadgeStyle(m.status)}>
                              {statusLabel(m.status)}
                            </span>
                          </td>
                          <td
                            style={{
                              display: "table-cell",
                              border: "1px solid #ddd",
                              padding: "8px",
                              verticalAlign: "middle",
                            }}
                          >
                            {m.assignedAlchemistName || "Sin asignar"}
                          </td>
                          <td
                            style={{
                              display: "table-cell",
                              border: "1px solid #ddd",
                              padding: "8px",
                              verticalAlign: "middle",
                            }}
                          >
                            {m.description || "—"}
                          </td>
                          {isSupervisor && (
                            <td
                              style={{
                                display: "table-cell",
                                border: "1px solid #ddd",
                                padding: "8px",
                                textAlign: "right",
                                verticalAlign: "middle",
                              }}
                            >
                              <button
                                onClick={() => startEdit(m)}
                                style={{
                                  marginRight: "8px",
                                  padding: "4px 10px",
                                  borderRadius: "4px",
                                  border: "1px solid #ccc",
                                  fontSize: "12px",
                                }}
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => remove(m.id)}
                                style={{
                                  padding: "4px 10px",
                                  backgroundColor: "#dc2626",
                                  color: "white",
                                  borderRadius: "4px",
                                  border: "none",
                                  fontSize: "12px",
                                }}
                                title="Eliminar misión"
                              >
                                Eliminar
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </AuthGate>
  );
}
