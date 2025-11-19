"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiGet, Token } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { useToast } from "@/context/ToastProvider";

type AlchemistRank =
  | "APPRENTICE"
  | "JOURNEYMAN"
  | "MASTER"
  | "STATE_ALCHEMIST"
  | "SENIOR_STATE_ALCHEMIST"
  | "CHIEF_ALCHEMIST";

type Alchemist = {
  id: number;
  name: string;
  rank: AlchemistRank;
  specialty?: string | null;
};

type CreateIn = {
  name: string;
  rank: AlchemistRank;
  specialty?: string;
};
type UpdateIn = Partial<CreateIn>;

const RANKS: AlchemistRank[] = [
  "APPRENTICE",
  "JOURNEYMAN",
  "MASTER",
  "STATE_ALCHEMIST",
  "SENIOR_STATE_ALCHEMIST",
  "CHIEF_ALCHEMIST",
];

const RANK_LABEL: Record<AlchemistRank, string> = {
  APPRENTICE: "Apprentice",
  JOURNEYMAN: "Journeyman",
  MASTER: "Master",
  STATE_ALCHEMIST: "State Alchemist",
  SENIOR_STATE_ALCHEMIST: "Senior State Alchemist",
  CHIEF_ALCHEMIST: "Chief Alchemist",
};

