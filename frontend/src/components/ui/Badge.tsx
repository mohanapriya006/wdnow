import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type {
  AssignmentStatus,
  ContractorStatus,
  VendorStatus,
  TimesheetDisplayStatus,
  AnomalySeverity,
  InvoiceStatus,
  MilestoneRisk,
  MilestoneStatus,
  PerformanceBand,
} from "@/api/types";

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

const assignmentStyles: Record<AssignmentStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  DRAFT: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  COMPLETED: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  TERMINATED: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
};

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge className={assignmentStyles[status]}>{status}</Badge>;
}

const contractorStyles: Record<ContractorStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  BENCH: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  INACTIVE: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

export function ContractorStatusBadge({ status }: { status: ContractorStatus }) {
  const label = status === "BENCH" ? "ON BENCH" : status;
  return <Badge className={contractorStyles[status]}>{label}</Badge>;
}

const vendorStyles: Record<VendorStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  INACTIVE: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return <Badge className={vendorStyles[status]}>{status}</Badge>;
}

/* ------------------------------------------------------------------ */
/* Timesheets                                                          */
/* Green = approved, red = rejected/anomaly, yellow = pending/warning,  */
/* blue = information / in progress.                                    */
/* ------------------------------------------------------------------ */

const timesheetStyles: Record<TimesheetDisplayStatus, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  REJECTED: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  DRAFT: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20",
};

const timesheetLabels: Record<TimesheetDisplayStatus, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PENDING: "Pending review",
  DRAFT: "Draft",
};

export function TimesheetStatusBadge({
  status,
  className,
}: {
  status: TimesheetDisplayStatus;
  className?: string;
}) {
  return (
    <Badge className={cn(timesheetStyles[status] ?? timesheetStyles.DRAFT, className)}>
      {timesheetLabels[status] ?? status}
    </Badge>
  );
}

const severityStyles: Record<AnomalySeverity, string> = {
  CRITICAL: "bg-red-600 text-white ring-1 ring-inset ring-red-700/30",
  HIGH: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  MEDIUM: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  LOW: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20",
};

export function SeverityBadge({ severity }: { severity: AnomalySeverity }) {
  return <Badge className={severityStyles[severity] ?? severityStyles.LOW}>{severity}</Badge>;
}

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

const invoiceStyles: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  GENERATED: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20",
  SUBMITTED: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  PAID: "bg-emerald-600 text-white ring-1 ring-inset ring-emerald-700/30",
  REJECTED: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
};

const invoiceLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  GENERATED: "Generated",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  PAID: "Paid",
  REJECTED: "Rejected",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge className={invoiceStyles[status]}>{invoiceLabels[status] ?? status}</Badge>;
}

/* ------------------------------------------------------------------ */
/* Milestones                                                          */
/* ------------------------------------------------------------------ */

const milestoneStyles: Record<MilestoneStatus, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  IN_PROGRESS: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20",
  UPCOMING: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  DELAYED: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
};

const milestoneLabels: Record<MilestoneStatus, string> = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In progress",
  UPCOMING: "Upcoming",
  DELAYED: "Delayed",
};

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return <Badge className={milestoneStyles[status]}>{milestoneLabels[status] ?? status}</Badge>;
}

const riskStyles: Record<MilestoneRisk, string> = {
  COMPLETE: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  ON_TRACK: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20",
  AT_RISK: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  OVERDUE: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
};

const riskLabels: Record<MilestoneRisk, string> = {
  COMPLETE: "Complete",
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OVERDUE: "Overdue",
};

export function RiskBadge({ risk }: { risk: MilestoneRisk }) {
  return <Badge className={riskStyles[risk] ?? riskStyles.ON_TRACK}>{riskLabels[risk] ?? risk}</Badge>;
}

/* ------------------------------------------------------------------ */
/* Contractor performance                                              */
/* ------------------------------------------------------------------ */

const bandStyles: Record<PerformanceBand, string> = {
  EXCELLENT: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  STRONG: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20",
  FAIR: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  NEEDS_ATTENTION: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  NO_DATA: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

const bandLabels: Record<PerformanceBand, string> = {
  EXCELLENT: "Excellent",
  STRONG: "Strong",
  FAIR: "Fair",
  NEEDS_ATTENTION: "Needs attention",
  NO_DATA: "Not enough data",
};

export function PerformanceBandBadge({ band }: { band: PerformanceBand }) {
  return <Badge className={bandStyles[band] ?? bandStyles.NO_DATA}>{bandLabels[band] ?? band}</Badge>;
}
