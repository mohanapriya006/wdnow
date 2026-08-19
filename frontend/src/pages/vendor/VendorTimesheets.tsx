/**
 * Vendor Timesheets: Projects -> Contractor -> Weekly reports.
 *
 * Weekly reports are split into NORMAL and ANOMALY tabs. Anomalies never block
 * a submission — the vendor reviews the detected findings and approves or
 * rejects, and a rejection always requires a reason.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FolderKanban,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import {
  projectTimesheetAnalytics,
  projectContractors,
  projectTimesheets,
  reviewTimesheet,
} from "@/api/timesheets";
import type { ContractorTimesheetSummary, ProjectTimesheetAnalytics, Timesheet } from "@/api/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";
import { PageLoader, EmptyState, Alert } from "@/components/ui/Feedback";
import { TimesheetStatusBadge } from "@/components/ui/Badge";
import { RiskReview } from "@/components/timesheets/RiskReview";
import {
  AnomalyPanel,
  CapacityBar,
  DailyEntriesTable,
  InfoNote,
  MetricTile,
  WeeklySummary,
} from "@/components/timesheets/TimesheetParts";
import { extractErrorMessage } from "@/api/client";
import { cn, formatCurrency, formatDate, initials } from "@/lib/utils";

type Tab = "NORMAL" | "ANOMALY";

type View = "RISK" | "PROJECTS";

export function VendorTimesheets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState<ProjectTimesheetAnalytics | null>(null);
  const [contractor, setContractor] = useState<ContractorTimesheetSummary | null>(null);

  // The dashboard risk panel links straight into the flagged view.
  const view: View = searchParams.get("view") === "projects" ? "PROJECTS" : "RISK";
  const flaggedOnly = searchParams.get("filter") === "flagged";

  const setView = (next: View) => {
    const params = new URLSearchParams(searchParams);
    if (next === "PROJECTS") params.set("view", "projects");
    else params.delete("view");
    params.delete("filter");
    setSearchParams(params, { replace: true });
    setProject(null);
    setContractor(null);
  };

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["timesheet-analytics"],
    queryFn: projectTimesheetAnalytics,
    enabled: view === "PROJECTS",
  });

  return (
    <div className="space-y-6">
      {view === "RISK" ? (
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Timesheets</h1>
          <p className="mt-1 text-sm text-ink-500">
            Contractor timesheet risk across the programme. Hours, conflicts and flags are
            calculated by the platform rule engine — you make the final decision.
          </p>
        </div>
      ) : (
        <Breadcrumbs
          project={project}
          contractor={contractor}
          onRoot={() => {
            setProject(null);
            setContractor(null);
          }}
          onProject={() => setContractor(null)}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <ViewTab active={view === "RISK"} onClick={() => setView("RISK")}>
          <ShieldAlert className="h-4 w-4" />
          Risk review
        </ViewTab>
        <ViewTab active={view === "PROJECTS"} onClick={() => setView("PROJECTS")}>
          <FolderKanban className="h-4 w-4" />
          By project
        </ViewTab>
      </div>

      {view === "RISK" ? (
        <RiskReview initialPreset={flaggedOnly ? "FLAGGED" : "ALL"} />
      ) : isLoading ? (
        <PageLoader />
      ) : (
        <>
          {!project && <ProjectGrid analytics={analytics || []} onSelect={setProject} />}

          {project && !contractor && (
            <ContractorList project={project} onSelect={setContractor} />
          )}

          {project && contractor && <WeeklyReports project={project} contractor={contractor} />}
        </>
      )}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand-500 bg-brand-50 text-brand-800"
          : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

function Breadcrumbs({
  project,
  contractor,
  onRoot,
  onProject,
}: {
  project: ProjectTimesheetAnalytics | null;
  contractor: ContractorTimesheetSummary | null;
  onRoot: () => void;
  onProject: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <button
          onClick={onRoot}
          className={cn(
            "font-medium transition-colors",
            project ? "text-ink-500 hover:text-brand-700" : "text-ink-900"
          )}
        >
          Timesheets
        </button>
        {project && (
          <>
            <ChevronRight className="h-4 w-4 text-ink-300" />
            <button
              onClick={onProject}
              className={cn(
                "font-medium transition-colors",
                contractor ? "text-ink-500 hover:text-brand-700" : "text-ink-900"
              )}
            >
              {project.project_name}
            </button>
          </>
        )}
        {contractor && (
          <>
            <ChevronRight className="h-4 w-4 text-ink-300" />
            <span className="font-medium text-ink-900">{contractor.contractor_name}</span>
          </>
        )}
      </div>
      <h1 className="mt-2 text-2xl font-bold text-ink-900">
        {contractor
          ? `${contractor.contractor_name} · Weekly reports`
          : project
            ? `${project.project_name} · Contractors`
            : "Timesheets · Projects"}
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        {contractor
          ? "Normal and anomaly reports, with every finding explained. Approve or reject with a reason."
          : project
            ? "Select a contractor to review their submitted weekly reports."
            : "Hours, overtime, utilisation and anomaly counts calculated from submitted database records."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Level 1: projects                                                   */
