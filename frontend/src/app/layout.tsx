"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/AuthProvider";
import { ToastProvider } from "@/context/ToastProvider";
import Toaster from "@/components/Toaster";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

function Gate({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth();
  if (!ready) return <div className="wrapper">Cargando…</div>;
  return <>{children}</>;
}

function TopBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const isActive = (href: string) => (pathname === href ? "active" : "");

  const isSupervisor = user?.role === "SUPERVISOR";

  return (
    <div className="topbar">
      <div className="row">
        <div className="brand">Amestris</div>

        <nav className="nav">
          <Link href="/" className={isActive("/")}>
            Inicio
          </Link>

          {user && (
            <>
              {isSupervisor && (
                <>
                  <Link href="/alchemists" className={isActive("/alchemists")}>
                    Alchemists
                  </Link>
                  <Link href="/materials" className={isActive("/materials")}>
                    Materials
                  </Link>
                  <Link href="/audits" className={isActive("/audits")}>
                    Auditorías
                  </Link>
                </>
              )}
              <Link href="/missions" className={isActive("/missions")}>
                Missions
              </Link>
              <Link href="/transmutations" className={isActive("/transmutations")}>
                Transmutations
              </Link>
            </>
          )}

          <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">
            Docs
          </a>
        </nav>

        <div className="spacer" />

        <div className="userbox">
          {user ? (
            <>
              <span style={{ marginRight: 8 }}>
                {user.name} <strong>({user.role})</strong>
              </span>
              <button
                className="btn"
                onClick={() => {
                  logout();
                  router.replace("/");
                }}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <span className="muted">No autenticado</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ToastProvider>
          <AuthProvider>
            <Gate>
              <TopBar />
              <main className="wrapper">{children}</main>
              <Toaster />
            </Gate>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
