"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";

export default function Navbar() {
  const { user, logout } = useAuth();
  const isSupervisor = user?.role === "SUPERVISOR";

  return (
    <header className="border-b bg-white/70 backdrop-blur">
      <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="font-semibold tracking-wide">
            Amestris
          </Link>
          <Link href="/alchemists" className="hover:underline">
            Alchemists
          </Link>
          <Link href="/missions" className="hover:underline">
            Missions
          </Link>
          <Link href="/materials" className="hover:underline">
            Materials
          </Link>
          <Link href="/transmutations" className="hover:underline">
            Transmutations
          </Link>

          {/* Audits solo visible para SUPERVISOR */}
          {isSupervisor && (
            <Link href="/audits" className="hover:underline">
              Audits
            </Link>
          )}

          <Link href="/docs" className="hover:underline">
            Docs
          </Link>

          {isSupervisor && (
            <span className="ml-2 rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-200">
              SUPERVISOR
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-neutral-600">
                <strong>{user.name}</strong>{" "}
                <span className="text-neutral-400">({user.role})</span>
              </span>
              <button
                onClick={logout}
                className="rounded border px-3 py-1 hover:bg-neutral-50"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <Link
              href="/"
              className="rounded bg-indigo-600 text-white px-3 py-1 hover:bg-indigo-700"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
