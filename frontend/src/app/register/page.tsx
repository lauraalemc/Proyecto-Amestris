"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthAPI } from "@/lib/api";
import { useToast } from "@/context/ToastProvider";
import { useAuth } from "@/context/AuthProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const { login } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"SUPERVISOR" | "ALCHEMIST">("ALCHEMIST");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      error("Todos los campos son obligatorios.");
      return;
    }

    setLoading(true);
    try {
      await AuthAPI.register(name.trim(), email.trim(), password, role);
      success("Usuario registrado. Iniciando sesión…");

      // Tras registrar, se inicia sesión con las mismas credenciales
      await login(email.trim(), password);
      router.replace("/");
    } catch (err: any) {
      error(err.message || "No se pudo registrar el usuario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <h1>Registro</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Nombre
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label>
          Correo electrónico
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <label>
          Rol
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
          >
            <option value="ALCHEMIST">Alchemist</option>
            <option value="SUPERVISOR">Supervisor</option>
          </select>
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Registrando..." : "Registrarse"}
        </button>
      </form>
    </main>
  );
}
