// frontend/src/app/components/RealtimeBridge.tsx
"use client";

import { useEffect } from "react";
import { connectRealtime } from "@/lib/realtime";
import { useToast } from "@/context/ToastProvider";

type Props = {
  onTransmutationCreated?: (payload: any) => void;
  onTransmutationDeleted?: (payload: any) => void;
  verbose?: boolean;
};

export default function RealtimeBridge({
  onTransmutationCreated,
  onTransmutationDeleted,
  verbose,
}: Props) {
  const { success, info, error } = useToast();

  useEffect(() => {
    const disconnect = connectRealtime(
      (type, data) => {
        if (verbose && (type === "hello" || type === "ping")) {
          console.log("[SSE]", type, data);
        }

        try {
          if (type === "transmutation.created") {
            success(`🔮 Nueva transmutación: ${data?.title || "(sin título)"}`);
            onTransmutationCreated?.(data);
          }

          if (type === "transmutation.deleted") {
            info(`⚗️ Transmutación eliminada (ID ${data?.id ?? "?"})`);
            onTransmutationDeleted?.(data);
          }

          if (type === "transmutation.updated") {
            info(`✨ Transmutación actualizada: ${data?.title || ""}`);
            onTransmutationCreated?.(data);
          }
        } catch (e) {
          if (verbose) console.warn("[SSE] handler error", e);
          error?.("Ocurrió un problema mostrando el evento.");
        }
      },
      {
        onOpen: () => verbose && console.log("[SSE] conectado"),
        onClose: () => {
          // Puedes quitar este log si solo te genera ruido:
          if (verbose) console.log("[SSE] desconectado");
        },
        onError: (e) => {
          if (verbose) console.warn("[SSE] error", e);
        },
      }
    );

    return () => disconnect();
  }, [onTransmutationCreated, onTransmutationDeleted, verbose, success, info, error]);

  return null;
}

