import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ nuevo: confirmar contraseña
  const [confirmPassword, setConfirmPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function switchMode(nextMode) {
    setMode(nextMode);

    // ✅ limpia todo al cambiar de tab (para que no se “herede” el email)
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setMsg("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/events");
        return;
      }

      // register
      if (password.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres");
      }
      if (password !== confirmPassword) {
        throw new Error("Las contraseñas no coinciden");
      }

      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      setMsg("✅ Cuenta creada. Revisá tu email.");
      // vuelve a login y limpia campos
      setTimeout(() => switchMode("login"), 2000);
    } catch (err) {
      setMsg(err?.message ?? "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-gradient-orbs">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>
      </div>

      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">ListaExpress</h1>
          <p className="login-subtitle">Gestión simple de invitados para fiestas</p>
        </div>

        <div className="login-card">
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === "login" ? "login-tab-active" : ""}`}
              onClick={() => switchMode("login")}
              type="button"
              disabled={busy}
            >
              Iniciar sesión
            </button>

            <button
              className={`login-tab ${mode === "register" ? "login-tab-active" : ""}`}
              onClick={() => switchMode("register")}
              type="button"
              disabled={busy}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={onSubmit} className="login-form">
            <div className="login-field">
              <label className="login-label">📧 Email</label>
              <input
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="tu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="login-field">
              <label className="login-label">🔒 Contraseña</label>
              <input
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {/* ✅ nuevo: confirmar contraseña solo en register */}
            {mode === "register" && (
              <div className="login-field">
                <label className="login-label">🔒 Confirmar contraseña</label>
                <input
                  className="login-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="Repetí la contraseña"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            )}

            {msg && (
              <div
                className={`login-message ${
                  msg.includes("✅") ? "login-message-success" : "login-message-error"
                }`}
              >
                {msg}
              </div>
            )}

            <button disabled={busy} className="login-button" type="submit">
              {busy ? "⏳ Procesando..." : mode === "login" ? "🚀 Entrar" : "✨ Crear cuenta"}
            </button>

            <div className="login-info">
              💡 Solo los organizadores necesitan cuenta.<br />
              El personal de seguridad usa código + PIN.
            </div>
          </form>
        </div>

        <div className="login-footer">¿Problemas para ingresar? Contactá al administrador</div>
      </div>
    </div>
  );
}
