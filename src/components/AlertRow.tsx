import { Link } from "react-router-dom";
import type { Alert, Appointment } from "../api/types";
import { countdown } from "../lib/format";
import { normalizeRecurrence } from "../lib/recurrence";

const moduleLabel: Record<string, string> = {
  family: "Familie", authority: "Behörden", finance: "Finanzen",
  home: "Allgemein", travel: "Reisen", general: "Allgemein",
};

export default function AlertRow({ alert, appointment, onComplete, onDelete }: {
  alert: Alert;
  appointment?: Appointment;
  onComplete?: (alert: Alert) => void;
  onDelete?: (alert: Alert) => void;
}) {
  const d = alert.daysLeft;
  const big = d === null ? "—" : d < 0 ? `+${Math.abs(d)}` : `${d}`;
  const unit = d === null ? "offen" : d < 0 ? "Tage über" : d === 1 ? "Tag" : "Tage";

  return (
    <article className={`alert sev-${alert.severity}`}>
      <div className="alert-count" aria-hidden>
        {big}<small>{unit}</small>
      </div>
      <div>
        <div className="alert-title">
          <span className="alert-tag">{moduleLabel[alert.module] ?? alert.module}</span>
          {alert.title}
        </div>
        <div className="alert-msg">{alert.message}</div>
      </div>
      {(alert.actionPath || (alert.relatedType === "Appointment" && appointment && onComplete && onDelete)) && (
        <div className="alert-actions">
          {alert.actionPath && (
            <Link className="btn ghost small" to={alert.actionPath}>
              {alert.actionLabel ?? "Öffnen"}
            </Link>
          )}
          {alert.relatedType === "Appointment" && appointment && onComplete && onDelete && (
            <>
              <button type="button" className="btn ghost small icon-only"
                aria-label="Termin als erledigt markieren" title="Termin als erledigt markieren"
                onClick={() => onComplete(alert)}>
                <i className="fa-solid fa-check" aria-hidden />
              </button>
              <button type="button" className="btn danger small icon-only"
                aria-label={normalizeRecurrence(appointment.recurrence) ? "Terminserie löschen" : "Termin löschen"}
                title={normalizeRecurrence(appointment.recurrence) ? "Terminserie löschen" : "Termin löschen"}
                onClick={() => onDelete(alert)}>
                <i className="fa-solid fa-trash" aria-hidden />
              </button>
            </>
          )}
        </div>
      )}
      <span className="sr-only">{countdown(d)}</span>
    </article>
  );
}
