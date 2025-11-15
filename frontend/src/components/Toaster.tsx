"use client";

import { useToast } from "@/context/ToastProvider";

export default function Toaster() {
  const { toasts, remove } = useToast();

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2"
      style={{ pointerEvents: "none" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="min-w-[260px] max-w-[420px] rounded border shadow px-3 py-2 bg-white/95 backdrop-blur"
          style={{ pointerEvents: "auto" }}
        >
          <div className="flex items-start gap-2">
            <span className={
              t.kind === "success" ? "text-green-600" :
              t.kind === "error"   ? "text-red-600"   :
                                     "text-blue-600"
            }>
              {t.kind === "success" ? "✔" : t.kind === "error" ? "✖" : "ℹ"}
            </span>
            <div className="text-sm text-neutral-800 flex-1">{t.message}</div>
            <button
              onClick={() => remove(t.id)}
              className="text-neutral-400 hover:text-neutral-700"
              aria-label="Cerrar"
              title="Cerrar"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
