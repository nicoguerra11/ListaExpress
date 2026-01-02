import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./EventDetailPage.css";

function onlyDigits(s) {
  return (s ?? "").replace(/\D/g, "");
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = lines.some((l) => l.includes(";")) ? ";" : ",";
  const rows = lines.map((l) => l.split(delimiter).map((x) => x.trim()));

  const header = rows[0].map((h) => h.toLowerCase());
  const hasHeader =
    header.includes("nombre") ||
    header.includes("name") ||
    header.includes("apellido") ||
    header.includes("ci") ||
    header.includes("cedula");

  const dataRows = hasHeader ? rows.slice(1) : rows;

  const out = [];
  for (const r of dataRows) {
    const first_name = r[0] ?? "";
    const last_name = r[1] ?? "";
    const ci = onlyDigits(r[2] ?? "");
    if (!first_name || !last_name || !ci) continue;
    out.push({ first_name, last_name, ci });
  }
  return out;
}

function ConfirmDeleteModal({ open, guest, onCancel, onConfirm, busy }) {
  if (!open) return null;

  return (
    <div className="detail-modal-overlay" onClick={() => !busy && onCancel()}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-modal-header">
          <div>
            <h3>⚠️ Confirmar eliminación</h3>
            <p>Esta acción no se puede deshacer</p>
          </div>
          <button
            className="detail-modal-close"
            onClick={() => !busy && onCancel()}
            type="button"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="detail-modal-guest-info">
          <div className="detail-modal-guest-name">
            {guest?.first_name} {guest?.last_name}
          </div>
          <div className="detail-modal-guest-ci">
            CI: <span>{guest?.ci}</span>
          </div>
        </div>

        <div className="detail-modal-actions">
          <button
            className="detail-modal-btn detail-modal-btn-cancel"
            onClick={onCancel}
            disabled={busy}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="detail-modal-btn detail-modal-btn-confirm"
            onClick={onConfirm}
            disabled={busy}
            type="button"
          >
            {busy ? "Eliminando..." : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);

  const [guests, setGuests] = useState([]);
  const [loadingGuests, setLoadingGuests] = useState(true);

  const [q, setQ] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [ci, setCi] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [csvMsg, setCsvMsg] = useState("");
  const [importing, setImporting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteGuest, setDeleteGuest] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ✅ nuevo: toast para copiar link
  const [copiedDoor, setCopiedDoor] = useState(false);

  async function loadEvent() {
    setEventLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id,name,event_date,event_code,created_at")
      .eq("id", id)
      .single();

    if (!error) setEvent(data);
    setEventLoading(false);
  }

  async function loadGuests() {
    setLoadingGuests(true);
    const { data, error } = await supabase
      .from("guests")
      .select("id,first_name,last_name,ci,checked_in_at,created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false });

    if (!error) setGuests(data ?? []);
    setLoadingGuests(false);
  }

  useEffect(() => {
    loadEvent();
    loadGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return guests;

    return guests.filter((g) => {
      const full = `${g.first_name} ${g.last_name}`.toLowerCase();
      return full.includes(needle) || (g.ci ?? "").includes(onlyDigits(needle));
    });
  }, [guests, q]);

  const stats = useMemo(() => {
    const total = guests.length;
    const entered = guests.filter((g) => !!g.checked_in_at).length;
    return { total, entered, pending: total - entered };
  }, [guests]);

  async function addGuest(e) {
    e.preventDefault();
    setMsg("");
    setSaving(true);

    try {
      const f = firstName.trim();
      const l = lastName.trim();
      const ciClean = onlyDigits(ci);

      if (!f || !l) throw new Error("Nombre y apellido son obligatorios");
      if (ciClean.length < 7 || ciClean.length > 8)
        throw new Error("CI inválida (7 u 8 dígitos)");

      if (guests.some((g) => g.ci === ciClean))
        throw new Error("Esa cédula ya está registrada");

      const { error } = await supabase.from("guests").insert({
        event_id: id,
        first_name: f,
        last_name: l,
        ci: ciClean,
      });

      if (error) throw error;

      setFirstName("");
      setLastName("");
      setCi("");
      setMsg("✅ Invitado agregado correctamente");
      setTimeout(() => setMsg(""), 3000);
      await loadGuests();
    } catch (err) {
      setMsg(err?.message ?? "Error agregando invitado");
    } finally {
      setSaving(false);
    }
  }

  function askDelete(g) {
    setDeleteGuest(g);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteGuest) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("guests")
        .delete()
        .eq("id", deleteGuest.id);

      if (error) throw error;

      setDeleteOpen(false);
      setDeleteGuest(null);
      await loadGuests();
    } catch (err) {
      alert("Error al eliminar: " + (err?.message ?? "Error desconocido"));
    } finally {
      setDeleting(false);
    }
  }

  async function handleCsvFile(file) {
    setCsvMsg("");
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);

      if (parsed.length === 0) {
        throw new Error("No se encontraron filas válidas");
      }

      const existing = new Set(guests.map((g) => g.ci));
      const seen = new Set();
      const rows = [];

      for (const r of parsed) {
        if (existing.has(r.ci)) continue;
        if (seen.has(r.ci)) continue;
        seen.add(r.ci);
        rows.push({ ...r, event_id: id });
      }

      if (rows.length === 0) {
        throw new Error("Todos los invitados ya estaban cargados");
      }

      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from("guests").insert(chunk);
        if (error) throw error;
      }

      setCsvMsg(`✅ Importados ${rows.length} invitados`);
      setTimeout(() => setCsvMsg(""), 5000);
      await loadGuests();
    } catch (err) {
      setCsvMsg(err?.message ?? "Error importando CSV");
    } finally {
      setImporting(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "Sin fecha";
    try {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString("es-UY", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  // ✅ nuevo: copiar con toast, sin alert()
  async function copyDoorLink() {
    if (!event?.event_code) return;

    const url = `${window.location.origin}/door/${event.event_code}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedDoor(true);
      window.setTimeout(() => setCopiedDoor(false), 1800);
    } catch {
      // fallback por si clipboard no está disponible / permisos
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);

        setCopiedDoor(true);
        window.setTimeout(() => setCopiedDoor(false), 1800);
      } catch {
        // si querés, podés usar setMsg acá
        setMsg("No se pudo copiar el link. Copialo manualmente.");
        setTimeout(() => setMsg(""), 3000);
      }
    }
  }

  return (
    <div className="detail-page">
      <div className="detail-gradient-orbs">
        <div className="detail-orb detail-orb-1"></div>
        <div className="detail-orb detail-orb-2"></div>
        <div className="detail-orb detail-orb-3"></div>
      </div>

      <ConfirmDeleteModal
        open={deleteOpen}
        guest={deleteGuest}
        busy={deleting}
        onCancel={() => !deleting && setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />

      <div className="detail-container">
        {eventLoading ? (
          <div className="detail-loading">
            <div className="detail-spinner"></div>
            <p>Cargando evento...</p>
          </div>
        ) : !event ? (
          <div
            className="detail-card"
            style={{ textAlign: "center", padding: "60px 40px" }}
          >
            <div style={{ fontSize: "4rem", marginBottom: "20px" }}>😕</div>
            <p
              style={{
                fontSize: "1.5rem",
                fontWeight: 900,
                color: "#6b21a8",
                marginBottom: "30px",
              }}
            >
              Evento no encontrado
            </p>
            <button
              className="events-btn events-btn-primary"
              onClick={() => navigate("/events")}
            >
              ← Volver a eventos
            </button>
          </div>
        ) : (
          <>
            <button
              className="detail-back-btn"
              onClick={() => navigate("/events")}
            >
              ← Volver a mis eventos
            </button>

            <div className="detail-header">
              <div className="detail-header-info">
                <h2>{event.name}</h2>
                <div className="detail-header-meta">
                  <span className="detail-code-badge">
                    🔑 <span>{event.event_code}</span>
                  </span>
                  <span className="detail-date">
                    📅 {formatDate(event.event_date)}
                  </span>
                </div>
              </div>

              {/* ✅ wrap para que el toast quede asociado al botón */}
              <div className="detail-copy-wrap">
                <button className="detail-copy-btn" onClick={copyDoorLink}>
                  🔗 Copiar link puerta
                </button>

                <div
                  className={`detail-copied-toast ${copiedDoor ? "show" : ""}`}
                >
                  ✅ Link copiado
                </div>
              </div>
            </div>

            <div className="detail-stats">
              <div className="detail-stat-card">
                <div className="detail-stat-header">
                  <span className="detail-stat-icon">👥</span>
                  <span className="detail-stat-label">Total</span>
                </div>
                <div className="detail-stat-value">{stats.total}</div>
              </div>

              <div className="detail-stat-card">
                <div className="detail-stat-header">
                  <span className="detail-stat-icon">✅</span>
                  <span className="detail-stat-label">Ingresaron</span>
                </div>
                <div className="detail-stat-value">{stats.entered}</div>
              </div>

              <div className="detail-stat-card">
                <div className="detail-stat-header">
                  <span className="detail-stat-icon">⏳</span>
                  <span className="detail-stat-label">Pendientes</span>
                </div>
                <div className="detail-stat-value">{stats.pending}</div>
              </div>
            </div>

            <div className="detail-forms">
              <div className="detail-card">
                <h3>➕ Agregar invitado</h3>
                <p>Completá los datos</p>

                <form className="detail-form" onSubmit={addGuest}>
                  <div className="detail-form-row">
                    <div className="detail-form-field">
                      <label className="detail-form-label">Nombre</label>
                      <input
                        className="detail-form-input"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Juan"
                        required
                      />
                    </div>
                    <div className="detail-form-field">
                      <label className="detail-form-label">Apellido</label>
                      <input
                        className="detail-form-input"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Pérez"
                        required
                      />
                    </div>
                  </div>

                  <div className="detail-form-field">
                    <label className="detail-form-label">Cédula</label>
                    <input
                      className="detail-form-input mono"
                      value={ci}
                      onChange={(e) => setCi(e.target.value)}
                      inputMode="numeric"
                      placeholder="12345678"
                      required
                    />
                  </div>

                  {msg && (
                    <div
                      className={`detail-form-message ${
                        msg.includes("✅")
                          ? "detail-form-message-success"
                          : "detail-form-message-error"
                      }`}
                    >
                      {msg}
                    </div>
                  )}

                  <button disabled={saving} className="detail-form-btn">
                    {saving ? "Agregando..." : "➕ Agregar invitado"}
                  </button>
                </form>
              </div>

              <div className="detail-card">
                <h3>📊 Importar CSV</h3>
                <p>
                  Formato:{" "}
                  <span className="mono" style={{ fontSize: "0.9rem" }}>
                    nombre,apellido,ci
                  </span>
                </p>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#9333ea",
                    marginBottom: "25px",
                  }}
                >
                  Acepta coma o punto y coma
                </p>

                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={importing}
                  onChange={(e) => handleCsvFile(e.target.files?.[0])}
                  className="detail-csv-input"
                />

                {csvMsg && (
                  <div
                    className={`detail-form-message ${
                      csvMsg.includes("✅")
                        ? "detail-form-message-success"
                        : "detail-form-message-error"
                    }`}
                    style={{ marginTop: "20px" }}
                  >
                    {csvMsg}
                  </div>
                )}

                <div className="detail-csv-tip">
                  <p>
                    💡 <span>Consejo:</span> El CSV te ahorra tiempo y evita
                    errores
                  </p>
                </div>
              </div>
            </div>

            <div className="detail-guests-card">
              <div className="detail-guests-header">
                <div>
                  <h3>📋 Lista de invitados</h3>
                  <p className="detail-guests-count">{guests.length} en total</p>
                </div>

                <input
                  className="detail-search-input"
                  placeholder="🔍 Buscar por nombre o cédula..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="detail-guests-body">
                {loadingGuests ? (
                  <div className="detail-loading">
                    <div className="detail-spinner"></div>
                    <p>Cargando...</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="detail-no-guests">
                    <div className="detail-no-guests-icon">
                      {q ? "🔍" : "📝"}
                    </div>
                    <p>
                      {q ? "No se encontraron invitados" : "Todavía no hay invitados"}
                    </p>
                  </div>
                ) : (
                  <div className="detail-guests-list">
                    {filtered.map((g) => (
                      <div key={g.id} className="detail-guest-item">
                        <div className="detail-guest-content">
                          <div className="detail-guest-info">
                            <div className="detail-guest-name">
                              {g.first_name} {g.last_name}
                            </div>
                            <div className="detail-guest-meta">
                              <span className="detail-guest-ci">{g.ci}</span>
                              <span className="detail-guest-sep">•</span>
                              {g.checked_in_at ? (
                                <span className="detail-guest-badge detail-guest-badge-done">
                                  Ya ingresó
                                </span>
                              ) : (
                                <span className="detail-guest-badge detail-guest-badge-ok">
                                  Pendiente
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            className="detail-guest-delete"
                            onClick={() => askDelete(g)}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
