"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthProvider";

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

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      // Soporta /api y /api/v1; usamos /api/v1 por claridad.
      const res = await apiFetch<any>("/api/v1/materials", {
        token: token ?? undefined, // ✅ evita pasar null
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
        token: token ?? undefined, // ✅ evita pasar null
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
    <main className="wrapper">
      <h1>Materials</h1>

      <form onSubmit={onCreate} style={{ maxWidth: 760 }}>
        <input
          placeholder="Nombre *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div style={{ color: "#666", margin: "4px 0 12px" }}>
          Requerido: nombre
        </div>

        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />

        <input
          placeholder="Unidad *"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <div style={{ color: "#666", margin: "4px 0 12px" }}>
          Requerido: unidad
        </div>

        <input
          placeholder="Rareza"
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
        />

        <input
          placeholder="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button className="btn" disabled={!name.trim() || !unit.trim()}>
          Guardar
        </button>
      </form>

      {err && (
        <div style={{ color: "#b00020", marginTop: 12 }}>✖ {err}</div>
      )}

      {loading ? (
        <p style={{ marginTop: 16 }}>Cargando…</p>
      ) : (
        <ul style={{ marginTop: 16 }}>
          {items.map((m) => (
            <li key={m.id}>
              #{m.id} — <strong>{m.name}</strong> — {m.quantity} {m.unit}
              {m.rarity ? ` · ${m.rarity}` : ""} {m.notes ? ` · ${m.notes}` : ""}
            </li>
          ))}
          {items.length === 0 && <li>No hay materiales</li>}
        </ul>
      )}
    </main>
  );
}
