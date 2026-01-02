import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./PrettyDatePicker.css";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isoToDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateToIso(d) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function formatDisplayFromIso(iso) {
  const d = isoToDate(iso);
  if (!d) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function PrettyDatePicker({
  valueIso,
  onChangeIso,
  placeholder = "dd/mm/aaaa",
  disabled = false,
}) {
  const inputRef = useRef(null);
  const popRef = useRef(null);

  const selectedDate = useMemo(() => isoToDate(valueIso), [valueIso]);

  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null); // DOMRect
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Sync mes visible cuando cambia el valor desde afuera (editar evento)
  useEffect(() => {
    if (!selectedDate) return;
    setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [valueIso]); // eslint-disable-line react-hooks/exhaustive-deps

  function openPop() {
    if (disabled) return;
    const r = inputRef.current?.getBoundingClientRect();
    if (!r) return;
    setAnchor(r);
    setOpen(true);
  }

  function closePop() {
    setOpen(false);
  }

  // Cerrar click afuera + ESC
  useEffect(() => {
    if (!open) return;

    function onDown(e) {
      const t = e.target;
      if (inputRef.current && inputRef.current.contains(t)) return;
      if (popRef.current && popRef.current.contains(t)) return;
      closePop();
    }

    function onKey(e) {
      if (e.key === "Escape") closePop();
    }

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reposicionar en resize/scroll
  useEffect(() => {
    if (!open) return;

    function sync() {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      setAnchor(r);
    }

    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open]);

  function prevMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  const monthLabel = useMemo(() => {
    return viewMonth.toLocaleDateString("es-UY", { month: "long", year: "numeric" });
  }, [viewMonth]);

  const weeks = useMemo(() => {
    // calendario lunes -> domingo
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);

    // 0 domingo..6 sábado -> queremos lunes=0..domingo=6
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);

    const lastIdx = (last.getDay() + 6) % 7;
    const endOffset = 6 - lastIdx;
    const end = new Date(last);
    end.setDate(last.getDate() + endOffset);

    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    const out = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [viewMonth]);

  function pickDay(d) {
    onChangeIso(dateToIso(d));
    closePop();
  }

  function clear() {
    onChangeIso("");
    closePop();
  }

  function pickToday() {
    onChangeIso(dateToIso(new Date()));
    closePop();
  }

  // Posición del popover (responsive)
  const popStyle = useMemo(() => {
    if (!anchor) return { display: "none" };

    const margin = 12;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // en mobile lo hacemos full width (casi)
    const isMobile = vw <= 520;
    const popW = isMobile ? Math.min(vw - margin * 2, 360) : 340;
    const popH = 380;

    // ideal: alineado al input
    const leftIdeal = anchor.left;
    const left = isMobile
      ? (vw - popW) / 2
      : clamp(leftIdeal, margin, vw - popW - margin);

    const topBelow = anchor.bottom + 10;
    const topAbove = anchor.top - popH - 10;

    const top =
      topBelow + popH <= vh - margin
        ? topBelow
        : clamp(topAbove, margin, vh - popH - margin);

    return {
      position: "fixed",
      left,
      top,
      width: popW,
      zIndex: 3000,
    };
  }, [anchor]);

  return (
    <div className="pdp">
      <button
        type="button"
        className={`pdp-input ${disabled ? "is-disabled" : ""}`}
        onClick={openPop}
        disabled={disabled}
        ref={inputRef}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={`pdp-text ${valueIso ? "" : "muted"}`}>
          {valueIso ? formatDisplayFromIso(valueIso) : placeholder}
        </span>
        <span className="pdp-icon" aria-hidden>
          📅
        </span>
      </button>

      {open &&
        createPortal(
          <div className="pdp-pop" style={popStyle} ref={popRef} role="dialog">
            <div className="pdp-cal">
              <div className="pdp-head">
                <button type="button" className="pdp-nav" onClick={prevMonth} aria-label="Mes anterior">
                  ‹
                </button>
                <div className="pdp-title">{monthLabel}</div>
                <button type="button" className="pdp-nav" onClick={nextMonth} aria-label="Mes siguiente">
                  ›
                </button>
              </div>

              <div className="pdp-weekdays">
                {["LU", "MA", "MI", "JU", "VI", "SA", "DO"].map((w) => (
                  <div key={w} className="pdp-wd">
                    {w}
                  </div>
                ))}
              </div>

              <div className="pdp-grid">
                {weeks.map((week, wi) => (
                  <div key={wi} className="pdp-row">
                    {week.map((d) => {
                      const inMonth = d.getMonth() === viewMonth.getMonth();
                      const isSelected = sameDay(d, selectedDate);

                      return (
                        <button
                          key={d.toISOString()}
                          type="button"
                          className={[
                            "pdp-day",
                            inMonth ? "in" : "out",
                            isSelected ? "sel" : "",
                          ].join(" ")}
                          onClick={() => pickDay(d)}
                        >
                          {d.getDate()}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="pdp-actions">
                <button type="button" className="pdp-action-btn" onClick={clear}>
                  Borrar
                </button>
                <button type="button" className="pdp-action-btn" onClick={pickToday}>
                  Hoy
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
