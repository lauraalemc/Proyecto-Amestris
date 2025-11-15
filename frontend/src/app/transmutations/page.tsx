"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { useAuth } from "@/context/AuthProvider";
import { useToast } from "@/context/ToastProvider";
import { apiGet, apiFetch, Token } from "@/lib/api";
import RealtimeBridge from "@/components/RealtimeBridge";

type Transmutation = {
  id: number;
  title: string;
  materialId: number;
  materialName?: string;
  missionId?: number | null;
  missionTitle?: string;
  quantityUsed: number;
  result?: string | null;
  createdAt: string;
};

type MaterialOpt = { id: number; name: string };
type MissionOpt = { id: number; title: string };

type ListResponse = {
  items?: Transmutation[];
  page?: number;
  pageSize?: number;
  total?: number;
};

export default function TransmutationsPage() {
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();

  const [items, setItems] = useState<Transmutation[]>([]);
  const [materials, setMaterials] = useState<MaterialOpt[]>([]);
  const [missions, setMissions] = useState<MissionOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Formulario de creación
  const [title, setTitle] = useState("");
  const [materialId, setMaterialId] = useState<number | "">("");
  const [missionId, setMissionId] = useState<number | "">("");
  const [quantityUsed, setQuantityUsed] = useState<number>(1);
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canCreate = useMemo(
    () =>
      title.trim() !== "" &&
      typeof materialId === "number" &&
      materialId > 0 &&
      quantityUsed > 0,
    [title, materialId, quantityUsed]
  );

  function handleAuthError(e: any) {
    const msg = String(e?.message || "").toLowerCase();
    if (msg.includes("unauthorized") || msg.includes("no autentic") || msg.includes("token")) {
      Token.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return true;
    }
    return false;
  }

  // Carga inicial (con defensas para evitar .map sobre algo que no sea array)
  async function load() {
    setLoading(true);
    setLoadErr(null);
    try {
      // Lista de transmutaciones (paginada)
      const listRes = await apiGet<ListResponse>("/api/transmutations?page=1&pageSize=20");
      const safeItems = Array.isArray(listRes?.items) ? listRes.items : [];
      setItems(safeItems);

      // Materials: tu endpoint devuelve un array simple
      const mats = await apiGet<any>("/api/materials");
      const safeMats: any[] = Array.isArray(mats) ? mats : [];
      setMaterials(safeMats.map((m) => ({ id: m.id, name: m.name })));

      // Missions: también array simple
      const miss = await apiGet<any>("/api/missions");
      const safeMiss: any[] = Array.isArray(miss) ? miss : [];
      setMissions(safeMiss.map((mi) => ({ id: mi.id, title: mi.title })));
    } catch (e: any) {
      if (handleAuthError(e)) return;
      setLoadErr(e.message || "Error cargando transmutations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Crear transmutación
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;

    setSubmitting(true);
    try {
      const created = await apiFetch<Transmutation>("/api/transmutations", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          materialId: materialId as number,
          missionId: missionId ? (missionId as number) : undefined,
          quantityUsed,
          result: result.trim() || undefined,
        }),
      });

      setItems((cur) => {
        const exists = cur.some((t) => t.id === created.id);
        if (exists) return cur;
        return [created, ...cur];
      });

      setTitle("");
      setMaterialId("");
      setMissionId("");
      setQuantityUsed(1);
      setResult("");
      success("Transmutación creada");
    } catch (e: any) {
      if (handleAuthError(e)) return;
      toastError(e.message || "No se pudo crear la transmutación");
    } finally {
      setSubmitting(false);
    }
  }

  // Eliminar transmutación manualmente
  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar transmutación? Esto restaurará el stock del material.")) return;
    try {
      await apiFetch(`/api/transmutations/${id}`, { method: "DELETE" });
      setItems((cur) => cur.filter((t) => t.id !== id));
      success("Transmutación eliminada");
    } catch (e: any) {
      if (handleAuthError(e)) return;
      toastError(e.message || "No se pudo eliminar");
    }
  }

  // ==== Handlers SSE para TODAS las pestañas ====
  const onTransmutationCreated = useCallback(
    (payload: any) => {
      if (!payload || !payload.id) return;
      setItems((cur) => {
        const exists = cur.some((t) => t.id === payload.id);
        if (exists) {
          return cur.map((t) => (t.id === payload.id ? { ...t, ...payload } : t));
        }
        return [payload as Transmutation, ...cur];
      });
      if (user?.role === "SUPERVISOR") {
        info(`🔮 [SSE] Nueva transmutación #${payload.id}: ${payload.title || ""}`);
      }
    },
    [info, user?.role]
  );

  const onTransmutationDeleted = useCallback(
    (payload: any) => {
      const id = payload?.id;
      if (!id) return;
      setItems((cur) => cur.filter((t) => t.id !== id));
      if (user?.role === "SUPERVISOR") {
        info(`⚗️ [SSE] Transmutación eliminada (ID ${id})`);
      }
    },
    [info, user?.role]
  );

  return (
    <AuthGate>
      <RealtimeBridge
        verbose
        onTransmutationCreated={onTransmutationCreated}
        onTransmutationDeleted={onTransmutationDeleted}
      />

      <main className="max-w-4xl mx-auto p-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Transmutations</h1>
            <p className="text-sm text-neutral-500">
              Registro de transmutaciones y consumo de materiales en tiempo real.
            </p>
          </div>
          {user && (
            <span className="text-xs rounded bg-neutral-100 px-2 py-1 text-neutral-600">
              Sesión: <strong>{user.name}</strong> ({user.role})
            </span>
          )}
        </header>

        {/* Formulario */}
        <section className="mb-8 border rounded-lg p-4 bg-white shadow-sm">
          <h2 className="font-semibold mb-3 text-sm text-neutral-800">
            Nueva transmutación
          </h2>
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-6 gap-3 text-sm items-center"
          >
            <input
              className="col-span-3 border rounded px-2 py-1"
              placeholder="Título *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <select
              className="col-span-2 border rounded px-2 py-1"
              value={materialId}
              onChange={(e) =>
                setMaterialId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Material *</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={0.1}
              step={0.1}
              className="col-span-1 border rounded px-2 py-1"
              value={quantityUsed}
              onChange={(e) => setQuantityUsed(Number(e.target.value) || 0)}
            />

            <select
              className="col-span-3 border rounded px-2 py-1"
              value={missionId}
              onChange={(e) =>
                setMissionId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">(Opcional) Misión</option>
              {missions.map((mi) => (
                <option key={mi.id} value={mi.id}>
                  {mi.title}
                </option>
              ))}
            </select>

            <input
              className="col-span-3 border rounded px-2 py-1"
              placeholder="Resultado (opcional)"
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />

            <button
              disabled={!canCreate || submitting}
              className="col-span-2 bg-indigo-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
            >
              {submitting ? "Creando..." : "Crear transmutación"}
            </button>
          </form>
          {!canCreate && (
            <p className="mt-2 text-xs text-red-500">
              El título, el material y la cantidad deben estar completos.
            </p>
          )}
        </section>

        {/* Lista */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm text-neutral-800">
              Últimas transmutaciones
            </h2>
            {loading && (
              <span className="text-xs text-neutral-500">Cargando…</span>
            )}
            {loadErr && (
              <span className="text-xs text-red-600">✖ {loadErr}</span>
            )}
          </div>

          <ul className="space-y-2">
            {items.map((t) => (
              <li
                key={t.id}
                className="border rounded-md px-3 py-2 text-sm bg-white flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">
                    #{t.id} — {t.title}{" "}
                    <span className="text-xs text-neutral-500">
                      ({t.createdAt})
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600">
                    Material:{" "}
                    <strong>{t.materialName || `#${t.materialId}`}</strong> ·
                    Cantidad usada: {t.quantityUsed}
                    {t.missionTitle && (
                      <>
                        {" "}
                        · Misión: <em>{t.missionTitle}</em>
                      </>
                    )}
                    {t.result && (
                      <>
                        {" "}
                        · Resultado: <span>{t.result}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="bg-red-600 text-white rounded px-3 py-1 text-xs"
                >
                  Eliminar
                </button>
              </li>
            ))}
            {items.length === 0 && !loading && (
              <li className="text-xs text-neutral-500">
                No hay transmutaciones registradas aún.
              </li>
            )}
          </ul>
        </section>
      </main>
    </AuthGate>
  );
}