export default function AlchemistsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const isSupervisor = user?.role === "SUPERVISOR";

  const [items, setItems] = useState<Alchemist[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [form, setForm] = useState<CreateIn>({
    name: "",
    rank: "APPRENTICE",
    specialty: "",
  });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<UpdateIn>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const canCreate = useMemo(() => form.name.trim() !== "", [form.name]);

  // ——— Manejo central de 401 / token inválido
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

  async function load() {
    setLoading(true);
    setLoadErr(null);
    try {
      const list = await apiGet<Alchemist[]>("/api/alchemists");
      setItems(list || []);
    } catch (e: any) {
      if (handleAuthError(e)) return;
      setLoadErr(e.message || "Error cargando alchemists");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      setFormErr("El nombre es obligatorio.");
      return;
    }
    setFormErr(null);
    setSubmitting(true);
    try {
      const created = await apiFetch<Alchemist>("/api/alchemists", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          rank: form.rank,
          specialty: form.specialty?.trim() || undefined,
        }),
      });
      setItems((cur) => [created, ...cur]);
      setForm({ name: "", rank: "APPRENTICE", specialty: "" });
      success("Alchemist creado");
    } catch (e: any) {
      if (handleAuthError(e)) return;
      toastError(e.message || "No se pudo crear");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(a: Alchemist) {
    setEditingId(a.id);
    setEdit({
      name: a.name,
      rank: a.rank,
      specialty: a.specialty ?? "",
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setEdit({});
  }
  async function saveEdit(id: number) {
    setSavingEdit(true);
    try {
      const updated = await apiFetch<Alchemist>(`/api/alchemists/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: edit.name?.toString().trim(),
          rank: edit.rank,
          specialty: edit.specialty?.toString().trim(),
        }),
      });
      setItems((cur) => cur.map((x) => (x.id === id ? updated : x)));
      cancelEdit();
      success("Alchemist actualizado");
    } catch (e: any) {
      if (handleAuthError(e)) return;
      toastError(e.message || "No se pudo actualizar");
    } finally {
      setSavingEdit(false);
    }
  }
  async function remove(id: number) {
    if (!confirm("¿Eliminar alchemist?")) return;
    try {
      await apiFetch(`/api/alchemists/${id}`, { method: "DELETE" });
      setItems((cur) => cur.filter((x) => x.id !== id));
      success("Alchemist eliminado");
    } catch (e: any) {
      if (handleAuthError(e)) return;
      toastError(e.message || "No se pudo eliminar");
    }
  }

  return (
    <AuthGate>
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Alchemists</h1>

        {isSupervisor && (
          <form
            onSubmit={handleCreate}
            className="space-y-4 p-4 rounded-xl border bg-white shadow-sm mb-8"
          >
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Nombre *
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ej. Edward Elric"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
              {form.name.trim() === "" && (
                <p className="mt-1 text-xs text-red-600">
                  Requerido: nombre
                </p>
              )}
            </div>

            {/* Rango + Especialidad en 2 columnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Rango
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={form.rank}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rank: e.target.value as AlchemistRank,
                    })
                  }
                >
                  {RANKS.map((r) => (
                    <option key={r} value={r}>
                      {RANK_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Especialidad
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ej. Alquimia de metal"
                  value={form.specialty ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, specialty: e.target.value })
                  }
                />
              </div>
            </div>

            {formErr && (
              <p className="text-sm text-red-600">✖ {formErr}</p>
            )}

            {/* Botón en una fila aparte, alineado a la derecha */}
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

        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Alquimistas registrados</h2>

          {items.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No hay alquimistas registrados todavía.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  minWidth: "500px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "left",
                        backgroundColor: "#f5f5f5",
                      }}
                    >
                      ID
                    </th>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "left",
                        backgroundColor: "#f5f5f5",
                      }}
                    >
                      Nombre
                    </th>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "left",
                        backgroundColor: "#f5f5f5",
                      }}
                    >
                      Rango
                    </th>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "left",
                        backgroundColor: "#f5f5f5",
                      }}
                    >
                      Especialidad
                    </th>
                    {isSupervisor && (
                      <th
                        style={{
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "right",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {items.map((a) =>
                    editingId === a.id ? (
                      <tr key={a.id}>
                        {/* ID */}
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            verticalAlign: "middle",
                          }}
                        >
                          #{a.id}
                        </td>

                        {/* Nombre */}
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                          }}
                        >
                          <input
                            style={{ width: "100%", padding: "4px" }}
                            value={edit.name ?? ""}
                            onChange={(e) =>
                              setEdit({ ...edit, name: e.target.value })
                            }
                          />
                        </td>

                        {/* Rango */}
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                          }}
                        >
                          <select
                            style={{ width: "100%", padding: "4px" }}
                            value={edit.rank ?? "APPRENTICE"}
                            onChange={(e) =>
                              setEdit({
                                ...edit,
                                rank: e.target.value as AlchemistRank,
                              })
                            }
                          >
                            {RANKS.map((r) => (
                              <option key={r} value={r}>
                                {RANK_LABEL[r]}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Especialidad */}
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                          }}
                        >
                          <input
                            style={{ width: "100%", padding: "4px" }}
                            value={edit.specialty ?? ""}
                            onChange={(e) =>
                              setEdit({
                                ...edit,
                                specialty: e.target.value,
                              })
                            }
                          />
                        </td>

                        {/* Acciones (guardar / cancelar) */}
                        {isSupervisor && (
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: "8px",
                              textAlign: "right",
                            }}
                          >
                            <button
                              onClick={() => saveEdit(a.id)}
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
                              {savingEdit ? "Guardando..." : "Guardar"}
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
                      <tr key={a.id}>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            verticalAlign: "middle",
                          }}
                        >
                          #{a.id}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            verticalAlign: "middle",
                          }}
                        >
                          {a.name}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            verticalAlign: "middle",
                          }}
                        >
                          {RANK_LABEL[a.rank]}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            verticalAlign: "middle",
                          }}
                        >
                          {a.specialty || "—"}
                        </td>
                        {isSupervisor && (
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: "8px",
                              textAlign: "right",
                              verticalAlign: "middle",
                            }}
                          >
                            <button
                              onClick={() => startEdit(a)}
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
                              onClick={() => remove(a.id)}
                              style={{
                                padding: "4px 10px",
                                backgroundColor: "#dc2626",
                                color: "white",
                                borderRadius: "4px",
                                border: "none",
                                fontSize: "12px",
                              }}
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
      </main>
    </AuthGate>
  );
}
