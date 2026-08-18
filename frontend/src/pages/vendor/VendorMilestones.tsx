/**
 * Vendor Milestones — delivery analytics.
 *
 * Portfolio health, per-project progress, upcoming deadlines, recent delivery
 * activity and a filterable milestone table. Every number is aggregated
 * server-side from the Milestone / Project / Assignment / TimeEntry records.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Filter,
  FolderKanban,
  Gauge,
  Search,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { milestoneDashboard } from "@/api/milestones";
import { updateMilestone } from "@/api/projects";
import type {
  MilestoneDashboard,
  MilestoneRisk,
  MilestoneStatus,
  ProjectMilestoneProgress,
} from "@/api/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { RiskBadge } from "@/components/ui/Badge";
import { MoneyTile, SectionCard } from "@/components/invoices/InvoiceParts";
import { extractErrorMessage } from "@/api/client";
import { cn, formatDate } from "@/lib/utils";

interface Filters {
  project_id?: string;
  status?: MilestoneStatus;
  risk?: MilestoneRisk;
  q?: string;
}

export function VendorMilestones() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});

  const { data, isLoading } = useQuery({
    queryKey: ["milestone-dashboard", filters],
    queryFn: () => milestoneDashboard(filters),
  });

  const change = useMutation({
    mutationFn: ({ projectId, id, status }: { projectId: string; id: string; status: string }) =>
      updateMilestone(projectId, id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestone-dashboard"] });
      qc.invalidateQueries({ queryKey: ["vendor-projects"] });
    },
  });

  if (isLoading) return <PageLoader />;
  const d: MilestoneDashboard = data ?? {
    total_projects: 0, total_milestones: 0, completed: 0, in_progress: 0, upcoming: 0,
    overdue: 0, at_risk: 0, completion_percent: 0, on_time_percent: null,
    projects: [], upcoming_deadlines: [], recent_activity: [], milestones: [],
  };

  const set = (patch: Filters) => setFilters({ ...filters, ...patch });
  const hasFilters = Object.values(filters).some(Boolean);

  if (!d.total_milestones && !hasFilters) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <EmptyState
            title="No milestones defined"
            description="Add milestones to a project and the delivery dashboard will populate here."
            icon={<Target className="h-6 w-6" />}
            action={
              <Link to="/vendor/projects">
                <Button>Go to Projects &amp; Workforce</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      {/* Portfolio health -------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyTile label="Completion" value={`${d.completion_percent}%`}
          sub={`${d.completed} of ${d.total_milestones} milestones`} tone="brand"
          icon={<Gauge className="h-3.5 w-3.5" />} />
        <MoneyTile label="On-time delivery"
          value={d.on_time_percent != null ? `${d.on_time_percent}%` : "—"}
          sub={d.on_time_percent != null ? "Of completed milestones" : "Nothing delivered yet"}
          tone={d.on_time_percent != null && d.on_time_percent >= 80 ? "success" : "warning"}
          icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <MoneyTile label="Overdue" value={d.overdue}
          sub={d.overdue ? "Past the planned date" : "Nothing past due"}
          tone={d.overdue ? "danger" : "success"}
          icon={<AlertTriangle className="h-3.5 w-3.5" />} />
        <MoneyTile label="At risk" value={d.at_risk}
          sub="Due soon and not started" tone={d.at_risk ? "warning" : "success"}
          icon={<CalendarClock className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatusChip label="Completed" value={d.completed} total={d.total_milestones} tone="emerald" />
        <StatusChip label="In progress" value={d.in_progress} total={d.total_milestones} tone="brand" />
        <StatusChip label="Upcoming" value={d.upcoming} total={d.total_milestones} tone="slate" />
        <StatusChip label="Overdue" value={d.overdue} total={d.total_milestones} tone="red" />
      </div>

      {/* Per-project progress ---------------------------------------- */}
      <SectionCard
        title={`Project delivery (${d.projects.filter((p) => p.total_milestones).length})`}
        icon={<FolderKanban className="h-4 w-4 text-brand-600" />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {d.projects.filter((p) => p.total_milestones > 0).map((p) => (
            <ProjectProgressCard key={p.project_id} project={p} />
          ))}
          {!d.projects.some((p) => p.total_milestones > 0) && (
            <p className="text-sm text-ink-500">No project has milestones defined yet.</p>
          )}
        </div>
      </SectionCard>

      {/* Deadlines + activity ---------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Upcoming deadlines (next 30 days)"
          icon={<CalendarClock className="h-4 w-4 text-amber-600" />}>
          {!d.upcoming_deadlines.length ? (
            <p className="py-4 text-center text-sm text-ink-500">No deadlines in the next 30 days.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {d.upcoming_deadlines.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{m.name}</p>
                    <p className="truncate text-xs text-ink-500">{m.project_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-xs font-semibold",
                      (m.days_to_due ?? 99) <= 3 ? "text-red-600" : "text-ink-700")}>
                      {m.days_to_due === 0 ? "Due today" : `in ${m.days_to_due}d`}
                    </p>
                    <p className="text-[11px] text-ink-400">{formatDate(m.due_date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recent delivery activity"
          icon={<Activity className="h-4 w-4 text-emerald-600" />}>
          {!d.recent_activity.length ? (
            <p className="py-4 text-center text-sm text-ink-500">Nothing delivered yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {d.recent_activity.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{m.name}</p>
                    <p className="truncate text-xs text-ink-500">{m.project_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-emerald-700">
                      {formatDate(m.completed_at)}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      <VarianceLabel days={m.variance_days} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Filterable table --------------------------------------------- */}
      <SectionCard
        title="All milestones"
        icon={<Filter className="h-4 w-4 text-brand-600" />}
        actions={
          hasFilters && (
            <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setFilters({})}>
              Clear filters
            </Button>
          )
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input className="pl-9" placeholder="Milestone or project"
                  value={filters.q ?? ""} onChange={(e) => set({ q: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Project</Label>
              <Select value={filters.project_id ?? ""} onChange={(e) => set({ project_id: e.target.value })}>
                <option value="">All projects</option>
                {d.projects.filter((p) => p.total_milestones).map((p) => (
                  <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filters.status ?? ""}
                onChange={(e) => set({ status: (e.target.value || undefined) as MilestoneStatus })}>
                <option value="">Any status</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="DELAYED">Delayed</option>
              </Select>
            </div>
            <div>
              <Label>Risk</Label>
              <Select value={filters.risk ?? ""}
                onChange={(e) => set({ risk: (e.target.value || undefined) as MilestoneRisk })}>
                <option value="">Any risk</option>
                <option value="ON_TRACK">On track</option>
                <option value="AT_RISK">At risk</option>
                <option value="OVERDUE">Overdue</option>
                <option value="COMPLETE">Complete</option>
              </Select>
            </div>
          </div>

          {change.isError && <Alert variant="error">{extractErrorMessage(change.error)}</Alert>}

          {!d.milestones.length ? (
            <p className="py-6 text-center text-sm text-ink-500">
              No milestones match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wider text-ink-500">
                    <th className="py-2 pr-3 font-semibold">Milestone</th>
                    <th className="py-2 pr-3 font-semibold">Project</th>
                    <th className="py-2 pr-3 font-semibold">Planned</th>
                    <th className="py-2 pr-3 font-semibold">Actual</th>
                    <th className="py-2 pr-3 font-semibold">Variance</th>
                    <th className="py-2 pr-3 text-right font-semibold">Hours</th>
                    <th className="py-2 pr-3 font-semibold">Risk</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.milestones.map((m) => (
                    <tr key={m.id}
                      className={cn("border-b border-ink-100 last:border-0",
                        m.risk === "OVERDUE" && "bg-red-50/40",
                        m.risk === "AT_RISK" && "bg-amber-50/40")}>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-ink-900">{m.name}</p>
                        {m.assigned_contractors.length > 0 && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                            <Users className="h-3 w-3" />
                            {m.assigned_contractors.join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-600">
                        <Link className="hover:text-brand-700" to={`/vendor/projects/${m.project_id}`}>
                          {m.project_name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-ink-700">{formatDate(m.due_date)}</td>
                      <td className="py-2.5 pr-3 text-ink-700">
                        {m.completed_at ? formatDate(m.completed_at) : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <VarianceLabel days={m.variance_days} />
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-600">
                        {m.logged_hours ? `${m.logged_hours}h` : "—"}
                      </td>
                      <td className="py-2.5 pr-3"><RiskBadge risk={m.risk} /></td>
                      <td className="py-2.5">
                        <Select
                          className="h-8 w-36 text-xs"
                          value={m.status}
                          disabled={change.isPending}
                          onChange={(e) =>
                            change.mutate({ projectId: m.project_id, id: m.id, status: e.target.value })
                          }
                        >
                          <option value="UPCOMING">Upcoming</option>
                          <option value="IN_PROGRESS">In progress</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="DELAYED">Delayed</option>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">Milestones</h1>
      <p className="mt-1 text-sm text-ink-500">
        Delivery health across every project — progress, risk, planned versus actual dates and
        upcoming deadlines.
      </p>
    </div>
  );
}

function StatusChip({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "emerald" | "brand" | "slate" | "red";
}) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const bars = {
    emerald: "bg-emerald-500",
    brand: "bg-brand-500",
    slate: "bg-ink-300",
    red: "bg-red-500",
  }[tone];
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{label}</span>
        <span className="text-sm font-bold tabular-nums text-ink-900">{value}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div className={cn("h-full rounded-full transition-all", bars)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-ink-400">{pct}% of portfolio</p>
    </div>
  );
}

function VarianceLabel({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-ink-400">—</span>;
  if (days <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {days === 0 ? "On time" : `${Math.abs(days)}d early`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      {days}d late
    </span>
  );
}

function ProjectProgressCard({ project }: { project: ProjectMilestoneProgress }) {
  const p = project;
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/vendor/projects/${p.project_id}`}
            className="truncate text-sm font-semibold text-ink-900 hover:text-brand-700">
            {p.project_name}
          </Link>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
            <Users className="h-3.5 w-3.5" />
            {p.assigned_contractors} contractor{p.assigned_contractors === 1 ? "" : "s"}
            {p.next_due && ` · next due ${formatDate(p.next_due)}`}
          </p>
        </div>
        <RiskBadge risk={p.risk} />
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-ink-500">
            {p.completed} of {p.total_milestones} complete
          </span>
          <span className="font-bold tabular-nums text-ink-900">{p.completion_percent}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${p.completion_percent}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <MiniStat label="Done" value={p.completed} tone="text-emerald-700" />
        <MiniStat label="Active" value={p.in_progress} tone="text-brand-700" />
        <MiniStat label="At risk" value={p.at_risk} tone={p.at_risk ? "text-amber-700" : "text-ink-400"} />
        <MiniStat label="Overdue" value={p.overdue} tone={p.overdue ? "text-red-700" : "text-ink-400"} />
      </div>

      {(p.on_time_percent != null || p.avg_variance_days != null) && (
        <p className="mt-3 border-t border-ink-100 pt-2 text-[11px] text-ink-500">
          {p.on_time_percent != null && <>{p.on_time_percent}% delivered on time</>}
          {p.avg_variance_days != null && (
            <>
              {p.on_time_percent != null && " · "}
              average {p.avg_variance_days > 0 ? `${p.avg_variance_days}d late` :
                p.avg_variance_days === 0 ? "on schedule" : `${Math.abs(p.avg_variance_days)}d early`}
            </>
          )}
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-ink-50 py-1.5">
      <p className={cn("text-sm font-bold tabular-nums", tone)}>{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">{label}</p>
    </div>
  );
}
