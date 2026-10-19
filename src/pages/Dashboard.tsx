import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Appointment, DashboardResponse } from "../api/types";
import AlertRow from "../components/AlertRow";
import { useDialog } from "../components/Dialog";
import { AlertCompositionChart, UpcomingLoadChart } from "../components/DashboardCharts";
import DashboardDeliveries from "../components/DashboardDeliveries";
import DashboardWeather from "../components/DashboardWeather";
import Horizon from "../components/Horizon";
import { Empty, ErrorBar, PageHead, Pager, Stat, usePaged } from "../components/Ui";
import { euro } from "../lib/format";
import { atOccurrence, dayAfter, nextOccurrence, normalizeRecurrence } from "../lib/recurrence";
import { useAsync } from "../lib/useAsync";

const filters = [
  { id: "all", label: "Alles" },
  { id: "3", label: "Überfällig" },
  { id: "2", label: "Dringend" },
  { id: "authority", label: "Behörden" },
  { id: "finance", label: "Finanzen" },
  { id: "family", label: "Familie" },
  { id: "travel", label: "Reisen" },
];

const HORIZON_DAYS = 120;

export default function Dashboard({ onCount }: { onCount?: (n: number) => void }) {
  const [filter, setFilter] = useState("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const dialog = useDialog();
  const { data, error, loading, reload } = useAsync<DashboardResponse>(
    () => api.get<DashboardResponse>(`/api/dashboard?horizonDays=${HORIZON_DAYS}`), []);
  const appointments = useAsync<Appointment[]>(() => api.get("/api/appointments"), []);

  async function completeAppointment(alert: DashboardResponse["alerts"][number]) {
    const appointment = appointments.data?.find((a) => a.id === alert.relatedId);
    if (!appointment) return;
    setActionError(null);
    try {
      if (normalizeRecurrence(appointment.recurrence)) {
        const following = nextOccurrence(appointment, dayAfter(alert.dueOn ?? appointment.startsAt));
        await api.put(`/api/appointments/${appointment.id}`, following
          ? atOccurrence(appointment, following)
          : { ...appointment, isDone: true });
      } else {
        await api.put(`/api/appointments/${appointment.id}`, { ...appointment, isDone: true });
      }
      await Promise.all([reload(), appointments.reload()]);
    } catch (e) { setActionError((e as Error).message); }
  }

  async function deleteAppointment(alert: DashboardResponse["alerts"][number]) {
    const appointment = appointments.data?.find((a) => a.id === alert.relatedId);
    if (!appointment) return;
    const isSeries = !!normalizeRecurrence(appointment.recurrence);
    const ok = await dialog.confirm(isSeries
      ? { title: "Terminserie löschen", message: "Die ganze Terminserie mit allen Wiederholungen löschen?", confirmText: "Löschen", danger: true }
      : { title: "Termin löschen", message: "Termin wirklich löschen?", confirmText: "Löschen", danger: true });
    if (!ok) return;
    setActionError(null);
    try {
      await api.del(`/api/appointments/${appointment.id}`);
      await Promise.all([reload(), appointments.reload()]);
    } catch (e) { setActionError((e as Error).message); }
  }

  const urgentCount = data
    ? data.summary.overdue + data.summary.urgent
    : 0;
  useEffect(() => { onCount?.(urgentCount); }, [urgentCount, onCount]);

  const shown = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.alerts;
    if (filter === "3" || filter === "2")
      return data.alerts.filter((a) => String(a.severity) === filter);
    return data.alerts.filter((a) => a.module === filter);
  }, [data, filter]);
  const shownPaged = usePaged(shown);

  if (loading) return <p className="lede">Wird geladen …</p>;
  if (error) return <ErrorBar message={error} />;
  if (!data) return null;

  const s = data.summary;

  return (
    <>
      <PageHead
        eyebrow="Übersicht"
        title="Was als Nächstes ansteht"
        lede="Alle Fristen aus Familie, Behörden, Finanzen und Reisen an einem Ort — nach Dringlichkeit sortiert."
      />

      <ErrorBar message={actionError} />

      <Horizon alerts={data.alerts} horizon={30} />

      <DashboardDeliveries />

      <DashboardWeather />

      <div className="stats">
        <Stat label="Überfällig" value={String(s.overdue)}
              tone={s.overdue > 0 ? "neg" : undefined}
              note={s.overdue > 0 ? "sofort erledigen" : "nichts liegen geblieben"} />
        <Stat label="Nächste 7 Tage" value={String(s.urgent)} note="dringende Fristen" />
        <Stat label="Fehlende Unterlagen" value={String(s.missingDocuments)}
              tone={s.missingDocuments > 0 ? "neg" : undefined} note="Pflichtdokumente" />
        <Stat label="Monatlicher Rest" value={euro(s.monthlyBalance)}
              tone={s.monthlyBalance < 0 ? "neg" : "pos"}
              note={`${euro(s.monthlyIncome)} Einnahmen`} />
        <Stat label="Offene Aufgaben" value={String(s.openTasks)} note="modulübergreifend" />
        {s.nextTripTitle && (
          <Stat label="Nächste Reise" value={`${s.nextTripInDays} Tage`} note={s.nextTripTitle} />
        )}
      </div>

      <div className="chart-row">
        <AlertCompositionChart alerts={data.alerts} />
        <UpcomingLoadChart alerts={data.alerts} horizonDays={HORIZON_DAYS} />
      </div>

      {data.insights.length > 0 && (
        <div className="insights">
          {data.insights.map((i) => (
            <div className="insight" key={i.id}>
              <span className="insight-icon" aria-hidden>{i.icon}</span>
              <span>
                {i.message}{" "}
                {i.actionPath && <Link to={i.actionPath}>Ansehen</Link>}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="filters" role="group" aria-label="Hinweise filtern">
        {filters.map((f) => (
          <button key={f.id} className={`chip ${filter === f.id ? "on" : ""}`}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {shown.length === 0
        ? <Empty title="Hier ist gerade nichts fällig."
                 hint="Sobald ein Dokument abläuft oder eine Frist näher rückt, taucht es hier auf." />
        : <>
            <div className="alert-list">{shownPaged.pageItems.map((a) => <AlertRow key={a.id} alert={a}
              appointment={appointments.data?.find((item) => item.id === a.relatedId)}
              onComplete={completeAppointment} onDelete={deleteAppointment} />)}</div>
            <Pager paged={shownPaged} />
          </>}
    </>
  );
}
