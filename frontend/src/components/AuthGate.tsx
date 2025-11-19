"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Token } from "@/lib/api";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = Token.get();
    if (!t) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null; // o un loader
  return <>{children}</>;
}
