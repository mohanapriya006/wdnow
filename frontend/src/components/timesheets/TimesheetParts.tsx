/**
 * Presentation pieces shared by the contractor and vendor Timesheet screens.
 *
 * These render only what the backend sends: hours, splits and anomalies are all
 * calculated server-side, so nothing here recomputes a number.
 */
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  Info,
  OctagonAlert,
  Sun,
  XCircle,
} from "lucide-react";
import type { Anomaly, AnomalySeverity, TimeEntry, Timesheet } from "@/api/types";
import { Card } from "@/components/ui/Card";
import { SeverityBadge } from "@/components/ui/Badge";
import { cn, formatDate } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

export function MetricTile({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  icon?: ReactNode;
}) {
  const tones = {
    neutral: "border-ink-200 bg-white text-ink-900",
    brand: "border-brand-200 bg-brand-50/60 text-brand-800",
    success: "border-emerald-200 bg-emerald-50/60 text-emerald-800",
    warning: "border-amber-200 bg-amber-50/60 text-amber-800",
    danger: "border-red-200 bg-red-50/60 text-red-800",
  }[tone];

  return (
    <div className={cn("rounded-xl border px-4 py-3", tones)}>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      </div>
      <p className="mt-1.5 text-xl font-bold leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-[11px] opacity-70">{sub}</p>}
    </div>
  );
}

