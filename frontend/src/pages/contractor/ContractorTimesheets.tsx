/**
 * Contractor Timesheets.
 *
 * The contractor logs a start and end time for today; the backend validates the
 * pair, calculates the hours, stores them and re-runs anomaly detection. Every
 * number on this screen comes back from the API — nothing is computed here.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Send,
  XCircle,
} from "lucide-react";
import { myTimesheets, logTime, submitTimesheet, deleteTimeEntry } from "@/api/timesheets";
import { getMyContractorAssignments } from "@/api/contractors";
import type { Timesheet } from "@/api/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { PageLoader, Alert, EmptyState } from "@/components/ui/Feedback";
import { TimesheetStatusBadge } from "@/components/ui/Badge";
import {
  AnomalyPanel,
  CapacityBar,
  DailyEntriesTable,
  InfoNote,
  MetricTile,
  SectionCard,
  WeeklySummary,
} from "@/components/timesheets/TimesheetParts";
import { extractErrorMessage } from "@/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";

/** Local calendar date as YYYY-MM-DD. toISOString() would give the UTC day,
 *  which is the previous date for anyone east of Greenwich late in the evening. */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const emptyForm = {
  start_time: "09:00",
  end_time: "17:00",
  break_minutes: 0,
  work_location: "",
  notes: "",
};

/** Preview only — the stored value is whatever the backend calculates. */
function previewHours(start: string, end: string, breakMinutes: number): number | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm) - (breakMinutes || 0);
  if (minutes <= 0) return null;
  return Math.round((minutes / 60) * 100) / 100;
}

