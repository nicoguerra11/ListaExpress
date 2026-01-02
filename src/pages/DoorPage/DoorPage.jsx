import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { hashPin } from "../../lib/eventUtils";
import "./DoorPage.css";

export default function DoorPage() {
  const { code } = useParams();

  const [event, setEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState("");

  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinMsg, setPinMsg] = useState("");

  const [ci, setCi] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [searchMsg, setSearchMsg] = useState("");

  const [checkingIn, setCheckingIn] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");

  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const cleanCi = useMemo(() => (ci ?? "").replace(/\D/g, ""), [ci]);

  const [debouncedCi, setDebouncedCi] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCi(cleanCi), 250);
    return () => clearTimeout(t);
  }, [cleanCi]);

  const lastSuggestReqIdRef = useRef(0);

  useEffect(() => {
    async function loadEvent() {
      setLoadingEvent(true);
      setEventError("");
      setUnlocked(false);
      setEvent(null);

      setCi("");
      setResult(null);
      setSearchMsg("");
      setCheckMsg("");
      setSuggestions([]);
      setPin("");
      setPinMsg("");

      const { data, error } = await supabase
        .from("events")
        .select("id,name,event_date,event_code,door_pin_hash")
        .eq("event_code", code)
        .maybeSingle();

      if (error) setEventError("Error buscando el evento");
      else if (!data) setEventError("Evento no encontrado");
      else setEvent(data);

      setLoadingEvent(false);
    }

    loadEvent();
  }, [code]);

  function formatDate(d) {
    if (!d) return "Sin fecha";
    try {
      const date = new Date(d + "T00:00:00");
      return date.toLocaleDateString("es-UY", {
        day: "numeric",
        month: "long",
      });
    } catch {
      return d;
    }
  }

  function tryUnlock(e) {
    e.preventDefault();
    setPinMsg("");

    if (!event) return;

    const pinClean = (pin ?? "").replace(/\D/g, "");
    if (pinClean.length < 4 || pinClean.length > 8) {
      setPinMsg("PIN inválido (4-8 dígitos)");
      return;
    }

    const ok = hashPin(pinClean) === event.door_pin_hash;
    if (!ok) {
      setPinMsg("PIN incorrecto");
      setUnlocked(false);
      return;
    }

    setUnlocked(true);
    setPin("");
    setPinMsg("");
  }

  useEffect(() => {
    async function loadSuggestions() {
      if (!event || !unlocked) {
        setSuggestions([]);
        setSuggestLoading(false);
        return;
      }

      const prefix = debouncedCi;

      if (!prefix || prefix.length < 3) {
        setSuggestions([]);
        setSuggestLoading(false);
        return;
      }

      setSuggestLoading(true);
      const reqId = ++lastSuggestReqIdRef.current;

      const { data, error } = await supabase
        .from("guests")
        .select("id,first_name,last_name,ci,checked_in_at")
        .eq("event_id", event.id)
        .like("ci", `${prefix}%`)
        .order("ci", { ascending: true })
        .limit(12);

      if (reqId !== lastSuggestReqIdRef.current) return;

      if (!error) {
        setSuggestions(data ?? []);
      }

      setSuggestLoading(false);
    }

    loadSuggestions();
  }, [debouncedCi, event, unlocked]);

  async function searchGuest(e) {
    e?.preventDefault?.();
    setSearchMsg("");
    setCheckMsg("");
    setResult(null);

    if (!event) return;
    if (!unlocked) {
      setSearchMsg("Primero ingresá el PIN");
      return;
    }

    const ciClean = cleanCi;

    if (ciClean.length < 7 || ciClean.length > 8) {
      setSearchMsg("CI inválida (7 u 8 dígitos)");
      return;
    }

    setSearching(true);

    const { data, error } = await supabase
      .from("guests")
      .select("id,first_name,last_name,ci,checked_in_at")
      .eq("event_id", event.id)
      .eq("ci", ciClean)
      .maybeSingle();

    if (error) setSearchMsg("Error buscando invitado");
    else if (!data) setSearchMsg("No está en la lista");
    else {
      setResult(data);
      setSuggestions([]);
    }

    setSearching(false);
  }

  async function markCheckIn() {
    setCheckMsg("");

    if (!event || !result) return;

    if (result.checked_in_at) {
      setCheckMsg("⚠️ Ya ingresó antes");
      return;
    }

    setCheckingIn(true);

    const { data, error } = await supabase
      .from("guests")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", result.id)
      .select("id,first_name,last_name,ci,checked_in_at")
      .single();

    if (error) {
      setCheckMsg("Error marcando ingreso");
    } else {
      setResult(data);
      setCheckMsg("✅ Ingreso marcado");

      setTimeout(() => {
        setCi("");
        setResult(null);
        setCheckMsg("");
        setSuggestions([]);
        setSearchMsg("");
      }, 2000);
    }

    setCheckingIn(false);
  }

  function onPickSuggestion(g) {
    setCi(g.ci);
    setResult(g);
    setSearchMsg("");
    setCheckMsg("");
    setSuggestions([]);
  }

  const showSuggestions =
    unlocked &&
    event &&
    cleanCi.length >= 3 &&
    !(result?.ci && result.ci === cleanCi);

  return (
    <div className="door-page">
      <div className="door-gradient-orbs">
        <div className="door-orb door-orb-1"></div>
        <div className="door-orb door-orb-2"></div>
        <div className="door-orb door-orb-3"></div>
      </div>

      <div className="door-container">
        <div className="door-header">
          <h1 className="door-title">ListaExpress</h1>
          <p className="door-subtitle">🚪 Modo Puerta</p>
        </div>

        <div className="door-card">
          {loadingEvent ? (
            <div className="door-loading">
              <div className="door-spinner"></div>
              <p>Cargando...</p>
            </div>
          ) : eventError ? (
            <div className="door-error">{eventError}</div>
          ) : (
            <>
              <div className="door-event-info">
                <span className={`door-badge ${unlocked ? "door-badge-active" : "door-badge-locked"}`}>
                  {unlocked ? "🔓 Activo" : "🔒 Bloqueado"}
                </span>
                <h2 className="door-event-name">{event.name}</h2>
                <div className="door-event-meta">
                  <span>🔑 {event.event_code}</span>
                  <span>•</span>
                  <span>📅 {formatDate(event.event_date)}</span>
                </div>
              </div>

              {!unlocked && (
                <form className="door-form" onSubmit={tryUnlock}>
                  <label className="door-label-big">🔐 PIN de Seguridad</label>
                  <input
                    className="door-input-big"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    inputMode="numeric"
                    placeholder="••••"
                    required
                    autoFocus
                  />

                  {pinMsg && <div className="door-message-error">{pinMsg}</div>}

                  <button className="door-btn-primary" type="submit">
                    🔓 Desbloquear
                  </button>
                </form>
              )}

              {unlocked && (
                <div className="door-search-section">
                  <label className="door-label-big">🎫 CÉDULA DEL INVITADO</label>

                  <div className="door-input-wrapper">
                    <input
                      className="door-input-big"
                      value={ci}
                      onChange={(e) => {
                        const v = (e.target.value ?? "").replace(/\D/g, "");
                        setCi(v);
                        setResult(null);
                        setSearchMsg("");
                        setCheckMsg("");
                      }}
                      inputMode="numeric"
                      placeholder="12345678"
                      autoComplete="off"
                      autoFocus
                    />

                    {showSuggestions && (
                      <div className="door-suggestions">
                        {suggestLoading ? (
                          <div className="door-suggestion-loading">Buscando...</div>
                        ) : suggestions.length === 0 ? (
                          <div className="door-suggestion-empty">Sin coincidencias</div>
                        ) : (
                          suggestions.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              className="door-suggestion-item"
                              onClick={() => onPickSuggestion(g)}
                            >
                              <div className="door-suggestion-info">
                                <div className="door-suggestion-name">
                                  {g.first_name} {g.last_name}
                                </div>
                                <div className="door-suggestion-ci">{g.ci}</div>
                              </div>

                              <span
                                className={`door-suggestion-badge ${
                                  g.checked_in_at ? "door-badge-warning" : "door-badge-success"
                                }`}
                              >
                                {g.checked_in_at ? "Ya ingresó" : "Disponible"}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="door-hint">💡 Escribí 3+ dígitos para ver sugerencias</div>

                  <button
                    onClick={searchGuest}
                    disabled={searching || cleanCi.length < 7}
                    className="door-btn-primary"
                    type="button"
                  >
                    {searching ? "⏳ Buscando..." : "🔍 Buscar"}
                  </button>

                  {searchMsg && <div className="door-message-error">{searchMsg}</div>}

                  <div
                    className={`door-result ${
                      result?.checked_in_at ? "door-result-warning" : result ? "door-result-success" : ""
                    }`}
                  >
                    {!result ? (
                      <div className="door-result-empty">
                        <div className="door-result-icon">🔍</div>
                        <p>Esperando búsqueda...</p>
                      </div>
                    ) : (
                      <div className="door-result-content">
                        <div className="door-result-icon-big">{result.checked_in_at ? "⚠️" : "✅"}</div>
                        <div className="door-result-name">
                          {result.first_name} {result.last_name}
                        </div>
                        <div className="door-result-ci">CI: {result.ci}</div>
                        <span
                          className={`door-result-status ${
                            result.checked_in_at ? "door-badge-warning" : "door-badge-success"
                          }`}
                        >
                          {result.checked_in_at ? "Ya ingresó" : "✓ Puede ingresar"}
                        </span>

                        <button
                          onClick={markCheckIn}
                          disabled={checkingIn || !!result.checked_in_at}
                          className={result.checked_in_at ? "door-btn-disabled" : "door-btn-success"}
                          type="button"
                        >
                          {result.checked_in_at
                            ? "❌ Ya ingresó"
                            : checkingIn
                              ? "⏳ Marcando..."
                              : "✅ MARCAR INGRESO"}
                        </button>

                        {checkMsg && (
                          <div
                            className={`door-message ${
                              checkMsg.includes("✅") ? "door-message-success" : "door-message-error"
                            }`}
                          >
                            {checkMsg}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {unlocked && <div className="door-footer-tip">⚡ Rápido: 3 dígitos → tap → listo</div>}
      </div>
    </div>
  );
}
