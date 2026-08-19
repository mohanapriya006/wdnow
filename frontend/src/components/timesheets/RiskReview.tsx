/**
 * Contractor timesheet risk review.
 *
 * Everything rendered here was decided by the backend rule engine: the flag, the
 * severity, the reported hours and the overlap durations all arrive calculated.
 * The AI panel only asks the server to put those findings into words.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { timesheetRiskBoard, reviewTimesheet, type RiskFilters } from "@/api/timesheets";
import { explainTimesheetRisk } from "@/api/ai";
import type {
  Anomaly,
  AnomalySeverity,
  FlagStatus,
  RiskDay,
  TimesheetRisk,
} from "@/api/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Alert, EmptyState, PageLoader, Spinner } from "@/components/ui/Feedback";
import { SeverityBadge, TimesheetStatusBadge } from "@/components/ui/Badge";
import { MetricTile } from "@/components/timesheets/TimesheetParts";
import { extractErrorMessage } from "@/api/client";
import { cn, formatDate } from "@/lib/utils";

type Preset = "ALL" | "FLAGGED" | "CRITICAL" | "HIGH" | "CLEAN";

const PRESETS: { key: Preset; label: string; filters: RiskFilters }[] = [
  { key: "ALL", label: "All", filters: {} },
  { key: "FLAGGED", label: "Flagged", filters: { flag: "FLAGGED" } },
  { key: "CRITICAL", label: "Critical", filters: { severity: "CRITICAL" } },
  { key: "HIGH", label: "High", filters: { severity: "HIGH" } },
  { key: "CLEAN", label: "Clean", filters: { flag: "CLEAN" } },
];

const ANOMALY_LABELS: Record<string, string> = {
  OVER_24_HOURS: "Reported hours exceed a calendar day",
  OVERLAPPING_ASSIGNMENTS: "Overlapping assignment timelines",
  DUPLICATE_TIME_ENTRY: "Duplicate time entry across assignments",
  EXCESSIVE_DAILY_HOURS: "Unusually long working day",
  EXCESSIVE_WEEKLY_HOURS: "Unusually long working week",
  ASSIGNMENT_HOUR_LIMIT_EXCEEDED: "Assignment hour limit exceeded",
  OVERLAPPING_ENTRY: "Overlapping entries on one assignment",
  MISSING_END_TIME: "Missing end time",
  INVALID_END_TIME: "Invalid end time",
  HOLIDAY_WORK: "Work on a non-working day",
  TIME_RULE_VIOLATION: "Configured time-rule violation",
};

export function FlagPill({ status }: { status: FlagStatus }) {
  const map: Record<FlagStatus, { cls: string; dot: string; label: string }> = {
    FLAGGED: {
      cls: "bg-red-50 text-red-700 ring-red-600/20",
      dot: "bg-red-500",
      label: "FLAGGED",
    },
    WARNING: {
      cls: "bg-amber-50 text-amber-700 ring-amber-600/20",
      dot: "bg-amber-500",
      label: "WARNING",
    },
    CLEAN: {
      cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
      dot: "bg-emerald-500",
      label: "CLEAN",
    },
  };
  const s = map[status] ?? map.CLEAN;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
        s.cls
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

export function RiskReview({ initialPreset = "ALL" }: { initialPreset?: Preset }) {
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const filters: RiskFilters = {
    ...(PRESETS.find((p) => p.key === preset)?.filters ?? {}),
    q: search || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["timesheet-risk", filters],
    queryFn: () => timesheetRiskBoard(filters),
  });

  if (isLoading) return <PageLoader />;
  const summary = data?.summary;
  const rows = data?.timesheets ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Critical"
          value={summary?.critical ?? 0}
          sub="Impossible or conflicting hours"
          tone={summary?.critical ? "danger" : "success"}
          icon={<TriangleAlert className="h-3.5 w-3.5" />}
        />
        <MetricTile
          label="High"
          value={summary?.high ?? 0}
          sub="Requires vendor review"
          tone={summary?.high ? "danger" : "success"}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <MetricTile
          label="Medium"
          value={summary?.medium ?? 0}
          sub="Worth a look"
          tone={summary?.medium ? "warning" : "neutral"}
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <MetricTile
          label="Clean"
          value={summary?.clean ?? 0}
          sub={`${summary?.total ?? 0} submitted timesheet(s)`}
          tone="success"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
        />
      </div>

      {(summary?.flagged ?? 0) > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>
              {summary?.flagged} contractor timesheet
              {summary?.flagged === 1 ? "" : "s"} require review.
            </b>{" "}
            Hours and conflicts below were calculated by the platform; the decision is yours.
          </span>
        </div>
      )}

      {/* Filters ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
          <Filter className="h-3.5 w-3.5" />
          Filter
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              preset === p.key
                ? "border-brand-500 bg-brand-50 text-brand-800"
                : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
            )}
          >
            {p.label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            className="pl-9"
            placeholder="Contractor or project name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(search || preset !== "ALL") && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => {
              setSearch("");
              setPreset("ALL");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {!rows.length ? (
        <Card>
          <EmptyState
            title="No timesheets match this view"
            description="Submitted contractor timesheets appear here with their risk status."
            icon={<ShieldCheck className="h-6 w-6" />}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <RiskRow
              key={row.timesheet_id}
              row={row}
              open={open === row.timesheet_id}
              onToggle={() =>
                setOpen(open === row.timesheet_id ? null : row.timesheet_id)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One contractor timesheet                                            */
