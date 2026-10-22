import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Alert, Appointment, FamilyMember, ImportantDate, Trip } from "../api/types";
import { APPOINTMENT_CATEGORIES, IMPORTANT_DATE_CATEGORIES } from "../lib/categories";
import type { Option } from "../lib/categories";
import { countdown, dateTime, severityLabel, shortDate } from "../lib/format";
import { directionsUrl } from "../lib/maps";
import { atOccurrence, dayAfter, nextOccurrence, normalizeRecurrence, recurrenceLabel } from "../lib/recurrence";
import {
  RECURRENCE_FIELDS, fromDateTimeInput, normalizeCategory, recurrencePayload, toLocalDateTimeInput,
} from "../lib/appointmentForm";
import { useDialog } from "./Dialog";
import { useCustomOptions } from "../lib/useCustomOptions";

const moduleLabel: Record<string, string> = {
  family: "Familie", authority: "Behörden", finance: "Finanzen",
  home: "Allgemein", travel: "Reisen", general: "Allgemein",
};

const severityBadge = ["", "", "amber", "red"];

type Row = [string, string | null | undefined];

function optionLabel(value: string | null | undefined, options: Option[]): string {
  const key = String(value ?? "").trim().toLowerCase();
  return options.find((o) => o.value === key)?.label ?? key;
}

// Notes can carry machine-readable "[xyz-meta] … [/xyz-meta]" blocks the edit forms rely on;
// they aren't meant for reading.
function readableNotes(notes?: string | null): string {
  return (notes ?? "").replace(/\[([a-z-]+-meta)\][\s\S]*?\[\/\1\]/g, "").trim();
}

// The linked record behind an alert, fetched on open. Only appointments and important dates have
// details worth showing beyond the alert itself; everything else links to its own page.
type Details =
  | { kind: "appointment"; appt: Appointment; members: FamilyMember[] }
  | { kind: "date"; date: ImportantDate; members: FamilyMember[] }
  | { kind: "trip"; trip: Trip }
  | null;

/**
 * Details for one dashboard entry (calendar or overdue strip). Appointments can be completed,
 * edited or deleted right here; other entries link to the section that owns them.
 */