/** Horizontal regular-vs-overtime bar measured against the weekly capacity. */
export function CapacityBar({
  regular,
  overtime,
  capacity,
  capacityLabel,
}: {
  regular: number;
  overtime: number;
  capacity: number;
  /** Right-hand caption. Pass null to hide it where no weekly cap applies. */
  capacityLabel?: string | null;
}) {
  const scale = Math.max(capacity, regular + overtime, 1);
  const regularPct = (regular / scale) * 100;
  const overtimePct = (overtime / scale) * 100;

  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div className="bg-emerald-500 transition-all" style={{ width: `${regularPct}%` }} />
        <div className="bg-amber-500 transition-all" style={{ width: `${overtimePct}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {regular}h regular
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {overtime}h overtime
        </span>
        {capacityLabel !== null && (
          <span className="ml-auto">{capacityLabel ?? `Capacity ${capacity}h/week`}</span>
        )}
      </div>
    </div>
  );
}

const anomalyIcons: Record<string, ReactNode> = {
  EXCESSIVE_HOURS: <Flame className="h-4 w-4" />,
  HOLIDAY_WORK: <Sun className="h-4 w-4" />,
  OVERLAPPING_ENTRY: <CalendarClock className="h-4 w-4" />,
  DUPLICATE_ENTRY: <CalendarClock className="h-4 w-4" />,
  MISSING_END_TIME: <OctagonAlert className="h-4 w-4" />,
  INVALID_END_TIME: <OctagonAlert className="h-4 w-4" />,
  TIME_RULE_VIOLATION: <AlertTriangle className="h-4 w-4" />,
};

const severityTone: Record<AnomalySeverity, string> = {
  CRITICAL: "border-red-300 bg-red-50 text-red-800",
  HIGH: "border-red-200 bg-red-50/70 text-red-800",
  MEDIUM: "border-amber-200 bg-amber-50/70 text-amber-800",
  LOW: "border-brand-200 bg-brand-50/70 text-brand-800",
};

function humanAnomaly(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/** Full anomaly list: type, severity, date, hours and the exact reason. */
export function AnomalyPanel({ anomalies }: { anomalies: Anomaly[] }) {
  if (!anomalies.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        No anomalies detected for this week.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {anomalies.map((a, i) => (
        <div
          key={`${a.type}-${a.date}-${i}`}
          className={cn("rounded-lg border px-4 py-3", severityTone[a.severity])}
        >
          <div className="flex flex-wrap items-center gap-2">
            {anomalyIcons[a.type] ?? <AlertTriangle className="h-4 w-4" />}
            <span className="text-sm font-semibold">{humanAnomaly(a.type)}</span>
            <SeverityBadge severity={a.severity} />
            <span className="ml-auto text-xs font-medium opacity-80">
              {formatDate(a.date)} · {a.hours}h
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed opacity-90">{a.reason}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Daily entry table                                                   */
/* ------------------------------------------------------------------ */

export function DailyEntriesTable({
  entries,
  onDelete,
  deletingId,
}: {
  entries: TimeEntry[];
  onDelete?: (entryId: string) => void;
  deletingId?: string | null;
}) {
  if (!entries.length) {
    return (
      <p className="px-1 py-6 text-center text-sm text-ink-500">
        No daily entries logged for this week yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wider text-ink-500">
            <th className="py-2 pr-3 font-semibold">Date</th>
            <th className="py-2 pr-3 font-semibold">Start</th>
            <th className="py-2 pr-3 font-semibold">End</th>
            <th className="py-2 pr-3 text-right font-semibold">Break</th>
            <th className="py-2 pr-3 text-right font-semibold">Hours</th>
            <th className="py-2 pr-3 text-right font-semibold">Reg / OT</th>
            <th className="py-2 pr-3 font-semibold">Status</th>
            {onDelete && <th className="py-2 font-semibold" />}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              className={cn(
                "border-b border-ink-100 last:border-0",
                e.has_anomaly && "bg-red-50/40"
              )}
            >
              <td className="py-2.5 pr-3">
                <span className="font-medium text-ink-900">{formatDate(e.work_date)}</span>
                {e.is_holiday && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    <Sun className="h-3 w-3" />
                    {e.holiday_name}
                  </span>
                )}
                {e.notes && <p className="mt-0.5 text-[11px] text-ink-500">{e.notes}</p>}
              </td>
              <td className="py-2.5 pr-3 tabular-nums text-ink-700">{e.start_time ?? "—"}</td>
              <td className="py-2.5 pr-3 tabular-nums text-ink-700">{e.end_time ?? "—"}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-ink-500">
                {e.break_minutes ? `${e.break_minutes}m` : "—"}
              </td>
              <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-ink-900">
                {e.total_hours}h
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-ink-500">
                {e.regular_hours} / {e.overtime_hours}
              </td>
              <td className="py-2.5 pr-3">
                {e.has_anomaly ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-700"
                    title={e.anomalies.map((a) => a.reason).join("\n")}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {e.anomalies.length} issue{e.anomalies.length > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Clear
                  </span>
                )}
                {e.is_flagged === 1 && e.flag_reason && (
                  <p className="mt-0.5 text-[11px] text-red-600">{e.flag_reason}</p>
                )}
              </td>
              {onDelete && (
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(e.id)}
                    disabled={deletingId === e.id}
                    className="rounded-md p-1 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    title="Remove this entry"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weekly summary header                                               */
/* ------------------------------------------------------------------ */

export function WeeklySummary({ sheet }: { sheet: Timesheet }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricTile
        label="Total hours"
        value={`${sheet.total_hours}h`}
        sub={`${sheet.days_logged} day${sheet.days_logged === 1 ? "" : "s"} logged`}
        tone="brand"
        icon={<Clock className="h-3.5 w-3.5" />}
      />
      <MetricTile
        label="Regular"
        value={`${sheet.regular_hours}h`}
        sub={`Capacity ${sheet.weekly_capacity}h`}
        tone="success"
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
      />
      <MetricTile
        label="Overtime"
        value={`${sheet.overtime_hours}h`}
        sub={sheet.overtime_hours > 0 ? "Above configured week" : "Within configured week"}
        tone={sheet.overtime_hours > 0 ? "warning" : "neutral"}
        icon={<Flame className="h-3.5 w-3.5" />}
      />
      <MetricTile
        label="Anomalies"
        value={sheet.anomaly_count}
        sub={sheet.anomaly_severity ? `Highest: ${sheet.anomaly_severity}` : "All checks passed"}
        tone={sheet.has_anomalies ? "danger" : "success"}
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
      />
    </div>
  );
}

/** Blue information strip used for review notes and vendor comments. */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-2.5 text-xs text-brand-800">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function SectionCard({
  title,
  icon,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
        <div className="flex items-center gap-2 text-ink-900">
          {icon}
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}
