// frontend/src/app/alchemists/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiGet, Token } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { useToast } from "@/context/ToastProvider";

type Alchemist = {
  id: number;
  name: string;
  rank: "APPRENTICE" | "JOURNEYMAN" | "MASTER";
  specialty?: string | null;
};

type CreateIn = {
  name: string;
  rank: Alchemist["rank"];
  specialty?: string;
};
type UpdateIn = Partial<CreateIn>;

const RANKS: Alchemist["rank"][] = ["APPRENTICE", "JOURNEYMAN", "MASTER"];

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
      // usa /api/* (protegido); api.ts añade Bearer
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Alchemists</h1>

        {isSupervisor && (
          <form onSubmit={handleCreate} className="grid grid-cols-6 gap-2 p-3 rounded border mb-6">
            <input
              className="col-span-3 border rounded px-2 py-1"
              placeholder="Nombre *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {form.name.trim() === "" && (
              <p className="col-span-6 text-xs text-red-600">Requerido: nombre</p>
            )}

            <select
              className="col-span-2 border rounded px-2 py-1"
              value={form.rank}
              onChange={(e) => setForm({ ...form, rank: e.target.value as Alchemist["rank"] })}
            >
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </option>
              ))}
            </select>

            <input
              className="col-span-6 border rounded px-2 py-1"
              placeholder="Especialidad"
              value={form.specialty ?? ""}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
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
          {items.map((a) => (
            <li key={a.id} className="p-3 border rounded">
              {editingId === a.id ? (
                <div className="grid grid-cols-6 gap-2">
                  <input
                    className="col-span-3 border rounded px-2 py-1"
                    value={edit.name ?? ""}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                  <select
                    className="col-span-2 border rounded px-2 py-1"
                    value={edit.rank ?? "APPRENTICE"}
                    onChange={(e) => setEdit({ ...edit, rank: e.target.value as Alchemist["rank"] })}
                  >
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <input
                    className="col-span-6 border rounded px-2 py-1"
                    value={edit.specialty ?? ""}
                    onChange={(e) => setEdit({ ...edit, specialty: e.target.value })}
                  />

                  {isSupervisor && (
                    <div className="col-span-6 flex gap-2">
                      <button
                        onClick={() => saveEdit(a.id)}
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
                      #{a.id} — <strong>{a.name}</strong>{" "}
                      <span className="text-sm text-neutral-500">({a.rank})</span>
                    </div>
                    <div className="text-sm text-neutral-600">{a.specialty ?? ""}</div>
                  </div>
                  {isSupervisor && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(a)} className="border rounded px-3 py-1">
                        Editar
                      </button>
                      <button onClick={() => remove(a.id)} className="bg-red-600 text-white rounded px-3 py-1">
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
