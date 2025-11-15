"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthProvider";
import AuthGate from "@/components/AuthGate";

type Material = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  rarity?: string | null;
  notes?: string | null;
};

type Paged<T> = { items: T[]; page?: number; pageSize?: number; total?: number };

function normalizeList<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && Array.isArray((res as Paged<T>).items)) return (res as Paged<T>).items;
  return [];
}

// 🎨 Estilos según rareza
function rarityCellStyle(rarity?: string | null) {
  const base: any = {
    display: "table-cell",
    border: "1px solid #ddd",
    padding: "8px",
    verticalAlign: "middle",
  };

  if (!rarity) return base;

  const r = rarity.toUpperCase();

  if (r === "COMMON") {
    return {
      ...base,
      backgroundColor: "#f5f5f5",
      color: "#444",
    };
  }

  if (r === "RARE") {
    return {
      ...base,
      backgroundColor: "#dcfce7",
      color: "#166534",
      fontWeight: 600,
    };
  }

  if (r === "LEGENDARY") {
    return {
      ...base,
      backgroundColor: "#fef3c7",
      color: "#92400e",
      fontWeight: 600,
    };
  }

  // cualquier otra rareza
  return {
    ...base,
    backgroundColor: "#e0f2fe",
    color: "#075985",
  };
}

export default function MaterialsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [unit, setUnit] = useState("");
  const [rarity, setRarity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const canSave = name.trim() !== "" && unit.trim() !== "";

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const res = await apiFetch<any>("/api/v1/materials", {
        token: token ?? undefined,
      });
      setItems(normalizeList<Material>(res));
    } catch (e: any) {
      setErr(e?.message || "Error cargando materiales");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setErr(null);
      await apiFetch("/api/v1/materials", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          name: name.trim(),
          quantity: Number(quantity) || 0,
          unit: unit.trim(),
          rarity: rarity ? rarity : null,
          notes: notes ? notes : null,
        }),
      });
      // limpiar y recargar
      setName("");
      setQuantity(0);
      setUnit("");
      setRarity("");
      setNotes("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "No se pudo crear el material");
    }
  }

  return (
    <AuthGate>
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Materials</h1>

        {/* FORMULARIO */}
        <form
          onSubmit={onCreate}
          className="space-y-4 p-4 rounded-xl border bg-white shadow-sm mb-8"
        >
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Nombre *
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Ej. Hierro en lingotes"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {name.trim() === "" && (
              <p className="mt-1 text-xs text-red-600">
                Requerido: nombre
              </p>
            )}
          </div>

          {/* Cantidad + Unidad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Cantidad
              </label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Unidad *
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ej. kg, L, unidades"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
              {unit.trim() === "" && (
                <p className="mt-1 text-xs text-red-600">
                  Requerido: unidad
                </p>
              )}
            </div>
          </div>

          {/* Rareza + Notas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Rareza
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ej. COMMON, RARE"
                value={rarity}
                onChange={(e) => setRarity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Notas
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ej. Resguardar en contenedor sellado"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSave}
            >
              Guardar
            </button>
          </div>
        </form>

        {/* ERRORES / CARGA */}
        {err && (
          <div className="text-sm text-red-600 mb-3">✖ {err}</div>
        )}
        {loading && <p className="text-sm mt-2">Cargando…</p>}

        {/* TABLA DE MATERIALES */}
        {!loading && (
          <section className="mt-4">
            <h2 className="text-lg font-semibold mb-3">
              Materiales registrados
            </h2>

            {items.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No hay materiales registrados.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    minWidth: "650px",
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
                        Nombre
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
                        Cantidad
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
                        Unidad
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
                        Rareza
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
                        Notas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
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
                          }}
                        >
                          {m.name}
                        </td>
                        <td
                          style={{
                            display: "table-cell",
                            border: "1px solid #ddd",
                            padding: "8px",
                            verticalAlign: "middle",
                          }}
                        >
                          {m.quantity}
                        </td>
                        <td
                          style={{
                            display: "table-cell",
                            border: "1px solid #ddd",
                            padding: "8px",
                            verticalAlign: "middle",
                          }}
                        >
                          {m.unit}
                        </td>
                        <td style={rarityCellStyle(m.rarity)}>
                          {m.rarity || "—"}
                        </td>
                        <td
                          style={{
                            display: "table-cell",
                            border: "1px solid #ddd",
                            padding: "8px",
                            verticalAlign: "middle",
                          }}
                        >
                          {m.notes || "—"}
                        </td>
                      </tr>
                    ))}
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
