"use client";

import { usePathname } from "next/navigation";
import {
  Database,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { useFinance } from "@/components/finance-provider";
import {
  clearDeviceCredentials,
  getDeviceCredentials,
  saveDeviceCredentials,
} from "@/lib/device-auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    configured,
    session,
    loading,
    error,
    signInWithPassword,
  } = useFinance();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const autoLoginTriggeredRef = useRef(false);
  const normalizedPath = (pathname ?? "/").replace(/\/+$/, "") || "/";

  // Intentar auto-conexión y precargar credenciales si están guardadas en este dispositivo
  useEffect(() => {
    const saved = getDeviceCredentials();
    if (!saved) return;

    setEmail(saved.email);
    setPassword(saved.password);

    if (configured && !session && !loading && !autoLoginTriggeredRef.current) {
      autoLoginTriggeredRef.current = true;
      setIsAutoConnecting(true);
      setConnectionNotice(null);

      void signInWithPassword(saved.email, saved.password).finally(() => {
        setIsAutoConnecting(false);
      });
    }
  }, [configured, loading, session, signInWithPassword]);

  // Si ocurre un error de autenticación, decidir si se limpian las credenciales
  // o si es una pausa/fallo de red de Supabase
  useEffect(() => {
    if (!error) return;
    const lower = error.toLowerCase();
    if (lower.includes("no son correctos") || lower.includes("invalid login credentials")) {
      clearDeviceCredentials();
      setConnectionNotice(null);
    } else if (
      lower.includes("fetch") ||
      lower.includes("network") ||
      lower.includes("servidor") ||
      lower.includes("503") ||
      lower.includes("connection") ||
      lower.includes("error inesperado")
    ) {
      setConnectionNotice(
        "No se ha podido conectar con tu base de datos de Supabase. Si ha estado inactiva varios días, puede estar pausada. Comprueba tu panel de Supabase y pulsa 'Resume'."
      );
    }
  }, [error]);

  // Las instrucciones de instalación deben poder consultarse antes de iniciar
  // sesión, por ejemplo desde el mismo móvil que se quiere instalar.
  if (normalizedPath === "/instalar") return <>{children}</>;

  if (!configured) {
    return (
      <div className="auth-card">
        <div className="auth-icon"><Database size={24} /></div>
        <p className="eyebrow">Configuración pendiente</p>
        <h1>Conecta el proyecto de Supabase</h1>
        <p>
          Añade <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>. La aplicación ya
          está preparada para usar RLS y la clave pública segura.
        </p>
      </div>
    );
  }

  // Mientras se restaura una sesión existente o se realiza la auto-conexión,
  // se muestra el estado de carga para una experiencia fluida.
  if (loading || isAutoConnecting) {
    return (
      <div className="loading-state">
        <LoaderCircle className="spin" />
        <p>
          {session
            ? "Preparando tus datos…"
            : isAutoConnecting
            ? "Reconectando con tu libreta personal…"
            : "Comprobando tu sesión…"}
        </p>
      </div>
    );
  }

  if (!session) {
    async function submitPassword(event: FormEvent) {
      event.preventDefault();
      setConnectionNotice(null);
      const trimmedEmail = email.trim();
      const success = await signInWithPassword(trimmedEmail, password);
      if (success) {
        if (rememberDevice) {
          saveDeviceCredentials(trimmedEmail, password);
        } else {
          clearDeviceCredentials();
        }
      }
    }

    async function handleRetry() {
      setConnectionNotice(null);
      setIsAutoConnecting(true);
      await signInWithPassword(email.trim(), password);
      setIsAutoConnecting(false);
    }

    return (
      <div className="auth-card">
        <div className="auth-icon"><ShieldCheck size={24} /></div>
        <p className="eyebrow">Acceso personal</p>
        <h1>Entrar en Mis gastos</h1>
        <p>Accede a tu libreta privada con tu correo y tu clave.</p>
        <form onSubmit={submitPassword} className="auth-form">
          <label htmlFor="auth-login-email">Correo electrónico</label>
          <div className="input-with-icon">
            <Mail size={18} aria-hidden="true" />
            <input
              id="auth-login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com"
              required
              autoComplete="email"
              autoFocus={!email}
            />
          </div>
          <label htmlFor="auth-login-password">Clave</label>
          <div className="input-with-icon">
            <KeyRound size={18} aria-hidden="true" />
            <input
              id="auth-login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu clave privada"
              required
              minLength={10}
              autoComplete="current-password"
              autoFocus={Boolean(email && !password)}
            />
          </div>

          <label className="auth-remember-row" htmlFor="auth-remember-device">
            <input
              id="auth-remember-device"
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
            />
            <span>Recordar acceso en este dispositivo</span>
          </label>

          <button className="button primary" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={18} /> : null}
            Entrar
          </button>
        </form>

        <AppLink href="/instalar" className="auth-install-link">
          <Smartphone size={17} aria-hidden="true" /> Cómo instalar la app en el móvil
        </AppLink>
        <div className="auth-feedback" aria-live="polite">
          {connectionNotice ? (
            <div className="notice error" role="alert">
              <p>{connectionNotice}</p>
              <button
                type="button"
                className="button small"
                style={{ marginTop: 10, width: "100%" }}
                onClick={() => void handleRetry()}
              >
                Reintentar conexión
              </button>
            </div>
          ) : error ? (
            <p className="notice error" role="alert">{error}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
