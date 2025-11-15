// frontend/src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthAPI, Token } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("roy@amestris.gov");
  const [password, setPassword] = useState("roy123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await AuthAPI.login(email, password);
      Token.set(token);                // ✅ guarda token (sessionStorage)
      router.replace("/");             // o donde quieras
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: "48px auto" }}>
      <h1>Iniciar sesión</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Contraseña" />
        <button disabled={loading}>{loading ? "Ingresando..." : "Entrar"}</button>
        {error && <p style={{ color: "crimson" }}>✖ {error}</p>}
      </form>
    </main>
  );
}
