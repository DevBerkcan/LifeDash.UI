import type { DialogField } from "../components/Dialog";
import { APPOINTMENT_CATEGORIES } from "./categories";
import type { Option } from "./categories";
import { RECURRENCE_OPTIONS, normalizeRecurrence } from "./recurrence";

// Form helpers shared by the Termine page and the dashboard calendar dialog.

export function toLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function fromDateTimeInput(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length === 16) return `${raw}:00`;
  return raw;
}

export function normalizeCategory(category: string | null | undefined, options: Option[] = APPOINTMENT_CATEGORIES): string {
  const key = String(category ?? "").trim().toLowerCase();
  return options.some((o) => o.value === key) ? key : "other";
}

// Shared by every appointment form; "bis" only shows once a repeat rule is picked.
export const RECURRENCE_FIELDS: DialogField[] = [
  { key: "recurrence", label: "Wiederholung", type: "select", options: RECURRENCE_OPTIONS },
  { key: "recurrenceUntil", label: "Wiederholen bis (optional)", type: "date", visibleWhen: (d) => !!normalizeRecurrence(d.recurrence) },
];

export function recurrencePayload(values: Record<string, unknown>) {
  const recurrence = normalizeRecurrence(values.recurrence);
  const until = String(values.recurrenceUntil ?? "").trim();
  return { recurrence, recurrenceUntil: recurrence && until ? until : null };
}
