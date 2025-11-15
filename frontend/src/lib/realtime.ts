// frontend/src/lib/realtime.ts
type RealtimeHandlers = {
  onEvent: (type: string, data: any) => void;
  onOpen?: () => void;
  onError?: (e: any) => void;
  onClose?: () => void;
};

function buildSSEUrl(): string {
  const base =
    (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "");
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || sessionStorage.getItem("token")
      : null;

  const url = `${base}/api/realtime/sse`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

export function connectRealtime(
  onEvent: RealtimeHandlers["onEvent"],
  { onOpen, onError, onClose }: Omit<RealtimeHandlers, "onEvent"> = {}
): () => void {
  const url = buildSSEUrl();

  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    console.log("[SSE] connecting to", url);
  }

  const es = new EventSource(url);

  es.onopen = () => {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      console.log("[SSE] onopen");
    }
    onOpen?.();
  };

  es.onerror = (e) => {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      console.warn("[SSE] onerror", e);
    }
    onError?.(e);
    // EventSource vuelve a intentar automáticamente
  };

  es.onmessage = (ev) => {
    let data: any = null;
    try {
      data = ev.data ? JSON.parse(ev.data) : null;
    } catch {
      data = ev.data ?? null;
    }
    onEvent("message", data);
  };

  const makeNamedHandler = (eventName: string) => (ev: MessageEvent) => {
    let data: any = null;
    try {
      data = ev.data ? JSON.parse(ev.data) : null;
    } catch {
      data = ev.data ?? null;
    }
    onEvent(eventName, data);
  };

  const helloHandler = makeNamedHandler("hello");
  const pingHandler = makeNamedHandler("ping");
  const createdHandler = makeNamedHandler("transmutation.created");
  const deletedHandler = makeNamedHandler("transmutation.deleted");

  (es as any).addEventListener("hello", helloHandler);
  (es as any).addEventListener("ping", pingHandler);
  (es as any).addEventListener("transmutation.created", createdHandler);
  (es as any).addEventListener("transmutation.deleted", deletedHandler);

  const disconnect = () => {
    try {
      (es as any).removeEventListener("hello", helloHandler);
      (es as any).removeEventListener("ping", pingHandler);
      (es as any).removeEventListener("transmutation.created", createdHandler);
      (es as any).removeEventListener("transmutation.deleted", deletedHandler);
    } catch {
      /* ignore */
    }
    es.close();
    onClose?.();
  };

  return disconnect;
}