export default function AlertDetailsDialog({ alert, onClose, onChanged }: {
  alert: Alert | null;
  onClose: () => void;
  // Called after an appointment was completed, edited or deleted so the dashboard can reload.
  onChanged?: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>(null);
  const [loading, setLoading] = useState(false);
  const [backdropDown, setBackdropDown] = useState(false);
  const customApptCats = useCustomOptions("appointment-category");
  const customDateCats = useCustomOptions("important-date-category");

  useEffect(() => {
    setDetails(null);
    setActionError(null);
    if (!alert || alert.relatedId == null) return;
    const id = alert.relatedId;
    let cancelled = false;

    async function load() {
      if (alert!.relatedType === "Appointment") {
        const [appts, members] = await Promise.all([
          api.get<Appointment[]>("/api/appointments"),
          api.get<FamilyMember[]>("/api/family-members"),
        ]);
        const appt = appts.find((a) => a.id === id);
        if (!cancelled && appt) setDetails({ kind: "appointment", appt, members });
      } else if (alert!.relatedType === "ImportantDate") {
        const [dates, members] = await Promise.all([
          api.get<ImportantDate[]>("/api/important-dates"),
          api.get<FamilyMember[]>("/api/family-members"),
        ]);
        const date = dates.find((d) => d.id === id);
        if (!cancelled && date) setDetails({ kind: "date", date, members });
      } else if (alert!.relatedType === "Trip") {
        const trips = await api.get<Trip[]>("/api/trips");
        const trip = trips.find((t) => t.id === id);
        if (!cancelled && trip) setDetails({ kind: "trip", trip });
      }
    }

    if (alert.relatedType === "Appointment" || alert.relatedType === "ImportantDate" || alert.relatedType === "Trip") {
      setLoading(true);
      load().catch(() => { /* fall back to the alert's own fields */ })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled = true; };
  }, [alert]);

  useEffect(() => {
    if (!alert) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alert, onClose]);

  if (!alert) return null;

  const appt = details?.kind === "appointment" ? details.appt : null;
  const apptIsSeries = !!normalizeRecurrence(appt?.recurrence);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await onChanged?.();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Completing one occurrence of a series moves the series to its next date (same as Termine).
  function completeAppointment() {
    if (!appt || !alert) return;
    const occurrence = alert.dueOn ?? appt.startsAt;
    void run(async () => {
      if (apptIsSeries) {
        const following = nextOccurrence(appt, dayAfter(occurrence));
        await api.put(`/api/appointments/${appt.id}`, following ? atOccurrence(appt, following) : { ...appt, isDone: true });
      } else {
        await api.put(`/api/appointments/${appt.id}`, { ...appt, isDone: true });
      }
      onClose();
    });
  }

  async function editAppointment() {
    if (!appt || !details || details.kind !== "appointment") return;
    const categoryOptions = [...APPOINTMENT_CATEGORIES, ...customApptCats.options];
    const memberOptions = details.members.map((m) => ({ value: String(m.id), label: m.fullName }));
    onClose();
    const values = await dialog.form({
      title: apptIsSeries ? "Terminserie bearbeiten" : "Termin bearbeiten",
      submitText: "Speichern",
      fields: [
        { key: "title", label: "Termin" },
        { key: "startsAt", label: apptIsSeries ? "Start (erster Termin der Serie)" : "Start", type: "datetime-local" },
        { key: "location", label: "Ort" },
        {
          key: "category", label: "Kategorie", type: "select", options: categoryOptions,
          allowCustomOption: { onAdd: (label) => customApptCats.add(label, categoryOptions) },
        },
        { key: "attendeeIds", label: "Personen", type: "multiselect", options: memberOptions },
        ...RECURRENCE_FIELDS,
      ],
      initial: {
        title: appt.title,
        startsAt: toLocalDateTimeInput(appt.startsAt),
        location: appt.location ?? "",
        category: normalizeCategory(appt.category, categoryOptions),
        attendeeIds: appt.attendeeIds.join(","),
        recurrence: normalizeRecurrence(appt.recurrence) ?? "",
        recurrenceUntil: appt.recurrenceUntil ?? "",
      },
    });
    if (!values) return;
    try {
      await api.put(`/api/appointments/${appt.id}`, {
        ...appt,
        title: String(values.title).trim() || appt.title,
        startsAt: fromDateTimeInput(values.startsAt) ?? appt.startsAt,
        location: String(values.location ?? "").trim() || null,
        category: normalizeCategory(String(values.category), categoryOptions),
        attendeeIds: String(values.attendeeIds ?? "").split(",").map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0),
        isDone: false,
        ...recurrencePayload(values),
      });
      await onChanged?.();
    } catch (e) {
      await dialog.confirm({ title: "Speichern fehlgeschlagen", message: (e as Error).message, confirmText: "OK" });
    }
  }

  async function deleteAppointment() {
    if (!appt) return;
    const ok = await dialog.confirm(apptIsSeries
      ? { title: "Terminserie löschen", message: "Die ganze Terminserie mit allen Wiederholungen löschen?", confirmText: "Löschen", danger: true }
      : { title: "Termin löschen", message: "Termin wirklich löschen?", confirmText: "Löschen", danger: true });
    if (!ok) return;
    void run(async () => {
      await api.del(`/api/appointments/${appt.id}`);
      onClose();
    });
  }

  const rows: Row[] = [
    ["Bereich", moduleLabel[alert.module] ?? alert.module],
    ["Fällig", alert.dueOn ? `${shortDate(alert.dueOn)} · ${countdown(alert.daysLeft)}` : countdown(alert.daysLeft)],
  ];
  let notes = "";

  if (details?.kind === "appointment") {
    const a = details.appt;
    const names = new Map(details.members.map((m) => [m.id, m.fullName]));
    const recurrence = recurrenceLabel(a.recurrence);
    rows.push(
      ["Kategorie", optionLabel(a.category, [...APPOINTMENT_CATEGORIES, ...customApptCats.options])],
      // A series' next occurrence comes from the alert; the stored startsAt is the series anchor.
      ["Beginn", recurrence ? `${shortDate(alert.dueOn)} ${a.startsAt.slice(11, 16)}` : dateTime(a.startsAt)],
      ["Ende", a.endsAt ? dateTime(a.endsAt) : null],
      ["Ort", a.location],
      ["Teilnehmer", a.attendeeIds.map((id) => names.get(id)).filter(Boolean).join(", ")],
      ["Wiederholung", recurrence ? `${recurrence}${a.recurrenceUntil ? ` bis ${shortDate(a.recurrenceUntil)}` : ""}` : null],
      // Mirrors ReminderEmailWorker; the stored reminderDays isn't used for appointments.
      ["Erinnerung", "1 Tag vorher und ca. 1 Std. vor Beginn (E-Mail)"],
    );
    notes = readableNotes(a.notes);
  } else if (details?.kind === "date") {
    const d = details.date;
    const person = details.members.find((m) => m.id === d.familyMemberId);
    rows.push(
      ["Kategorie", optionLabel(d.category, [...IMPORTANT_DATE_CATEGORIES, ...customDateCats.options])],
      ["Datum", shortDate(d.dateValue)],
      ["Person", person?.fullName],
      ["Wiederholung", d.repeatsYearly ? "jährlich" : null],
      ["Erinnerung", "Am Tag selbst (E-Mail)"],
    );
    notes = readableNotes(d.notes);
  } else if (details?.kind === "trip") {
    const t = details.trip;
    rows.push(
      ["Ziel", t.destination],
      ["Zeitraum", t.endsOn ? `${shortDate(t.startsOn)} – ${shortDate(t.endsOn)}` : shortDate(t.startsOn)],
    );
    notes = readableNotes(t.notes);
  }
  const destination = details?.kind === "trip" ? details.trip.destination?.trim()
    : details?.kind === "appointment" ? details.appt.location?.trim()
    : null;

  const shown = rows.filter(([, v]) => v != null && String(v).trim() !== "");

  return (
    <div className="dlg-backdrop" role="presentation"
      onMouseDown={(e) => setBackdropDown(e.target === e.currentTarget)}
      onClick={(e) => { if (e.target === e.currentTarget && backdropDown) onClose(); setBackdropDown(false); }}>
      <div className="dlg alert-details-dialog" role="dialog" aria-modal="true" aria-labelledby="alert-details-title">
        <div className="dlg-head alert-details-head">
          <h3 id="alert-details-title">{details?.kind === "appointment" ? details.appt.title : alert.title}</h3>
          <span className={`badge ${severityBadge[alert.severity]}`}>{severityLabel[alert.severity]}</span>
        </div>
        <p className="dlg-text">{alert.message}</p>

        <div className="alert-details-grid">
          {shown.map(([label, value]) => (
            <div key={label} className="person-detail-row">
              <span className="person-detail-label">{label}</span>
              <span className="person-detail-value">{value}</span>
            </div>
          ))}
        </div>
        {loading && <p className="lede" style={{ marginTop: 10 }}>Details werden geladen …</p>}
        {notes && (
          <div className="alert-details-notes">
            <span className="person-detail-label">Notizen</span>
            <p>{notes}</p>
          </div>
        )}

        {actionError && <p className="alert-details-error" role="alert">{actionError}</p>}

        <div className="dlg-actions alert-details-actions">
          {appt && (
            <>
              <button type="button" className="btn danger" onClick={() => void deleteAppointment()} disabled={busy}
                title={apptIsSeries ? "Terminserie löschen" : "Termin löschen"}>
                <i className="fa-solid fa-trash" aria-hidden /> Löschen
              </button>
              <button type="button" className="btn ghost" onClick={() => void editAppointment()} disabled={busy}
                title={apptIsSeries ? "Terminserie bearbeiten" : "Termin bearbeiten"}>
                <i className="fa-solid fa-pen-to-square" aria-hidden /> Bearbeiten
              </button>
              <button type="button" className="btn" onClick={completeAppointment} disabled={busy}
                title="Termin als erledigt markieren">
                <i className="fa-solid fa-check" aria-hidden /> Erledigt
              </button>
            </>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>Schließen</button>
          {destination && (
            <a className="btn" href={directionsUrl(destination)} target="_blank" rel="noreferrer">
              <i className="fa-solid fa-diamond-turn-right" aria-hidden /> Route starten
            </a>
          )}
          {alert.actionPath && alert.relatedType !== "Appointment" && (
            <button type="button" className="btn" onClick={() => { onClose(); navigate(alert.actionPath!); }}>
              {alert.actionLabel ?? "Öffnen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