/* ------------------------------------------------------------------ */

function RiskRow({
  row,
  open,
  onToggle,
}: {
  row: TimesheetRisk;
  open: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const [reasonFor, setReasonFor] = useState<"REJECT" | "REQUEST_CORRECTION" | null>(null);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const decide = useMutation({
    mutationFn: (payload: { action: "APPROVE" | "REJECT" | "REQUEST_CORRECTION"; reason?: string }) =>
      reviewTimesheet(row.timesheet_id, payload),
    onSuccess: () => {
      setReasonFor(null);
      setReason("");
      setLocalError(null);
      qc.invalidateQueries({ queryKey: ["timesheet-risk"] });
      qc.invalidateQueries({ queryKey: ["project-timesheets"] });
      qc.invalidateQueries({ queryKey: ["vendor-dashboard"] });
    },
  });

  const submitReason = () => {
    if (!reason.trim()) {
      setLocalError(
        reasonFor === "REJECT"
          ? "A rejection reason is required."
          : "Tell the contractor what to correct."
      );
      return;
    }
    decide.mutate({ action: reasonFor!, reason: reason.trim() });
  };

  const pending = row.display_status === "PENDING";
  const conflicted = row.days.filter((d) => d.multi_project || d.overlaps.length > 0);

  return (
    <Card className={cn(row.flag_status === "FLAGGED" && "border-red-200")}>
      <button
        onClick={onToggle}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink-900">{row.contractor_name}</span>
            <FlagPill status={row.flag_status} />
            {row.severity && <SeverityBadge severity={row.severity as AnomalySeverity} />}
            <TimesheetStatusBadge status={row.display_status} />
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {row.projects_involved.join(" · ")} — week {formatDate(row.week_start)} to{" "}
            {formatDate(row.week_end)}
          </p>
          {row.flag_reason && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {row.flag_reason}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-base font-bold tabular-nums text-ink-900">{row.total_hours}h</p>
            <p className="text-[11px] text-ink-500">
              peak day {row.max_daily_hours}h
            </p>
          </div>
          <ChevronRight
            className={cn("h-4 w-4 text-ink-300 transition-transform", open && "rotate-90")}
          />
        </div>
      </button>

      {open && (
        <CardContent className="space-y-5 border-t border-ink-100">
          {/* Header facts ----------------------------------------- */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Contractor" value={row.contractor_name} tone="neutral" />
            <MetricTile
              label="Reported hours"
              value={`${row.total_hours}h`}
              sub={`${row.regular_hours} regular / ${row.overtime_hours} overtime`}
              tone="brand"
            />
            <MetricTile
              label="Peak calendar day"
              value={`${row.max_daily_hours}h`}
              sub="Daily maximum is 24h"
              tone={row.max_daily_hours > 24 ? "danger" : "neutral"}
            />
            <MetricTile
              label="Findings"
              value={row.anomaly_count}
              sub={row.severity ? `Highest: ${row.severity}` : "All checks passed"}
              tone={row.flag_status === "FLAGGED" ? "danger" : "success"}
            />
          </div>

          {/* Reasons ---------------------------------------------- */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
              Reasons
            </p>
            {!row.anomalies.length ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                No anomalies detected on this timesheet.
              </div>
            ) : (
              <div className="space-y-2">
                {row.anomalies.map((a, i) => (
                  <ReasonCard key={`${a.type}-${a.date}-${i}`} anomaly={a} />
                ))}
              </div>
            )}
          </section>

          {/* Assignment timelines --------------------------------- */}
          {conflicted.length > 0 && (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
                <Layers className="h-3.5 w-3.5" />
                Assignment timeline
              </p>
              <div className="space-y-4">
                {conflicted.map((day) => (
                  <DayTimeline key={day.date} day={day} />
                ))}
              </div>
            </section>
          )}

          {/* AI ---------------------------------------------------- */}
          <AiAnalysis timesheetId={row.timesheet_id} />

          {/* Vendor decision -------------------------------------- */}
          <section className="border-t border-ink-100 pt-4">
            {decide.isError && <Alert variant="error">{extractErrorMessage(decide.error)}</Alert>}
            {!pending ? (
              <p className="text-xs text-ink-500">
                This timesheet is {row.display_status.toLowerCase()}. Only a timesheet awaiting
                review can be actioned.
              </p>
            ) : reasonFor ? (
              <div className="space-y-3 rounded-lg border border-ink-200 bg-ink-50/60 p-4">
                {localError && <Alert variant="error">{localError}</Alert>}
                <div>
                  <Label>
                    {reasonFor === "REJECT"
                      ? "Rejection reason (required)"
                      : "What should the contractor correct? (required)"}
                  </Label>
                  <Textarea
                    rows={2}
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      reasonFor === "REJECT"
                        ? "Why is this timesheet being rejected?"
                        : "Ask the contractor to confirm the conflicting entries."
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={reasonFor === "REJECT" ? "danger" : "primary"}
                    isLoading={decide.isPending}
                    onClick={submitReason}
                  >
                    {reasonFor === "REJECT" ? "Confirm rejection" : "Send back for correction"}
                  </Button>
                  <Button variant="outline" onClick={() => setReasonFor(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  isLoading={decide.isPending}
                  onClick={() => decide.mutate({ action: "APPROVE" })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon={<XCircle className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setReasonFor("REJECT");
                    setReason("");
                    setLocalError(null);
                  }}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<CalendarClock className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setReasonFor("REQUEST_CORRECTION");
                    setReason("");
                    setLocalError(null);
                  }}
                >
                  Request correction
                </Button>
              </div>
            )}
          </section>
        </CardContent>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

function ReasonCard({ anomaly }: { anomaly: Anomaly }) {
  const tone: Record<AnomalySeverity, string> = {
    CRITICAL: "border-red-300 bg-red-50 text-red-800",
    HIGH: "border-red-200 bg-red-50/70 text-red-800",
    MEDIUM: "border-amber-200 bg-amber-50/70 text-amber-800",
    LOW: "border-brand-200 bg-brand-50/70 text-brand-800",
  };
  return (
    <div className={cn("rounded-lg border px-4 py-3", tone[anomaly.severity])}>
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-semibold">
          {ANOMALY_LABELS[anomaly.type] ?? anomaly.type.replace(/_/g, " ")}
        </span>
        <SeverityBadge severity={anomaly.severity} />
        <span className="ml-auto text-xs font-medium opacity-80">
          {formatDate(anomaly.date)}
          {anomaly.reported_hours != null && ` · ${anomaly.reported_hours}h reported`}
          {anomaly.maximum_hours != null && ` · max ${anomaly.maximum_hours}h`}
          {anomaly.overlap_hours ? ` · ${anomaly.overlap_hours}h overlap` : ""}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed opacity-90">{anomaly.reason}</p>
    </div>
  );
}

/** Proportional bars showing where two assignments claim the same clock time. */
function DayTimeline({ day }: { day: RiskDay }) {
  const toMinutes = (hhmm: string | null) => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const spans = day.entries.filter((e) => e.start && e.end);
  const min = Math.min(...spans.map((e) => toMinutes(e.start)), 24 * 60);
  const max = Math.max(...spans.map((e) => toMinutes(e.end)), 0);
  const range = Math.max(max - min, 60);

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink-900">{formatDate(day.date)}</p>
        <p
          className={cn(
            "text-xs font-semibold tabular-nums",
            day.reported_hours > day.maximum_hours ? "text-red-700" : "text-ink-600"
          )}
        >
          {day.reported_hours}h reported · daily maximum {day.maximum_hours}h
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {spans.map((e) => {
          const left = ((toMinutes(e.start) - min) / range) * 100;
          const width = ((toMinutes(e.end) - toMinutes(e.start)) / range) * 100;
          return (
            <div key={e.entry_id} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3">
              <span className="truncate text-xs font-medium text-ink-700" title={e.project}>
                {e.project}
              </span>
              <div className="relative h-6 rounded bg-ink-100">
                <div
                  className="absolute inset-y-0 flex items-center justify-center rounded bg-brand-500 px-1 text-[10px] font-semibold text-white"
                  style={{ left: `${left}%`, width: `${Math.max(width, 8)}%` }}
                  title={`${e.start} – ${e.end}`}
                >
                  {e.start}–{e.end}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {day.overlaps.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-ink-100 pt-2.5">
          {day.overlaps.map((o, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {o.assignments.map((a) => `${a.project} (${a.start}–${a.end})`).join("  ↔  ")}
                {" — overlap "}
                <b>{o.overlap_hours}h</b>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI panel                                                            */
/* ------------------------------------------------------------------ */

function AiAnalysis({ timesheetId }: { timesheetId: string }) {
  const [enabled, setEnabled] = useState(false);
  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["timesheet-ai", timesheetId],
    queryFn: () => explainTimesheetRisk(timesheetId),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  if (!enabled) {
    return (
      <section className="rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-brand-800">
            <Sparkles className="h-4 w-4" />
            Get a plain-language explanation of the findings above.
          </p>
          <Button size="sm" icon={<Bot className="h-3.5 w-3.5" />} onClick={() => setEnabled(true)}>
            Analyze with AI
          </Button>
        </div>
      </section>
    );
  }

  if (isFetching) {
    return (
      <section className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-4 text-sm text-brand-800">
        <Spinner className="h-4 w-4" />
        Analyzing contractor timesheet…
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="space-y-2">
        <Alert variant="error">{extractErrorMessage(error)}</Alert>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-brand-200 bg-brand-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-200 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-900">
          <Bot className="h-4 w-4" />
          AI timesheet risk analysis
        </p>
        <div className="flex items-center gap-2">
          {data.generated_offline && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              Offline explanation
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset",
              data.risk_level === "CRITICAL"
                ? "bg-red-50 text-red-700 ring-red-600/20"
                : data.risk_level === "HIGH"
                  ? "bg-red-50 text-red-700 ring-red-600/20"
                  : data.risk_level === "MEDIUM"
                    ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
            )}
          >
            Risk level: {data.risk_level}
          </span>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3 text-sm text-ink-800">
        <p className="font-semibold text-ink-900">{data.title}</p>
        <p className="leading-relaxed">{data.summary}</p>

        {data.reasons.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Detected reasons
            </p>
            <ul className="mt-1.5 space-y-1">
              {data.reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed">
                  <span className="text-brand-500">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.overlap_summary && (
          <div className="rounded-md bg-white/70 px-3 py-2 text-xs">
            <span className="font-semibold text-ink-700">Overlaps: </span>
            {data.overlap_summary}
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Recommendation
          </p>
          <p className="mt-1 text-xs leading-relaxed">{data.recommendation}</p>
        </div>

        <p className="border-t border-brand-200 pt-2 text-[11px] italic text-ink-500">
          {data.disclaimer} The vendor makes the final decision.
        </p>
      </div>
    </section>
  );
}
