/**
 * Contractor dashboard.
 *
 * Shows what a contractor actually needs: their current assignment,
 * weekly reporting status, hours worked, earnings and invoice status, their
 * performance score, and a notification feed derived from those same records.
 * Milestones are a vendor planning artefact and are deliberately absent.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Gauge,
  Receipt,
  Send,
  Wallet,
  XCircle,
} from "lucide-react";
import { getMyContractorProfile, getMyContractorAssignments } from "@/api/contractors";
import { myTimesheets } from "@/api/timesheets";
import { myInvoices, myPerformance } from "@/api/invoices";
import type { Invoice, Timesheet } from "@/api/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageLoader, EmptyState } from "@/components/ui/Feedback";
import {
  AssignmentStatusBadge,
  ContractorStatusBadge,
  InvoiceStatusBadge,
  TimesheetStatusBadge,
} from "@/components/ui/Badge";
import { MoneyTile, PerformancePanel, SectionCard } from "@/components/invoices/InvoiceParts";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Notice {
  id: string;
  tone: "info" | "warning" | "danger" | "success";
  icon: React.ReactNode;
  title: string;
  detail: string;
  to: string;
}

/** Derived from stored records rather than a separate notifications table. */
function buildNotices(sheets: Timesheet[], invoices: Invoice[]): Notice[] {
  const notices: Notice[] = [];

  for (const s of sheets.filter((x) => x.display_status === "REJECTED")) {
    notices.push({
      id: `rej-${s.id}`,
      tone: "danger",
      icon: <XCircle className="h-4 w-4" />,
      title: `Week of ${formatDate(s.week_start)} was rejected`,
      detail: s.rejection_reason || "Your vendor asked for a correction.",
      to: "/contractor/timesheets",
    });
  }
  for (const s of sheets.filter((x) => x.display_status === "DRAFT" && x.entries.length > 0)) {
    notices.push({
      id: `draft-${s.id}`,
      tone: "warning",
      icon: <Send className="h-4 w-4" />,
      title: `Week of ${formatDate(s.week_start)} is not submitted`,
      detail: `${s.total_hours}h logged and waiting to be sent for review.`,
      to: "/contractor/timesheets",
    });
  }
  for (const s of sheets.filter((x) => x.has_anomalies && x.display_status === "PENDING")) {
    notices.push({
      id: `anom-${s.id}`,
      tone: "warning",
      icon: <AlertTriangle className="h-4 w-4" />,
      title: `${s.anomaly_count} anomaly finding(s) under review`,
      detail: `Week of ${formatDate(s.week_start)} was flagged by the platform checks.`,
      to: "/contractor/timesheets",
    });
  }
  for (const i of invoices.filter((x) => x.status === "PAID").slice(0, 3)) {
    notices.push({
      id: `paid-${i.id}`,
      tone: "success",
      icon: <CheckCircle2 className="h-4 w-4" />,
      title: `${i.invoice_number} was paid`,
      detail: `${formatCurrency(i.net_payable, i.currency)}${i.payment_date ? ` on ${formatDate(i.payment_date)}` : ""}.`,
      to: "/contractor/invoices",
    });
  }
  for (const i of invoices.filter((x) => ["GENERATED", "SUBMITTED", "APPROVED"].includes(x.status))) {
    notices.push({
      id: `open-${i.id}`,
      tone: "info",
      icon: <Receipt className="h-4 w-4" />,
      title: `${i.invoice_number} is ${i.status.toLowerCase()}`,
      detail: `${formatCurrency(i.net_payable, i.currency)} · due ${formatDate(i.due_date)}.`,
      to: "/contractor/invoices",
    });
  }
  return notices.slice(0, 6);
}

const noticeTones = {
  info: "border-brand-200 bg-brand-50/60 text-brand-800",
  warning: "border-amber-200 bg-amber-50/60 text-amber-800",
  danger: "border-red-200 bg-red-50/60 text-red-800",
  success: "border-emerald-200 bg-emerald-50/60 text-emerald-800",
};

