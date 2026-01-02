import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { generateEventCode, hashPin } from "../../lib/eventUtils";
import PrettyDatePicker from "../../components/PrettyDatePicker";
import "./EventsPage.css";

export default function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Nuevo evento
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(""); // ISO yyyy-mm-dd
  const [newPin, setNewPin] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Editar evento
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState(""); // ISO yyyy-mm-dd
  const [editPin, setEditPin] = useState("");
  const [editMsg, setEditMsg] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ✅ toast de copiado por evento
  const [copiedEventId, setCopiedEventId] = useState(null);

  async function loadEvents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id,name,event_date,event_code,created_at")
      .order("created_at", { ascending: false });

    if (!error) setEvents(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
  }, []);

  function cleanPin(pin) {
    return (pin ?? "").replace(/\D/g, "");
  }

  async function createEvent(e) {
    e.preventDefault();
    setMsg("");
    setSaving(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("No hay sesión activa");

      const name = newName.trim();
      if (!name) throw new Error("El nombre es obligatorio");

      const pinClean = cleanPin(newPin);
      if (pinClean.length < 4 || pinClean.length > 8) {
        throw new Error("El PIN debe tener entre 4 y 8 dígitos");
      }

      const dateValue = newDate?.trim() ? newDate : null;

      let code = generateEventCode(6);
      let inserted = null;

      for (let i = 0; i < 5; i++) {
        const { data, error } = await supabase
          .from("events")
          .insert({
            creator_id: userId,
            name,
            event_date: dateValue,
            event_code: code,
            door_pin_hash: hashPin(pinClean),
          })
          .select()
          .single();

        if (!error) {
          inserted = data;
          break;
        }

        code = generateEventCode(6);
      }

      if (!inserted) throw new Error("No se pudo crear el evento");

      setShowNew(false);
      setNewName("");
      setNewDate("");
      setNewPin("");

      await loadEvents();
    } catch (err) {
      setMsg(err?.message ?? "Error creando el evento");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(ev) {
    setEditMsg("");
    setEditId(ev.id);
    setEditName(ev.name ?? "");
    setEditDate(ev.event_date ?? "");
    setEditPin("");
    setShowEdit(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditMsg("");
    setEditSaving(true);

    try {
      if (!editId) throw new Error("Evento inválido");

      const name = editName.trim();
      if (!name) throw new Error("El nombre es obligatorio");

      const dateValue = editDate?.trim() ? editDate : null;

      const updates = {
        name,
        event_date: dateValue,
      };

      const pinClean = cleanPin(editPin);
      if (editPin.trim()) {
        if (pinClean.length < 4 || pinClean.length > 8) {
          throw new Error("El PIN debe tener entre 4 y 8 dígitos");
        }
        updates.door_pin_hash = hashPin(pinClean);
      }

      const { error } = await supabase.from("events").update(updates).eq("id", editId);
      if (error) throw error;

      setShowEdit(false);
      setEditId(null);
      setEditName("");
      setEditDate("");
      setEditPin("");

      await loadEvents();
    } catch (err) {
      setEditMsg(err?.message ?? "Error guardando cambios");
    } finally {
      setEditSaving(false);
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

  // ✅ copiar con toast (sin alert)
  async function copyDoorLink(code, evId) {
    const url = `${window.location.origin}/door/${code}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedEventId(evId);
      window.setTimeout(() => setCopiedEventId(null), 1600);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);

        setCopiedEventId(evId);
        window.setTimeout(() => setCopiedEventId(null), 1600);
      } catch {
        // si querés, podés mostrar msg en algún lado
      }
    }
  }

  return (
    <div className="events-page">
      <div className="events-gradient-orbs">
        <div className="events-orb events-orb-1"></div>
        <div className="events-orb events-orb-2"></div>
        <div className="events-orb events-orb-3"></div>
      </div>

      <div className="events-container">
        <div className="events-header">
          <div className="events-header-content">
            <h2>Mis Eventos</h2>
            <p>Creá eventos, cargá invitados y gestioná el acceso</p>
          </div>

          <div className="events-header-actions">
            <button className="events-btn events-btn-primary" onClick={() => setShowNew(true)}>
              ✨ Nuevo evento
            </button>
            <button className="events-btn events-btn-secondary" onClick={() => supabase.auth.signOut()}>
              🚪 Salir
            </button>
          </div>
        </div>

        {/* Modal nuevo evento */}
        {showNew && (
          <div
            className="events-modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && !saving) setShowNew(false);
            }}
          >
            <div className="events-modal">
              <div className="events-modal-header">
                <div>
                  <h3>✨ Nuevo Evento</h3>
                  <p>El PIN lo va a usar el personal de seguridad</p>
                </div>
                <button
                  className="events-modal-close"
                  onClick={() => !saving && setShowNew(false)}
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

              <form className="events-form" onSubmit={createEvent}>
                <div className="events-form-field">
                  <label className="events-form-label">🎉 Nombre del evento</label>
                  <input
                    className="events-form-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej: Fiesta de Año Nuevo 2026"
                    required
                    autoFocus
                  />
                </div>

                <div className="events-form-grid">
                  <div className="events-form-field">
                    <label className="events-form-label">📅 Fecha (opcional)</label>

                    {/* ✅ DatePicker custom */}
                    <PrettyDatePicker valueIso={newDate} onChangeIso={setNewDate} />
                  </div>

                  <div className="events-form-field">
                    <label className="events-form-label">🔐 PIN de seguridad</label>
                    <input
                      className="events-form-input mono"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      inputMode="numeric"
                      placeholder="4 a 8 dígitos"
                      required
                    />
                  </div>
                </div>

                {msg && <div className="events-form-message events-form-message-error">{msg}</div>}

                <div className="events-form-actions">
                  <button
                    type="button"
                    className="events-btn events-btn-secondary"
                    onClick={() => !saving && setShowNew(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="events-btn events-btn-primary">
                    {saving ? "Creando..." : "Crear evento"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal editar evento */}
        {showEdit && (
          <div
            className="events-modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && !editSaving) setShowEdit(false);
            }}
          >
            <div className="events-modal">
              <div className="events-modal-header">
                <div>
                  <h3>✏️ Editar Evento</h3>
                  <p>Modificá el nombre, fecha o PIN</p>
                </div>
                <button
                  className="events-modal-close"
                  onClick={() => !editSaving && setShowEdit(false)}
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

              <form className="events-form" onSubmit={saveEdit}>
                <div className="events-form-field">
                  <label className="events-form-label">🎉 Nombre del evento</label>
                  <input
                    className="events-form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="events-form-grid">
                  <div className="events-form-field">
                    <label className="events-form-label">📅 Fecha (opcional)</label>

                    {/* ✅ DatePicker custom */}
                    <PrettyDatePicker valueIso={editDate} onChangeIso={setEditDate} />
                  </div>

                  <div className="events-form-field">
                    <label className="events-form-label">🔐 Nuevo PIN (opcional)</label>
                    <input
                      className="events-form-input mono"
                      value={editPin}
                      onChange={(e) => setEditPin(e.target.value)}
                      inputMode="numeric"
                      placeholder="Dejá vacío para no cambiar"
                    />
                  </div>
                </div>

                {editMsg && <div className="events-form-message events-form-message-error">{editMsg}</div>}

                <div className="events-form-actions">
                  <button
                    type="button"
                    className="events-btn events-btn-secondary"
                    onClick={() => !editSaving && setShowEdit(false)}
                    disabled={editSaving}
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={editSaving} className="events-btn events-btn-primary">
                    {editSaving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lista de eventos */}
        <div className="events-card">
          <div className="events-card-header">
            <h3>📋 Tus eventos</h3>
          </div>

          <div className="events-card-body">
            {loading ? (
              <div className="events-loading">
                <div className="events-spinner"></div>
                <p>Cargando eventos...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="events-empty">
                <div className="events-empty-icon">🎉</div>
                <p className="events-empty-title">Todavía no tenés eventos</p>
                <p className="events-empty-subtitle">Creá tu primer evento para empezar</p>
                <button className="events-btn events-btn-primary" onClick={() => setShowNew(true)}>
                  ✨ Crear primer evento
                </button>
              </div>
            ) : (
              <div className="events-list">
                {events.map((ev) => (
                  <div key={ev.id} className="event-item">
                    <div className="event-item-content">
                      <div className="event-item-info">
                        <h4>{ev.name}</h4>
                        <div className="event-item-meta">
                          <span className="event-code-badge">
                            🔑 <span>{ev.event_code}</span>
                          </span>
                          <span className="event-date">📅 {formatDate(ev.event_date)}</span>
                        </div>
                      </div>

                      <div className="event-item-actions">
                        <button className="events-btn events-btn-primary" onClick={() => navigate(`/events/${ev.id}`)}>
                          📝 Administrar
                        </button>

                        <button className="events-btn events-btn-secondary" onClick={() => openEdit(ev)}>
                          ✏️ Editar
                        </button>

                        <div className="event-copy-wrap">
                          <button className="events-btn events-btn-secondary" onClick={() => copyDoorLink(ev.event_code, ev.id)}>
                            🔗 Copiar link
                          </button>

                          <div className={`event-copied-toast ${copiedEventId === ev.id ? "show" : ""}`}>
                            ✅ Copiado
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
