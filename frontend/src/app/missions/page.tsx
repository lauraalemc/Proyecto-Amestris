"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiGet, Token } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { useToast } from "@/context/ToastProvider";

type Mission = {
  id: number;
  title: string;
  description?: string | null;
  assignedAlchemistId?: number | null;
  assignedAlchemistName?: string | null;
  status: string; // PENDING | IN_PROGRESS | DONE
};

type CreateIn = {
  title: string;
  description?: string;
  assignedAlchemistId?: number | null;
  status?: string;
};
type UpdateIn = Partial<CreateIn>;
type AlchemistOpt = { id: number; name: string };

/** Permite usar tanto Mission[] como {items: Mission[]} */
function normalizeList<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && Array.isArray(res.items)) return res.items as T[];
  return [];
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
    if (msg.includes("unauthorized") || msg.includes("no autentic") || msg.includes("token")) {
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
      // api.ts añade el Bearer automáticamente
      const [missions, alchs] = await Promise.all([
        apiGet<any>("/api/missions"),
        apiGet<any[]>("/api/alchemists"),
      ]);
      setItems(normalizeList<Mission>(missions));
      setAlchemists((alchs || []).map((a: any) => ({ id: a.id, name: a.name })));
    } catch (e: any) {
      if (handleAuthError(e)) return;
      setLoadErr(e.message || "Error cargando misiones");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          status: form.status || "PENDING",
        }),
      });
      // prepend
      setItems((cur) => [created, ...cur]);
      setForm({ title: "", description: "", assignedAlchemistId: null, status: "PENDING" });
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
          status: edit.status,
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
      // backend puede devolver 200 {status:"deleted"} o 204 sin body; apiFetch ya maneja 204.
      await apiFetch(`/api/missions/${id}`, { method: "DELETE" });
      setItems((cur) => cur.filter((x) => x.id !== id)); // optimista
      success("Misión eliminada");
    } catch (e: any) {
      if (handleAuthError(e)) return;
      toastError(e.message || "No se pudo eliminar");
    }
  }

  return (
    <AuthGate>
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Missions</h1>

        {isSupervisor && (
          <form onSubmit={handleCreate} className="grid grid-cols-6 gap-2 p-3 rounded border mb-6">
            <input
              className="col-span-3 border rounded px-2 py-1"
              placeholder="Título *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            {form.title.trim() === "" && (
              <p className="col-span-6 text-xs text-red-600">Requerido: título</p>
            )}

            <select
              className="col-span-2 border rounded px-2 py-1"
              value={form.assignedAlchemistId ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  assignedAlchemistId: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">(Opcional) Alchemist</option>
              {alchemists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            <select
              className="col-span-1 border rounded px-2 py-1"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="PENDING">PENDING</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="DONE">DONE</option>
            </select>

            <input
              className="col-span-6 border rounded px-2 py-1"
              placeholder="Descripción"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            {formErr && <p className="col-span-6 text-sm text-red-600">✖ {formErr}</p>}
            <button
              disabled={!canCreate || submitting}
              className="col-span-2 bg-indigo-600 text-white rounded py-1 disabled:opacity-50"
            >
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </form>
        )}

        {loading && <p>Cargando...</p>}
        {loadErr && <p className="text-red-500">✖ {loadErr}</p>}

        <ul className="space-y-3">
          {items.map((m) => (
            <li key={m.id} className="p-3 border rounded">
              {editingId === m.id ? (
                <div className="grid grid-cols-6 gap-2">
                  <input
                    className="col-span-3 border rounded px-2 py-1"
                    value={edit.title ?? ""}
                    onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  />
                  <select
                    className="col-span-2 border rounded px-2 py-1"
                    value={edit.assignedAlchemistId ?? ""}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        assignedAlchemistId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">(Opcional) Alchemist</option>
                    {alchemists.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="col-span-1 border rounded px-2 py-1"
                    value={edit.status ?? "PENDING"}
                    onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="DONE">DONE</option>
                  </select>

                  <input
                    className="col-span-6 border rounded px-2 py-1"
                    value={edit.description ?? ""}
                    onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  />

                  {isSupervisor && (
                    <div className="col-span-6 flex gap-2">
                      <button
                        onClick={() => saveEdit(m.id)}
                        className="bg-green-600 text-white rounded px-3 py-1 disabled:opacity-50"
                        disabled={savingEdit}
                      >
                        {savingEdit ? "Guardando..." : "Guardar"}
                      </button>
                      <button onClick={cancelEdit} className="border rounded px-3 py-1" disabled={savingEdit}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">
                      #{m.id} — <strong>{m.title}</strong>{" "}
                      <span className="text-sm text-neutral-500">({m.status})</span>
                    </div>
                    <div className="text-sm text-neutral-600">
                      {m.assignedAlchemistName ? `Asignada a ${m.assignedAlchemistName} · ` : ""}
                      {m.description ?? ""}
                    </div>
                  </div>
                  {isSupervisor && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(m)} className="border rounded px-3 py-1">
                        Editar
                      </button>
                      <button
                        onClick={() => remove(m.id)}
                        className="bg-red-600 text-white rounded px-3 py-1"
                        title="Eliminar misión"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </main>
    </AuthGate>
  );
}