export function ContractorDashboard() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["contractor-me"],
    queryFn: getMyContractorProfile,
  });
  const { data: assignments } = useQuery({
    queryKey: ["contractor-assignments"],
    queryFn: getMyContractorAssignments,
  });
  const { data: sheets } = useQuery({ queryKey: ["my-timesheets"], queryFn: myTimesheets });
  const { data: invoices } = useQuery({ queryKey: ["my-invoices"], queryFn: myInvoices });
  const { data: performance } = useQuery({ queryKey: ["my-performance"], queryFn: myPerformance });

  const stats = useMemo(() => {
    const s = sheets ?? [];
    const i = invoices ?? [];
    const paid = i.filter((x) => x.status === "PAID");
    const open = i.filter((x) => ["GENERATED", "SUBMITTED", "APPROVED"].includes(x.status));
    return {
      currency: i[0]?.currency ?? assignments?.[0]?.currency ?? "INR",
      approvedHours: s
        .filter((x) => x.display_status === "APPROVED")
        .reduce((n, x) => n + x.total_hours, 0),
      totalHours: s.reduce((n, x) => n + x.total_hours, 0),
      pendingWeeks: s.filter((x) => x.display_status === "PENDING").length,
      earned: paid.reduce((n, x) => n + x.net_payable, 0),
      awaiting: open.reduce((n, x) => n + x.net_payable, 0),
      openCount: open.length,
    };
  }, [sheets, invoices, assignments]);

  const notices = useMemo(
    () => buildNotices(sheets ?? [], invoices ?? []),
    [sheets, invoices]
  );

  if (isLoading) return <PageLoader />;

  const primary = assignments?.[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">
          Welcome back, {profile?.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Working with <span className="font-medium text-ink-700">{profile?.vendor_name}</span>
        </p>
      </div>

      {/* Headline numbers -------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyTile
          label="Approved hours"
          value={`${Math.round(stats.approvedHours * 100) / 100}h`}
          sub={`${Math.round(stats.totalHours * 100) / 100}h logged in total`}
          tone="brand"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <MoneyTile
          label="Paid to you"
          value={formatCurrency(stats.earned, stats.currency)}
          sub="Settled invoices"
          tone="success"
          icon={<Wallet className="h-3.5 w-3.5" />}
        />
        <MoneyTile
          label="Awaiting payment"
          value={formatCurrency(stats.awaiting, stats.currency)}
          sub={`${stats.openCount} invoice(s) in progress`}
          tone={stats.openCount ? "warning" : "neutral"}
          icon={<Receipt className="h-3.5 w-3.5" />}
        />
        <MoneyTile
          label="Performance score"
          value={performance?.score != null ? performance.score : "—"}
          sub={performance?.band === "NO_DATA" ? "Submit a report to start" : "Analytical KPI"}
          tone="brand"
          icon={<Gauge className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Current assignment ------------------------------------- */}
          <SectionCard
            title={(assignments?.length ?? 0) > 1 ? `Current assignments (${assignments!.length})` : "Current assignment"}
            icon={<CalendarDays className="h-4 w-4 text-brand-600" />}
            actions={
              primary && (
                <Link to="/contractor/assignment">
                  <Button variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                    Details
                  </Button>
                </Link>
              )
            }
          >
            {!primary ? (
              <EmptyState
                title="On bench"
                description="Your vendor hasn't placed you on a project yet. It will appear here as soon as it's created."
              />
            ) : (
              <div className="divide-y divide-ink-100">
                {assignments!.map((a, i) => (
                  <div key={a.id} className={i === 0 ? "space-y-4 pb-4" : "space-y-4 py-4 last:pb-0"}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-ink-900">{a.project_name}</span>
                      <AssignmentStatusBadge status={a.status} />
                      {i === 0 && profile && <ContractorStatusBadge status={profile.status} />}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      <Field label="Role" value={a.role} />
                      <Field
                        label="Pay rate"
                        value={`${formatCurrency(a.pay_rate, a.currency)}/hr`}
                      />
                      <Field label="Week" value={`${a.working_hours}h`} />
                      <Field
                        label="Duration"
                        value={`${formatDate(a.start_date)} → ${formatDate(a.end_date)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Weekly reports ----------------------------------------- */}
          <SectionCard
            title="Recent weekly reports"
            icon={<Clock className="h-4 w-4 text-brand-600" />}
            actions={
              <Link to="/contractor/timesheets">
                <Button variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                  All timesheets
                </Button>
              </Link>
            }
          >
            {!sheets?.length ? (
              <p className="py-4 text-center text-sm text-ink-500">
                No weekly reports yet. Log your first day in Timesheets.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {sheets.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">
                        {formatDate(s.week_start)} — {formatDate(s.week_end)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {s.total_hours}h · {s.regular_hours} regular / {s.overtime_hours} overtime
                        {s.has_anomalies && ` · ${s.anomaly_count} anomaly finding(s)`}
                      </p>
                    </div>
                    <TimesheetStatusBadge status={s.display_status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Invoice history ---------------------------------------- */}
          <SectionCard
            title="Invoice history"
            icon={<Receipt className="h-4 w-4 text-brand-600" />}
            actions={
              <Link to="/contractor/invoices">
                <Button variant="ghost" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                  All invoices
                </Button>
              </Link>
            }
          >
            {!invoices?.length ? (
              <p className="py-4 text-center text-sm text-ink-500">
                No invoices yet. They appear once your vendor bills approved hours.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {invoices.slice(0, 5).map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-ink-900">
                        {i.invoice_number}
                      </p>
                      <p className="text-xs text-ink-500">
                        {formatDate(i.period_start)} — {formatDate(i.period_end)} · {i.total_hours}h
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-ink-900">
                        {formatCurrency(i.net_payable, i.currency)}
                      </span>
                      <InvoiceStatusBadge status={i.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Sidebar --------------------------------------------------- */}
        <div className="space-y-4">
          <SectionCard title="Notifications" icon={<Bell className="h-4 w-4 text-brand-600" />}>
            {!notices.length ? (
              <div className="flex items-center gap-2 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Nothing needs your attention.
              </div>
            ) : (
              <ul className="space-y-2">
                {notices.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={n.to}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 transition-opacity hover:opacity-80 ${noticeTones[n.tone]}`}
                    >
                      <span className="mt-0.5 shrink-0">{n.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">{n.title}</span>
                        <span className="block text-[11px] opacity-80">{n.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {performance && (
            <SectionCard
              title="Performance score"
              icon={<Gauge className="h-4 w-4 text-brand-600" />}
            >
              <PerformancePanel score={performance} />
            </SectionCard>
          )}

          {stats.pendingWeeks > 0 && (
            <Card className="border-amber-200 bg-amber-50/60">
              <CardContent className="flex items-start gap-2 text-sm text-amber-800">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {stats.pendingWeeks} weekly report
                  {stats.pendingWeeks === 1 ? " is" : "s are"} awaiting vendor review. Approved
                  hours become invoiceable automatically.
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink-800">{value}</p>
    </div>
  );
}
