"use client";
import { useAuth } from "../context/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  children: React.ReactNode;
  roles?: string[]; // p.ej. ["SUPERVISOR"] o ["ALCHEMIST","SUPERVISOR"]
};

export default function RequireAuth({ children, roles }: Props) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/"); // login
      return;
    }
    if (roles && roles.length > 0) {
      const ok = roles.map((r) => r.toUpperCase()).includes(user.role.toUpperCase());
      if (!ok) router.replace("/"); // sin permiso
    }
  }, [ready, user, roles, router]);

  if (!ready) return null;
  return <>{children}</>;
}
