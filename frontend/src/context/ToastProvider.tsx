"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "info";
export type ToastItem = { id: string; kind: ToastKind; message: string };

type ToastCtx = {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  remove: (id: string) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Math.random().toString(36).slice(2);
    const item = { id, kind, message };
    setToasts((cur) => [item, ...cur]);
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  const value = useMemo(
    () => ({
      toasts,
      push,
      remove,
      success: (m: string) => push("success", m),
      error:   (m: string) => push("error", m),
      info:    (m: string) => push("info", m),
    }),
    [toasts, push, remove]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