/* ------------------------------------------------------------------ */

function ProjectGrid({
  analytics,
  onSelect,
}: {
  analytics: ProjectTimesheetAnalytics[];
  onSelect: (p: ProjectTimesheetAnalytics) => void;
}) {
  const totals = useMemo(
    () => ({
      hours: analytics.reduce((n, a) => n + a.total_hours, 0),
      overtime: analytics.reduce((n, a) => n + a.overtime_hours, 0),
      pending: analytics.reduce((n, a) => n + a.pending_reports, 0),
      anomalies: analytics.reduce((n, a) => n + a.anomaly_reports, 0),
    }),
    [analytics]
  );

  if (!analytics.length) {
    return (
      <Card>
        <EmptyState
          title="No projects yet"
          description="Timesheet analytics appear once contractors are assigned to a project."
          icon={<FolderKanban className="h-6 w-6" />}
        />
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Total hours"
          value={`${Math.round(totals.hours * 100) / 100}h`}
          tone="brand"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <MetricTile
          label="Overtime"
          value={`${Math.round(totals.overtime * 100) / 100}h`}
          tone={totals.overtime ? "warning" : "neutral"}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <MetricTile
          label="Awaiting review"
          value={totals.pending}
          tone={totals.pending ? "warning" : "success"}
          icon={<ClipboardList className="h-3.5 w-3.5" />}
        />
        <MetricTile
          label="Anomaly reports"
          value={totals.anomalies}
          tone={totals.anomalies ? "danger" : "success"}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {analytics.map((a) => (
          <Card key={a.project_id} className="transition-colors hover:border-brand-400">
            <button className="w-full text-left" onClick={() => onSelect(a)}>
              <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">{a.project_name}</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
                    <Users className="h-3.5 w-3.5" />
                    {a.total_contractors} active contractor{a.total_contractors === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {a.pending_reports > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      {a.pending_reports} pending
                    </span>
                  )}
                  {a.anomaly_reports > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                      {a.anomaly_reports} anomaly
                    </span>
                  )}
                  {!a.pending_reports && !a.anomaly_reports && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      All clear
                    </span>
                  )}
                </div>
              </div>

              <CardContent className="space-y-4">
                <CapacityBar
                  regular={a.regular_hours}
                  overtime={a.overtime_hours}
                  capacity={Math.max(a.regular_hours + a.overtime_hours, 1)}
                  capacityLabel={null}
                />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs sm:grid-cols-3">
                  <Stat label="Total hours" value={`${a.total_hours}h`} />
                  <Stat label="Approved" value={`${a.approved_hours}h`} tone="success" />
                  <Stat label="Pending" value={`${a.pending_hours}h`} tone="warning" />
                  <Stat label="Utilisation" value={`${a.utilization}%`} />
                  <Stat label="Compliance" value={`${a.timesheet_compliance}%`} />
                  <Stat label="Labour cost" value={formatCurrency(a.labor_cost, "INR")} />
                </div>
              </CardContent>
            </button>
          </Card>
        ))}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const colour = {
    neutral: "text-ink-900",
    success: "text-emerald-700",
    warning: "text-amber-700",
  }[tone];
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className={cn("mt-0.5 text-sm font-bold tabular-nums", colour)}>{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Level 2: contractors on the project                                 */
/* ------------------------------------------------------------------ */

function ContractorList({
  project,
  onSelect,
}: {
  project: ProjectTimesheetAnalytics;
  onSelect: (c: ContractorTimesheetSummary) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["project-timesheet-contractors", project.project_id],
    queryFn: () => projectContractors(project.project_id),
  });

  if (isLoading) return <PageLoader />;
  if (!data?.length) {
    return (
      <Card>
        <EmptyState
          title="No contractors assigned"
          description="Assign a contractor to this project to start collecting timesheets."
          icon={<Users className="h-6 w-6" />}
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.map((c) => (
        <Card key={c.assignment_id} className="transition-colors hover:border-brand-400">
          <button className="w-full text-left" onClick={() => onSelect(c)}>
            <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {initials(c.contractor_name)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-ink-900">{c.contractor_name}</h3>
                <p className="truncate text-xs text-ink-500">
                  {c.role} · {c.weekly_capacity}h/week ·{" "}
                  {c.last_submitted_at
                    ? `Last submitted ${formatDate(c.last_submitted_at.slice(0, 10))}`
                    : "Nothing submitted yet"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
            </div>

            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SplitTile
                label="Normal"
                value={c.normal_reports}
                tone="success"
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
              />
              <SplitTile
                label="Anomaly"
                value={c.anomaly_reports}
                tone={c.anomaly_reports ? "danger" : "neutral"}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
              />
              <SplitTile
                label="Pending"
                value={c.pending_reports}
                tone={c.pending_reports ? "warning" : "neutral"}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
              <SplitTile
                label="Approved h"
                value={`${c.approved_hours}h`}
                tone="brand"
                icon={<BarChart3 className="h-3.5 w-3.5" />}
              />
            </CardContent>
          </button>
        </Card>
      ))}
    </div>
  );
}

function SplitTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "brand" | "success" | "warning" | "danger";
  icon: React.ReactNode;
}) {
  const tones = {
    neutral: "border-ink-200 bg-ink-50/60 text-ink-600",
    brand: "border-brand-200 bg-brand-50/60 text-brand-800",
    success: "border-emerald-200 bg-emerald-50/60 text-emerald-800",
    warning: "border-amber-200 bg-amber-50/60 text-amber-800",
    danger: "border-red-200 bg-red-50/60 text-red-800",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-3 py-2", tones)}>
      <div className="flex items-center gap-1.5 opacity-70">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 text-base font-bold leading-none tabular-nums">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Level 3: weekly reports, split normal vs anomaly                    */
/* ------------------------------------------------------------------ */

function WeeklyReports({
  project,
  contractor,
}: {
  project: ProjectTimesheetAnalytics;
  contractor: ContractorTimesheetSummary;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("NORMAL");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const { data: sheets, isLoading } = useQuery({
    queryKey: ["project-timesheets", project.project_id, contractor.contractor_id],
    queryFn: () => projectTimesheets(project.project_id, contractor.contractor_id),
  });

  const review = useMutation({
    mutationFn: ({ id, action, reason: r }: { id: string; action: "APPROVE" | "REJECT"; reason?: string }) =>
      reviewTimesheet(id, { action, reason: r }),
    onSuccess: () => {
      setRejecting(null);
      setReason("");
      setLocalError(null);
      qc.invalidateQueries({ queryKey: ["project-timesheets"] });
      qc.invalidateQueries({ queryKey: ["project-timesheet-contractors"] });
      qc.invalidateQueries({ queryKey: ["timesheet-analytics"] });
    },
  });

  const reviewable = useMemo(
    () => (sheets || []).filter((s) => s.display_status !== "DRAFT"),
    [sheets]
  );
  // Counted from the freshly fetched weeks rather than the parent's cached
  // summary, so the tiles move as soon as a report is approved or rejected.
  const counts = useMemo(
    () => ({
      pending: reviewable.filter((s) => s.display_status === "PENDING").length,
      approved: reviewable.filter((s) => s.display_status === "APPROVED").length,
      rejected: reviewable.filter((s) => s.display_status === "REJECTED").length,
    }),
    [reviewable]
  );
  const normal = reviewable.filter((s) => !s.has_anomalies);
  const anomaly = reviewable.filter((s) => s.has_anomalies);
  const visible = tab === "NORMAL" ? normal : anomaly;

  const startReject = (id: string) => {
    setRejecting(id);
    setReason("");
    setLocalError(null);
  };

  const confirmReject = (id: string) => {
    if (!reason.trim()) {
      setLocalError("A rejection reason is required.");
      return;
    }
    review.mutate({ id, action: "REJECT", reason: reason.trim() });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Weeks submitted" value={reviewable.length} tone="brand" icon={<ClipboardList className="h-3.5 w-3.5" />} />
        <MetricTile label="Awaiting review" value={counts.pending} tone={counts.pending ? "warning" : "success"} icon={<Clock className="h-3.5 w-3.5" />} />
        <MetricTile label="Approved" value={counts.approved} tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
        <MetricTile label="Rejected" value={counts.rejected} tone={counts.rejected ? "danger" : "neutral"} icon={<XCircle className="h-3.5 w-3.5" />} />
      </div>

      {/* Normal vs anomaly split -------------------------------------- */}
      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "NORMAL"} onClick={() => setTab("NORMAL")} tone="success" count={normal.length}>
          <ShieldCheck className="h-4 w-4" />
          Normal reports
        </TabButton>
        <TabButton active={tab === "ANOMALY"} onClick={() => setTab("ANOMALY")} tone="danger" count={anomaly.length}>
          <AlertTriangle className="h-4 w-4" />
          Anomaly reports
        </TabButton>
      </div>

      {review.isError && <Alert variant="error">{extractErrorMessage(review.error)}</Alert>}

      {!visible.length ? (
        <Card>
          <EmptyState
            title={tab === "NORMAL" ? "No clean reports" : "No anomaly reports"}
            description={
              tab === "NORMAL"
                ? "Weekly reports with no detected findings will appear here."
                : "Weeks with excessive hours, holiday work, overlaps or rule violations appear here."
            }
            icon={tab === "NORMAL" ? <ShieldCheck className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((s) => (
            <ReportCard
              key={s.id}
              sheet={s}
              rejecting={rejecting === s.id}
              reason={reason}
              onReasonChange={setReason}
              localError={rejecting === s.id ? localError : null}
              busy={review.isPending}
              onApprove={() => review.mutate({ id: s.id, action: "APPROVE" })}
              onStartReject={() => startReject(s.id)}
              onCancelReject={() => setRejecting(null)}
              onConfirmReject={() => confirmReject(s.id)}
            />
          ))}
        </div>
      )}

      {(sheets || []).some((s) => s.display_status === "DRAFT") && (
        <InfoNote>
          {(sheets || []).filter((s) => s.display_status === "DRAFT").length} week(s) are still in
          draft with this contractor and are not yet available for review.
        </InfoNote>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  tone,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: "success" | "danger";
  count: number;
  children: React.ReactNode;
}) {
  const activeTone =
    tone === "success"
      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
      : "border-red-500 bg-red-50 text-red-800";
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
        active ? activeTone : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
      )}
    >
      {children}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
          active ? "bg-white/70" : "bg-ink-100"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ReportCard({
  sheet,
  rejecting,
  reason,
  onReasonChange,
  localError,
  busy,
  onApprove,
  onStartReject,
  onCancelReject,
  onConfirmReject,
}: {
  sheet: Timesheet;
  rejecting: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
  localError: string | null;
  busy: boolean;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onConfirmReject: () => void;
}) {
  const decided = sheet.display_status === "APPROVED";

  return (
    <Card className={cn(sheet.has_anomalies && "border-red-200")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-900">
              {formatDate(sheet.week_start)} — {formatDate(sheet.week_end)}
            </h3>
            <TimesheetStatusBadge status={sheet.display_status} />
            {sheet.has_anomalies && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                <AlertTriangle className="h-3 w-3" />
                {sheet.anomaly_count} finding{sheet.anomaly_count > 1 ? "s" : ""} ·{" "}
                {sheet.anomaly_severity}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Submitted{" "}
            {sheet.submitted_at ? formatDate(sheet.submitted_at.slice(0, 10)) : "—"} ·{" "}
            {sheet.days_logged} day{sheet.days_logged === 1 ? "" : "s"} ·{" "}
            {formatCurrency(sheet.compensation, sheet.currency)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-ink-900">{sheet.total_hours}h</p>
          <p className="text-[11px] text-ink-500">
            {sheet.regular_hours} reg / {sheet.overtime_hours} OT
          </p>
        </div>
      </div>

      <CardContent className="space-y-5">
        <WeeklySummary sheet={sheet} />
        <CapacityBar
          regular={sheet.regular_hours}
          overtime={sheet.overtime_hours}
          capacity={sheet.weekly_capacity}
        />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            Daily entries
          </p>
          <DailyEntriesTable entries={sheet.entries} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            Detected anomalies
          </p>
          <AnomalyPanel anomalies={sheet.anomalies} />
        </div>

        {sheet.contractor_summary && (
          <InfoNote>Contractor note: {sheet.contractor_summary}</InfoNote>
        )}

        {sheet.display_status === "REJECTED" && sheet.rejection_reason && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Rejected</p>
              <p className="mt-0.5 text-xs">{sheet.rejection_reason}</p>
            </div>
          </div>
        )}

        {decided ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Approved{sheet.approved_at ? ` on ${formatDate(sheet.approved_at.slice(0, 10))}` : ""}.
              These hours are locked and available for invoicing.
            </span>
          </div>
        ) : rejecting ? (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/60 p-4">
            {localError && <Alert variant="error">{localError}</Alert>}
            <div>
              <Label>Rejection reason (required)</Label>
              <Textarea
                rows={2}
                autoFocus
                placeholder="Explain what the contractor needs to correct"
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                isLoading={busy}
                onClick={onConfirmReject}
                icon={<XCircle className="h-4 w-4" />}
              >
                Confirm rejection
              </Button>
              <Button variant="outline" onClick={onCancelReject} icon={<ArrowLeft className="h-4 w-4" />}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
            <Button
              onClick={onApprove}
              isLoading={busy}
              className="bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Approve
            </Button>
            <Button variant="danger" onClick={onStartReject} icon={<XCircle className="h-4 w-4" />}>
              Reject
            </Button>
          </div>
        )}

        {sheet.audit_history.length > 0 && (
          <details className="text-xs text-ink-500">
            <summary className="cursor-pointer font-medium">Audit trail</summary>
            <ul className="mt-2 space-y-1">
              {sheet.audit_history.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