export function ContractorTimesheets() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [summary, setSummary] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: sheets, isLoading } = useQuery({
    queryKey: ["my-timesheets"],
    queryFn: myTimesheets,
  });
  // A contractor may hold several concurrent assignments, so the day must be
  // attributed to one of them explicitly.
  const { data: assignments } = useQuery({
    queryKey: ["contractor-assignments"],
    queryFn: getMyContractorAssignments,
  });
  const [assignmentId, setAssignmentId] = useState("");
  const active = (assignments ?? []).find((a) => a.id === assignmentId) ?? assignments?.[0];

  useEffect(() => {
    if (!assignmentId && assignments?.length) setAssignmentId(assignments[0].id);
  }, [assignments, assignmentId]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["my-timesheets"] });
  const save = useMutation({ mutationFn: logTime, onSuccess: () => { setForm(emptyForm); refresh(); } });
  const remove = useMutation({ mutationFn: deleteTimeEntry, onSuccess: refresh });
  const submit = useMutation({
    mutationFn: (id: string) => submitTimesheet(id, summary || undefined),
    onSuccess: () => { setSummary(""); refresh(); },
  });

  const workDate = today();
  const preview = previewHours(form.start_time, form.end_time, form.break_minutes);

  const currentWeek = useMemo(
    () => (sheets || []).find((s) => s.week_start <= workDate && workDate <= s.week_end),
    [sheets, workDate]
  );
  const history = useMemo(
    () => (sheets || []).filter((s) => s.id !== currentWeek?.id),
    [sheets, currentWeek]
  );

  const totals = useMemo(() => {
    const list = sheets || [];
    return {
      approved: list.filter((s) => s.display_status === "APPROVED").length,
      pending: list.filter((s) => s.display_status === "PENDING").length,
      rejected: list.filter((s) => s.display_status === "REJECTED").length,
      anomalies: list.reduce((n, s) => n + s.anomaly_count, 0),
    };
  }, [sheets]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Timesheets</h1>
        <p className="mt-1 text-sm text-ink-500">
          Log your start and end time each day. Hours, overtime and anomalies are calculated by
          the platform and reviewed by your vendor.
        </p>
      </div>

      {!assignments?.length ? (
        <Card>
          <EmptyState
            title="On bench"
            description="You can log time once you are assigned to a project."
            icon={<CalendarDays className="h-6 w-6" />}
          />
        </Card>
      ) : (
        <>
          {/* Portfolio strip -------------------------------------------- */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="Weeks approved"
              value={totals.approved}
              tone="success"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            />
            <MetricTile
              label="Awaiting review"
              value={totals.pending}
              tone="warning"
              icon={<Clock className="h-3.5 w-3.5" />}
            />
            <MetricTile
              label="Rejected"
              value={totals.rejected}
              tone={totals.rejected ? "danger" : "neutral"}
              icon={<XCircle className="h-3.5 w-3.5" />}
            />
            <MetricTile
              label="Open anomalies"
              value={totals.anomalies}
              tone={totals.anomalies ? "danger" : "success"}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Daily entry form ------------------------------------------- */}
          <SectionCard
            title={`Log today${active ? ` · ${active.project_name}` : ""}`}
            icon={<Clock className="h-4 w-4 text-brand-600" />}
            actions={
              <span className="text-xs font-medium text-ink-500">
                {active?.role} · {active?.working_hours}h/week
              </span>
            }
          >
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate({
                  work_date: workDate,
                  assignment_id: assignmentId || undefined,
                  start_time: form.start_time,
                  end_time: form.end_time,
                  break_minutes: Number(form.break_minutes) || 0,
                  work_location: form.work_location || undefined,
                  notes: form.notes || undefined,
                });
              }}
            >
              {save.isError && <Alert variant="error">{extractErrorMessage(save.error)}</Alert>}

              {(assignments?.length ?? 0) > 1 && (
                <div>
                  <Label>Project</Label>
                  <Select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
                    {assignments!.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.project_name} — {a.role} ({a.working_hours}h/week)
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-[11px] text-ink-400">
                    You are on {assignments!.length} projects. Pick the one this day belongs to —
                    hours that overlap across projects are flagged for your vendor.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={workDate} readOnly disabled className="bg-ink-50 text-ink-500" />
                  <p className="mt-1 text-[11px] text-ink-400">Locked to today</p>
                </div>
                <div>
                  <Label>Start time</Label>
                  <Input
                    type="time"
                    required
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End time</Label>
                  <Input
                    type="time"
                    required
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Break (minutes)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="720"
                    value={form.break_minutes}
                    onChange={(e) => setForm({ ...form, break_minutes: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Work location</Label>
                  <Input
                    placeholder="Remote / Client site"
                    value={form.work_location}
                    onChange={(e) => setForm({ ...form, work_location: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  placeholder="What did you work on?"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-brand-800">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Calculated hours</span>
                  <span className="text-lg font-bold tabular-nums">
                    {preview === null ? "—" : `${preview}h`}
                  </span>
                  {preview === null && (
                    <span className="text-xs opacity-80">End time must be after start time</span>
                  )}
                </div>
                <Button isLoading={save.isPending} icon={<Send className="h-4 w-4" />}>
                  Save daily entry
                </Button>
              </div>
            </form>
          </SectionCard>

          {/* Current week ----------------------------------------------- */}
          {currentWeek && (
            <WeekCard
              sheet={currentWeek}
              open
              summary={summary}
              onSummaryChange={setSummary}
              onSubmit={() => submit.mutate(currentWeek.id)}
              submitting={submit.isPending}
              submitError={submit.isError ? extractErrorMessage(submit.error) : null}
              onDeleteEntry={(id) => remove.mutate(id)}
              deletingId={remove.isPending ? remove.variables ?? null : null}
              deleteError={remove.isError ? extractErrorMessage(remove.error) : null}
            />
          )}

          {/* History ---------------------------------------------------- */}
          {history.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                Previous weekly reports
              </h2>
              {history.map((s) => (
                <WeekCard
                  key={s.id}
                  sheet={s}
                  open={expanded === s.id}
                  onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                  summary={summary}
                  onSummaryChange={setSummary}
                  onSubmit={() => submit.mutate(s.id)}
                  submitting={submit.isPending}
                  submitError={null}
                  onDeleteEntry={(id) => remove.mutate(id)}
                  deletingId={remove.isPending ? remove.variables ?? null : null}
                  deleteError={null}
                />
              ))}
            </div>
          )}

          {!currentWeek && !history.length && (
            <Card>
              <EmptyState
                title="No time logged yet"
                description="Save your first daily entry above to start this week's report."
                icon={<Clock className="h-6 w-6" />}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One weekly report                                                   */
/* ------------------------------------------------------------------ */

function WeekCard({
  sheet,
  open,
  onToggle,
  summary,
  onSummaryChange,
  onSubmit,
  submitting,
  submitError,
  onDeleteEntry,
  deletingId,
  deleteError,
}: {
  sheet: Timesheet;
  open?: boolean;
  onToggle?: () => void;
  summary: string;
  onSummaryChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
  onDeleteEntry: (id: string) => void;
  deletingId: string | null;
  deleteError: string | null;
}) {
  const editable = sheet.display_status === "DRAFT" || sheet.display_status === "REJECTED";

  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4 text-left disabled:cursor-default"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-900">
              {formatDate(sheet.week_start)} — {formatDate(sheet.week_end)}
            </h3>
            <TimesheetStatusBadge status={sheet.display_status} />
            {sheet.has_anomalies && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                <AlertTriangle className="h-3 w-3" />
                {sheet.anomaly_count} anomaly{sheet.anomaly_count > 1 ? " findings" : ""}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {sheet.project_name} · {sheet.total_hours}h total ·{" "}
            {sheet.submitted_at
              ? `Submitted ${formatDate(sheet.submitted_at.slice(0, 10))}`
              : "Not submitted"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-ink-900">{sheet.total_hours}h</p>
          <p className="text-[11px] text-ink-500">
            {formatCurrency(sheet.compensation, sheet.currency)}
          </p>
        </div>
      </button>

      {open !== false && (
        <CardContent className="space-y-5">
          <WeeklySummary sheet={sheet} />
          <CapacityBar
            regular={sheet.regular_hours}
            overtime={sheet.overtime_hours}
            capacity={sheet.weekly_capacity}
          />

          {sheet.display_status === "REJECTED" && sheet.rejection_reason && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Rejected by vendor</p>
                <p className="mt-0.5 text-xs">{sheet.rejection_reason}</p>
                <p className="mt-1 text-[11px] opacity-80">
                  Edit an entry to reopen this week, then resubmit.
                </p>
              </div>
            </div>
          )}

          {sheet.display_status === "APPROVED" && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Approved by vendor</p>
                {sheet.vendor_comment && <p className="mt-0.5 text-xs">{sheet.vendor_comment}</p>}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
              Daily entries
            </p>
            {deleteError && <Alert variant="error">{deleteError}</Alert>}
            <DailyEntriesTable
              entries={sheet.entries}
              onDelete={editable ? onDeleteEntry : undefined}
              deletingId={deletingId}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
              Anomaly review
            </p>
            <AnomalyPanel anomalies={sheet.anomalies} />
          </div>

          {sheet.contractor_summary && <InfoNote>Your note: {sheet.contractor_summary}</InfoNote>}

          {editable && sheet.entries.length > 0 && (
            <div className="space-y-3 rounded-lg border border-ink-200 bg-ink-50/60 p-4">
              {submitError && <Alert variant="error">{submitError}</Alert>}
              <div>
                <Label>Summary for your vendor (optional)</Label>
                <Textarea
                  rows={2}
                  placeholder="Anything the reviewer should know about this week"
                  value={summary}
                  onChange={(e) => onSummaryChange(e.target.value)}
                />
              </div>
              {sheet.has_anomalies && (
                <p className="text-xs text-amber-700">
                  This week has {sheet.anomaly_count} anomaly finding
                  {sheet.anomaly_count > 1 ? "s" : ""}. You can still submit — your vendor reviews
                  and decides.
                </p>
              )}
              <Button
                onClick={onSubmit}
                isLoading={submitting}
                icon={<ClipboardCheck className="h-4 w-4" />}
              >
                Submit weekly report
              </Button>
            </div>
          )}

          {sheet.audit_history.length > 0 && (
            <details className="text-xs text-ink-500">
              <summary className="cursor-pointer font-medium">Activity history</summary>
              <ul className="mt-2 space-y-1">
                {sheet.audit_history.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      )}
    </Card>
  );
}
